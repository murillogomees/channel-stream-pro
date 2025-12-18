import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[RefreshViews] Calling refresh_all_materialized_views...');

    // Call the existing database function
    const { error } = await supabase.rpc('refresh_all_materialized_views');

    if (error) {
      console.error('[RefreshViews] RPC error:', error.message);
      
      // Get current stats as fallback
      const { count: channelCount } = await supabase
        .from('iptv_channels')
        .select('*', { count: 'exact', head: true });
      
      const { count: profileCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message,
        fallback: {
          channels: channelCount || 0,
          profiles: profileCount || 0
        },
        note: 'Views refresh via Edge Function not supported - use pg_cron'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'All materialized views refreshed',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[RefreshViews] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
