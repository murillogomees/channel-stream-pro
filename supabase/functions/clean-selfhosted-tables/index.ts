import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SELFHOSTED_URL = "https://supabase.iptvlink.com.br";
const SELFHOSTED_SERVICE_KEY = Deno.env.get('SELFHOSTED_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, confirm } = await req.json();
    
    if (!SELFHOSTED_SERVICE_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: 'SELFHOSTED_SERVICE_ROLE_KEY not configured'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SELFHOSTED_URL, SELFHOSTED_SERVICE_KEY, {
      auth: { persistSession: false }
    });

    // List of public tables to truncate (in order to respect foreign keys)
    const publicTables = [
      // Dependent tables first
      'ab_test_results',
      'affiliate_analytics',
      'affiliate_dashboard',
      'affiliate_fraud_logs',
      'affiliate_link_clicks',
      'affiliate_links',
      'affiliate_onboarding',
      'affiliate_payouts',
      'affiliate_promotions',
      'affiliate_referrals',
      'affiliate_reports',
      'affiliate_withdrawals',
      'client_status_history',
      'payment_history',
      'payments',
      'notification_logs',
      'notification_queue',
      'playback_tokens',
      'player_events',
      'user_subscriptions',
      'user_roles',
      // IPTV tables
      'iptv_stream_tokens',
      'iptv_transcode_jobs',
      'iptv_probe_jobs',
      'iptv_channel_metrics',
      'iptv_cdn_cache',
      'iptv_playlist_channels',
      'iptv_playlists',
      'iptv_channels',
      'epg_programs',
      // M3U tables
      'm3u_sync_entries',
      'm3u_sync_sources',
      // Other tables
      'activity_logs',
      'admin_badge_notifications',
      'admin_favorites',
      'admin_phones',
      'admin_shortcuts',
      'api_usage',
      'auth_sessions_log',
      'dashboard_widgets',
      'health_checks',
      'mercado_pago_webhooks',
      'migration_audit',
      'remote_command_audit',
      'security_events',
      'test_contacts',
      'viewing_history',
      'watch_progress',
      // Config tables
      'ab_test_offers',
      'affiliates',
      'affiliate_config',
      'affiliate_marketing_materials',
      'affiliate_tiers',
      'app_versions',
      'auto_notifications',
      'banners',
      'custom_status_badges',
      'discount_coupons',
      'feature_flag_config',
      'homepage_content',
      'homepage_faqs',
      'ip_blacklist',
      'ip_whitelist',
      'mercado_pago_config',
      'notification_templates',
      'subscription_plans',
      'system_config',
      'r2_migration_config',
      'r2_migration_items',
      'r2_migration_jobs',
      // Main tables last
      'profiles',
    ];

    if (action === 'preview') {
      // Just return what would be deleted
      const counts: Record<string, number> = {};
      
      for (const table of publicTables) {
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
        action: 'preview',
        data: {
          tables: counts,
          total_tables: publicTables.length,
          total_rows: Object.values(counts).filter(c => c > 0).reduce((a, b) => a + b, 0),
          warning: 'Esta ação irá DELETAR TODOS os dados do self-hosted!'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'clean' && confirm === 'CONFIRMO_DELETAR_TUDO') {
      const results: Record<string, { success: boolean; error?: string }> = {};
      const authResults: Record<string, { success: boolean; error?: string }> = {};
      
      console.log('Starting cleanup of self-hosted tables (including auth)...');

      // First, clean auth tables in correct order (dependencies first)
      const authTables = [
        'auth.identities',
        'auth.sessions', 
        'auth.refresh_tokens',
        'auth.mfa_factors',
        'auth.mfa_challenges',
        'auth.mfa_amr_claims',
        'auth.flow_state',
        'auth.saml_relay_states',
        'auth.sso_domains',
        'auth.sso_providers',
        'auth.one_time_tokens',
        'auth.users' // Last - after all dependencies
      ];

      // Clean auth tables using direct fetch with service role
      for (const table of authTables) {
        const [schema, tableName] = table.split('.');
        try {
          // Use PostgREST directly for auth schema
          const response = await fetch(`${SELFHOSTED_URL}/rest/v1/${tableName}?select=*`, {
            method: 'DELETE',
            headers: {
              'apikey': SELFHOSTED_SERVICE_KEY,
              'Authorization': `Bearer ${SELFHOSTED_SERVICE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
              'Accept-Profile': schema
            }
          });
          
          if (response.ok || response.status === 204) {
            authResults[table] = { success: true };
            console.log(`Cleaned auth table ${table}: OK`);
          } else {
            const errorText = await response.text();
            authResults[table] = { success: false, error: errorText };
            console.log(`Cleaned auth table ${table}: FAILED - ${errorText}`);
          }
        } catch (e) {
          authResults[table] = { success: false, error: e.message };
          console.log(`Cleaned auth table ${table}: ERROR - ${e.message}`);
        }
      }

      // Then clean public tables
      for (const table of publicTables) {
        try {
          const { error } = await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
          
          if (error) {
            // Try with bigint id
            const { error: error2 } = await supabase
              .from(table)
              .delete()
              .gte('id', 0); // For bigint tables
              
            results[table] = { success: !error2, error: error2?.message };
          } else {
            results[table] = { success: true };
          }
          
          console.log(`Cleaned table ${table}: ${results[table].success ? 'OK' : results[table].error}`);
        } catch (e) {
          results[table] = { success: false, error: e.message };
        }
      }

      // Summary
      const publicSuccess = Object.values(results).filter(r => r.success).length;
      const publicFail = Object.values(results).filter(r => !r.success).length;
      const authSuccess = Object.values(authResults).filter(r => r.success).length;
      const authFail = Object.values(authResults).filter(r => !r.success).length;

      return new Response(JSON.stringify({
        success: true,
        action: 'clean',
        data: {
          auth_results: authResults,
          public_results: results,
          summary: {
            auth: { total: authTables.length, success: authSuccess, failed: authFail },
            public: { total: publicTables.length, success: publicSuccess, failed: publicFail }
          },
          message: `Limpeza concluída: Auth (${authSuccess}/${authTables.length}), Public (${publicSuccess}/${publicTables.length})`,
          next_step: 'Agora você pode fazer o dump do Cloud e restaurar no self-hosted'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'clean-auth' && confirm === 'CONFIRMO_DELETAR_AUTH') {
      // This requires direct database access - we'll document the SQL
      return new Response(JSON.stringify({
        success: true,
        action: 'clean-auth-instructions',
        data: {
          message: 'Para limpar as tabelas de auth, execute o seguinte SQL no PostgreSQL do self-hosted:',
          sql: `
-- Conecte no PostgreSQL do self-hosted e execute:
-- ATENÇÃO: Isso deleta TODOS os usuários!

-- Primeiro, limpa as dependências
DELETE FROM auth.identities;
DELETE FROM auth.sessions;
DELETE FROM auth.refresh_tokens;
DELETE FROM auth.mfa_factors;
DELETE FROM auth.mfa_challenges;
DELETE FROM auth.mfa_amr_claims;
DELETE FROM auth.flow_state;
DELETE FROM auth.saml_relay_states;
DELETE FROM auth.sso_providers;
DELETE FROM auth.sso_domains;
DELETE FROM auth.one_time_tokens;

-- Por último, deleta os usuários
DELETE FROM auth.users;

-- Reseta as sequences (opcional)
-- ALTER SEQUENCE auth.refresh_tokens_id_seq RESTART WITH 1;
          `.trim(),
          connection: {
            host: 'srv1182856.hstgr.cloud',
            port: 5432,
            database: 'postgres',
            user: 'postgres'
          }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action or missing confirmation',
      usage: {
        preview: 'action: "preview" - mostra contagem de registros',
        clean: 'action: "clean", confirm: "CONFIRMO_DELETAR_TUDO" - limpa tabelas públicas',
        clean_auth: 'action: "clean-auth", confirm: "CONFIRMO_DELETAR_AUTH" - instruções para limpar auth'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Clean tables error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
