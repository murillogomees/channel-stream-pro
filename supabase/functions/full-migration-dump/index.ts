import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cloud (source)
const CLOUD_URL = Deno.env.get('SUPABASE_URL') || '';
const CLOUD_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Self-hosted (destination)
const SELFHOSTED_URL = "https://supabase.iptvlink.com.br";
const SELFHOSTED_SERVICE_KEY = Deno.env.get('SELFHOSTED_SERVICE_ROLE_KEY') || '';

interface MigrationResult {
  table: string;
  cloud_count: number;
  migrated: number;
  status: 'success' | 'error' | 'skipped';
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, confirm, tables } = await req.json();

    if (!CLOUD_SERVICE_KEY || !SELFHOSTED_SERVICE_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing service role keys'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cloudClient = createClient(CLOUD_URL, CLOUD_SERVICE_KEY, {
      auth: { persistSession: false }
    });

    const selfHostedClient = createClient(SELFHOSTED_URL, SELFHOSTED_SERVICE_KEY, {
      auth: { persistSession: false }
    });

    // All public tables in migration order (respecting foreign keys)
    const ALL_TABLES = [
      // Config/reference tables first (no dependencies)
      'subscription_plans',
      'notification_templates',
      'affiliate_tiers',
      'affiliate_config',
      'affiliate_marketing_materials',
      'affiliate_promotions',
      'custom_status_badges',
      'feature_flag_config',
      'homepage_content',
      'homepage_faqs',
      'pwa_settings',
      'system_config',
      'mercado_pago_config',
      'ab_test_offers',
      'app_versions',
      'banners',
      'ip_blacklist',
      'ip_whitelist',
      'auto_notifications',
      'test_contacts',
      // Main entities
      'profiles',
      'user_roles',
      'affiliates',
      // Dependent on profiles/affiliates
      'affiliate_analytics',
      'affiliate_dashboard',
      'affiliate_fraud_logs',
      'affiliate_link_clicks',
      'affiliate_links',
      'affiliate_onboarding',
      'affiliate_payouts',
      'affiliate_referrals',
      'affiliate_reports',
      'affiliate_withdrawals',
      'admin_badge_notifications',
      'admin_favorites',
      'admin_phones',
      'admin_shortcuts',
      'dashboard_widgets',
      'client_status_history',
      // Subscriptions and payments
      'user_subscriptions',
      'payments',
      'payment_history',
      'discount_coupons',
      // AB tests
      'ab_test_results',
      // IPTV
      'iptv_channels',
      'iptv_playlists',
      'iptv_playlist_channels',
      'iptv_cdn_cache',
      'iptv_channel_metrics',
      'iptv_probe_jobs',
      'iptv_transcode_jobs',
      'iptv_stream_tokens',
      'epg_programs',
      // Player/viewing
      'playback_tokens',
      'player_events',
      'viewing_history',
      'watch_progress',
      // Notifications
      'notification_logs',
      'notification_queue',
      // Security/logs
      'activity_logs',
      'auth_sessions_log',
      'security_events',
      'security_alerts',
      'security_alert_deliveries',
      'health_checks',
      'api_usage',
      'mercado_pago_webhooks',
      'migration_audit',
      'remote_command_audit',
      'rls_audit_resolutions',
      'rls_fix_backups',
      'rls_scan_results',
    ];

    if (action === 'preview') {
      console.log('Previewing migration from Cloud to Self-hosted...');
      const preview: Record<string, { cloud: number; selfhosted: number }> = {};

      for (const table of ALL_TABLES) {
        try {
          const { count: cloudCount } = await cloudClient
            .from(table)
            .select('*', { count: 'exact', head: true });

          let selfHostedCount = -1;
          try {
            const { count } = await selfHostedClient
              .from(table)
              .select('*', { count: 'exact', head: true });
            selfHostedCount = count || 0;
          } catch {
            selfHostedCount = -1; // Table doesn't exist
          }

          preview[table] = {
            cloud: cloudCount || 0,
            selfhosted: selfHostedCount
          };
        } catch (e) {
          preview[table] = { cloud: -1, selfhosted: -1 };
        }
      }

      const totalCloud = Object.values(preview).reduce((sum, v) => sum + (v.cloud > 0 ? v.cloud : 0), 0);
      const existingTables = Object.values(preview).filter(v => v.selfhosted >= 0).length;
      const missingTables = Object.values(preview).filter(v => v.selfhosted < 0).length;

      return new Response(JSON.stringify({
        success: true,
        action: 'preview',
        data: {
          tables: preview,
          summary: {
            total_tables: ALL_TABLES.length,
            existing_on_selfhosted: existingTables,
            missing_on_selfhosted: missingTables,
            total_cloud_records: totalCloud
          },
          warning: 'Esta ação irá SOBRESCREVER todos os dados no self-hosted!'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'migrate' && confirm === 'CONFIRMO_MIGRAR_TUDO') {
      console.log('Starting full migration from Cloud to Self-hosted...');
      const results: MigrationResult[] = [];
      const tablesToMigrate = tables && tables.length > 0 ? tables : ALL_TABLES;
      const BATCH_SIZE = 500;

      for (const table of tablesToMigrate) {
        console.log(`\n=== Migrating table: ${table} ===`);
        
        try {
          // 1. Get count from cloud
          const { count: cloudCount, error: countError } = await cloudClient
            .from(table)
            .select('*', { count: 'exact', head: true });

          if (countError) {
            console.log(`Table ${table} not found on Cloud: ${countError.message}`);
            results.push({
              table,
              cloud_count: 0,
              migrated: 0,
              status: 'skipped',
              error: `Not found on Cloud: ${countError.message}`
            });
            continue;
          }

          const totalRecords = cloudCount || 0;
          console.log(`Cloud has ${totalRecords} records in ${table}`);

          if (totalRecords === 0) {
            // Just try to clean the self-hosted table
            try {
              await selfHostedClient.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            } catch {}
            try {
              await selfHostedClient.from(table).delete().gte('id', 0);
            } catch {}
            
            results.push({
              table,
              cloud_count: 0,
              migrated: 0,
              status: 'success'
            });
            continue;
          }

          // 2. Clean self-hosted table first
          console.log(`Cleaning ${table} on self-hosted...`);
          try {
            // Try UUID-based delete
            await selfHostedClient.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
          } catch {
            // Try bigint-based delete
            try {
              await selfHostedClient.from(table).delete().gte('id', 0);
            } catch (e) {
              console.log(`Could not clean ${table}: ${e.message}`);
            }
          }

          // 3. Migrate data in batches
          let migratedCount = 0;
          let offset = 0;

          while (offset < totalRecords) {
            console.log(`Fetching batch ${offset}-${offset + BATCH_SIZE} of ${totalRecords}...`);
            
            const { data: batch, error: fetchError } = await cloudClient
              .from(table)
              .select('*')
              .range(offset, offset + BATCH_SIZE - 1);

            if (fetchError) {
              console.log(`Error fetching from ${table}: ${fetchError.message}`);
              break;
            }

            if (!batch || batch.length === 0) {
              break;
            }

            // Insert batch into self-hosted
            const { error: insertError } = await selfHostedClient
              .from(table)
              .insert(batch);

            if (insertError) {
              console.log(`Error inserting into ${table}: ${insertError.message}`);
              // Try individual inserts for problematic batches
              for (const record of batch) {
                try {
                  await selfHostedClient.from(table).insert(record);
                  migratedCount++;
                } catch {
                  // Skip individual failures
                }
              }
            } else {
              migratedCount += batch.length;
            }

            offset += BATCH_SIZE;
            console.log(`Migrated ${migratedCount}/${totalRecords} records`);
          }

          results.push({
            table,
            cloud_count: totalRecords,
            migrated: migratedCount,
            status: migratedCount === totalRecords ? 'success' : 'error',
            error: migratedCount < totalRecords ? `Only migrated ${migratedCount}/${totalRecords}` : undefined
          });

        } catch (e) {
          console.log(`Error migrating ${table}: ${e.message}`);
          results.push({
            table,
            cloud_count: 0,
            migrated: 0,
            status: 'error',
            error: e.message
          });
        }
      }

      // Summary
      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      const skippedCount = results.filter(r => r.status === 'skipped').length;
      const totalMigrated = results.reduce((sum, r) => sum + r.migrated, 0);
      const totalRecords = results.reduce((sum, r) => sum + r.cloud_count, 0);

      return new Response(JSON.stringify({
        success: true,
        action: 'migrate',
        data: {
          results,
          summary: {
            tables_success: successCount,
            tables_error: errorCount,
            tables_skipped: skippedCount,
            total_records: totalRecords,
            total_migrated: totalMigrated
          },
          message: `Migração concluída: ${successCount} tabelas OK, ${errorCount} com erro, ${skippedCount} ignoradas. ${totalMigrated}/${totalRecords} registros migrados.`
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
        migrate: 'action: "migrate", confirm: "CONFIRMO_MIGRAR_TUDO" - executa migração completa',
        migrate_specific: 'action: "migrate", confirm: "CONFIRMO_MIGRAR_TUDO", tables: ["profiles", "user_roles"] - migra tabelas específicas'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
