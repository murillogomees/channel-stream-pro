import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Verify this is called by cron or with proper auth
  const authHeader = req.headers.get('authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const isAuthorized = authHeader === `Bearer ${cronSecret}` || 
                       authHeader?.includes(supabaseKey);
  
  if (!isAuthorized) {
    console.log('[M3U-CRON] Unauthorized access attempt');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    console.log('[M3U-CRON] Starting scheduled sync check');
    
    // Find sources that need syncing
    // Sync if: never synced OR last sync was before (now - interval_minutes)
    const { data: sources, error: sourcesError } = await supabase
      .from('m3u_sync_sources')
      .select('*')
      .eq('enabled', true)
      .or(`last_sync_at.is.null,last_sync_at.lt.${new Date(Date.now() - 30 * 60 * 1000).toISOString()}`);
    
    if (sourcesError) throw sourcesError;
    
    if (!sources || sources.length === 0) {
      console.log('[M3U-CRON] No sources need syncing');
      return new Response(JSON.stringify({
        message: 'No sources need syncing',
        checked_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Filter sources based on their individual sync intervals
    const sourcesToSync = sources.filter(source => {
      if (!source.last_sync_at) return true;
      const lastSync = new Date(source.last_sync_at).getTime();
      const interval = (source.sync_interval_minutes || 30) * 60 * 1000;
      return Date.now() - lastSync >= interval;
    });
    
    if (sourcesToSync.length === 0) {
      console.log('[M3U-CRON] All sources are up to date');
      return new Response(JSON.stringify({
        message: 'All sources are up to date',
        checked_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[M3U-CRON] Found ${sourcesToSync.length} sources to sync`);
    
    // Call the main sync function for each source
    const results = [];
    
    for (const source of sourcesToSync) {
      try {
        console.log(`[M3U-CRON] Triggering sync for ${source.key}`);
        
        // Call the sync function
        const { data, error } = await supabase.functions.invoke('m3u-sync', {
          body: {
            key: source.key,
            triggered_by: 'cron',
          },
        });
        
        if (error) {
          console.error(`[M3U-CRON] Sync failed for ${source.key}:`, error);
          results.push({
            key: source.key,
            status: 'failed',
            error: error.message,
          });
        } else {
          console.log(`[M3U-CRON] Sync completed for ${source.key}`);
          results.push({
            key: source.key,
            status: 'completed',
            data,
          });
        }
      } catch (syncError: any) {
        console.error(`[M3U-CRON] Error syncing ${source.key}:`, syncError);
        results.push({
          key: source.key,
          status: 'error',
          error: syncError.message,
        });
      }
    }
    
    // Cleanup old data
    await supabase.rpc('cleanup_old_m3u_sync_data');
    
    console.log(`[M3U-CRON] Completed. Synced ${results.filter(r => r.status === 'completed').length}/${sourcesToSync.length}`);
    
    return new Response(JSON.stringify({
      message: 'Cron sync completed',
      synced: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status !== 'completed').length,
      results,
      checked_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error('[M3U-CRON] Error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
