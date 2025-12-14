import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { action } = await req.json();

    switch (action) {
      case 'check-connection': {
        const { data, error } = await supabase.from('profiles').select('id').limit(1);
        return new Response(JSON.stringify({
          success: !error,
          message: error ? error.message : 'Conexão OK',
          url: supabaseUrl,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get-table-counts': {
        const tables = [
          'profiles', 'user_roles', 'iptv_channels', 'iptv_playlists',
          'subscription_plans', 'payments', 'activity_logs', 'affiliates',
          'm3u_sync_entries', 'notification_logs', 'whatsapp_templates'
        ];

        const counts: Record<string, number> = {};
        
        for (const table of tables) {
          try {
            const { count, error } = await supabase
              .from(table)
              .select('*', { count: 'exact', head: true });
            counts[table] = error ? -1 : (count || 0);
          } catch {
            counts[table] = -1;
          }
        }

        return new Response(JSON.stringify({
          success: true,
          counts,
          total: Object.values(counts).filter(c => c >= 0).reduce((a, b) => a + b, 0),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'check-secrets': {
        const requiredSecrets = [
          'SUPABASE_URL',
          'SUPABASE_ANON_KEY', 
          'SUPABASE_SERVICE_ROLE_KEY',
          'MERCADO_PAGO_ACCESS_TOKEN',
          'WHATSAPP_APPKEY',
          'WHATSAPP_AUTHKEY',
          'JWT_SECRET',
          'TMDB_API_KEY',
        ];

        const secretStatus: Record<string, boolean> = {};
        
        for (const secret of requiredSecrets) {
          secretStatus[secret] = !!Deno.env.get(secret);
        }

        const configured = Object.values(secretStatus).filter(Boolean).length;
        
        return new Response(JSON.stringify({
          success: true,
          secrets: secretStatus,
          configured,
          total: requiredSecrets.length,
          allConfigured: configured === requiredSecrets.length,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'check-auth': {
        // Verificar se auth está funcionando
        const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1 });
        
        return new Response(JSON.stringify({
          success: !error,
          message: error ? error.message : 'Auth funcionando',
          hasUsers: users && users.length > 0,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'full-diagnostic': {
        // Diagnóstico completo
        const results: Record<string, unknown> = {};

        // 1. Conexão
        const { error: connError } = await supabase.from('profiles').select('id').limit(1);
        results.connection = { ok: !connError, error: connError?.message };

        // 2. Tabelas principais
        const mainTables = ['profiles', 'user_roles', 'iptv_channels', 'subscription_plans'];
        results.tables = {};
        for (const table of mainTables) {
          const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
          (results.tables as Record<string, unknown>)[table] = { count: count || 0, error: error?.message };
        }

        // 3. Secrets
        const criticalSecrets = ['SUPABASE_SERVICE_ROLE_KEY', 'MERCADO_PAGO_ACCESS_TOKEN', 'WHATSAPP_APPKEY'];
        results.secrets = {};
        for (const s of criticalSecrets) {
          (results.secrets as Record<string, boolean>)[s] = !!Deno.env.get(s);
        }

        // 4. Auth
        try {
          const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1 });
          results.auth = { ok: true, hasUsers: users && users.length > 0 };
        } catch (e) {
          results.auth = { ok: false, error: (e as Error).message };
        }

        // 5. Storage buckets
        try {
          const { data: buckets } = await supabase.storage.listBuckets();
          results.storage = { ok: true, buckets: buckets?.map(b => b.name) || [] };
        } catch (e) {
          results.storage = { ok: false, error: (e as Error).message };
        }

        return new Response(JSON.stringify({
          success: true,
          diagnostic: results,
          timestamp: new Date().toISOString(),
          supabaseUrl: supabaseUrl,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        return new Response(JSON.stringify({
          error: 'Ação inválida',
          validActions: ['check-connection', 'get-table-counts', 'check-secrets', 'check-auth', 'full-diagnostic'],
        }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

  } catch (error) {
    console.error('Migration helper error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: (error as Error).message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
