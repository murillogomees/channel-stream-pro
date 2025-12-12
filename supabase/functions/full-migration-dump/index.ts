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
      'profiles',
      'user_roles',
      'affiliates',
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
      'user_subscriptions',
      'payments',
      'payment_history',
      'discount_coupons',
      'ab_test_results',
      'iptv_channels',
      'iptv_playlists',
      'iptv_playlist_channels',
      'iptv_cdn_cache',
      'iptv_channel_metrics',
      'iptv_probe_jobs',
      'iptv_transcode_jobs',
      'iptv_stream_tokens',
      'epg_programs',
      'playback_tokens',
      'player_events',
      'viewing_history',
      'watch_progress',
      'notification_logs',
      'notification_queue',
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

    // ===== MIGRATE AUTH SCHEMA =====
    if (action === 'migrate-auth') {
      console.log('🔐 Starting auth schema migration...');
      
      // Step 1: Get all users from Cloud
      console.log('Fetching users from Cloud...');
      const usersResponse = await fetch(`${CLOUD_URL}/auth/v1/admin/users?per_page=1000`, {
        headers: {
          'apikey': CLOUD_SERVICE_KEY,
          'Authorization': `Bearer ${CLOUD_SERVICE_KEY}`
        }
      });

      if (!usersResponse.ok) {
        const errorText = await usersResponse.text();
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to fetch users from Cloud: ${usersResponse.status} - ${errorText}`
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const usersData = await usersResponse.json();
      const cloudUsers = usersData.users || [];
      console.log(`Found ${cloudUsers.length} users in Cloud`);

      // Step 2: Delete existing users from Self-hosted that match cloud user emails
      console.log('Checking for existing users on Self-hosted...');
      const selfHostedUsersResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/admin/users?per_page=1000`, {
        headers: {
          'apikey': SELFHOSTED_SERVICE_KEY,
          'Authorization': `Bearer ${SELFHOSTED_SERVICE_KEY}`
        }
      });

      let deletedCount = 0;
      if (selfHostedUsersResponse.ok) {
        const selfHostedData = await selfHostedUsersResponse.json();
        const existingUsers = selfHostedData.users || [];
        console.log(`Found ${existingUsers.length} existing users in Self-hosted`);

        // Delete all existing users
        for (const existingUser of existingUsers) {
          try {
            const deleteResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/admin/users/${existingUser.id}`, {
              method: 'DELETE',
              headers: {
                'apikey': SELFHOSTED_SERVICE_KEY,
                'Authorization': `Bearer ${SELFHOSTED_SERVICE_KEY}`
              }
            });
            if (deleteResponse.ok) deletedCount++;
          } catch (e) {
            console.log(`Failed to delete user ${existingUser.email}: ${e.message}`);
          }
        }
        console.log(`Deleted ${deletedCount} existing users`);
      }

      // Step 3: Also clean profiles table on self-hosted to avoid trigger conflicts
      console.log('Cleaning profiles on self-hosted to avoid trigger conflicts...');
      try {
        await selfHostedClient.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await selfHostedClient.from('user_roles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.log('Could not clean profiles/user_roles:', e.message);
      }

      // Step 4: Create users on Self-hosted with same IDs
      console.log('Creating users on Self-hosted...');
      const results: { email: string; id: string; status: string; error?: string }[] = [];
      
      for (const user of cloudUsers) {
        try {
          // Create user with specific ID
          const createResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/admin/users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SELFHOSTED_SERVICE_KEY,
              'Authorization': `Bearer ${SELFHOSTED_SERVICE_KEY}`
            },
            body: JSON.stringify({
              id: user.id, // Use same ID as cloud
              email: user.email,
              phone: user.phone || null,
              email_confirm: true,
              phone_confirm: !!user.phone_confirmed_at,
              user_metadata: user.user_metadata || {},
              app_metadata: user.app_metadata || {},
              password: 'TempPassword123!'
            })
          });

          if (createResponse.ok) {
            results.push({ email: user.email, id: user.id, status: 'created' });
          } else {
            const errorText = await createResponse.text();
            results.push({ email: user.email, id: user.id, status: 'error', error: errorText });
          }
        } catch (e) {
          results.push({ email: user.email, id: user.id, status: 'error', error: e.message });
        }
      }

      // Step 5: Re-migrate profiles and user_roles from cloud
      console.log('Re-migrating profiles and user_roles from cloud...');
      let profilesMigrated = 0;
      let rolesMigrated = 0;

      // Migrate profiles
      const { data: cloudProfiles } = await cloudClient.from('profiles').select('*');
      if (cloudProfiles && cloudProfiles.length > 0) {
        for (const profile of cloudProfiles) {
          const { error } = await selfHostedClient.from('profiles').upsert(profile, { onConflict: 'id' });
          if (!error) profilesMigrated++;
        }
      }

      // Migrate user_roles
      const { data: cloudRoles } = await cloudClient.from('user_roles').select('*');
      if (cloudRoles && cloudRoles.length > 0) {
        for (const role of cloudRoles) {
          const { error } = await selfHostedClient.from('user_roles').upsert(role, { onConflict: 'id' });
          if (!error) rolesMigrated++;
        }
      }

      const successCount = results.filter(r => r.status === 'created').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      return new Response(JSON.stringify({
        success: true,
        action: 'migrate-auth',
        data: {
          cloud_users: cloudUsers.length,
          deleted_from_selfhosted: deletedCount,
          users_created: successCount,
          users_errors: errorCount,
          profiles_migrated: profilesMigrated,
          roles_migrated: rolesMigrated,
          results,
          note: 'Users migrated. All users need to reset passwords via "Forgot Password".'
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== PREVIEW =====
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
            selfHostedCount = -1;
          }

          preview[table] = {
            cloud: cloudCount || 0,
            selfhosted: selfHostedCount
          };
        } catch (e) {
          preview[table] = { cloud: -1, selfhosted: -1 };
        }
      }

      // Also preview auth users
      let authPreview = { cloud: 0, selfhosted: 0 };
      try {
        const cloudAuth = await fetch(`${CLOUD_URL}/auth/v1/admin/users?per_page=1`, {
          headers: {
            'apikey': CLOUD_SERVICE_KEY,
            'Authorization': `Bearer ${CLOUD_SERVICE_KEY}`
          }
        });
        if (cloudAuth.ok) {
          const data = await cloudAuth.json();
          authPreview.cloud = data.total || data.users?.length || 0;
        }
      } catch {}

      try {
        const selfAuth = await fetch(`${SELFHOSTED_URL}/auth/v1/admin/users?per_page=1`, {
          headers: {
            'apikey': SELFHOSTED_SERVICE_KEY,
            'Authorization': `Bearer ${SELFHOSTED_SERVICE_KEY}`
          }
        });
        if (selfAuth.ok) {
          const data = await selfAuth.json();
          authPreview.selfhosted = data.total || data.users?.length || 0;
        }
      } catch {}

      const totalCloud = Object.values(preview).reduce((sum, v) => sum + (v.cloud > 0 ? v.cloud : 0), 0);
      const existingTables = Object.values(preview).filter(v => v.selfhosted >= 0).length;
      const missingTables = Object.values(preview).filter(v => v.selfhosted < 0).length;

      return new Response(JSON.stringify({
        success: true,
        action: 'preview',
        data: {
          auth: authPreview,
          tables: preview,
          summary: {
            total_tables: ALL_TABLES.length,
            existing_on_selfhosted: existingTables,
            missing_on_selfhosted: missingTables,
            total_cloud_records: totalCloud,
            auth_users_cloud: authPreview.cloud,
            auth_users_selfhosted: authPreview.selfhosted
          },
          warning: 'Esta ação irá SOBRESCREVER todos os dados no self-hosted!'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== MIGRATE PUBLIC SCHEMA =====
    if (action === 'migrate' && confirm === 'CONFIRMO_MIGRAR_TUDO') {
      console.log('Starting full migration from Cloud to Self-hosted...');
      const results: MigrationResult[] = [];
      const tablesToMigrate = tables && tables.length > 0 ? tables : ALL_TABLES;
      const BATCH_SIZE = 500;

      for (const table of tablesToMigrate) {
        console.log(`\n=== Migrating table: ${table} ===`);
        
        try {
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

          console.log(`Cleaning ${table} on self-hosted...`);
          try {
            await selfHostedClient.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
          } catch {
            try {
              await selfHostedClient.from(table).delete().gte('id', 0);
            } catch (e) {
              console.log(`Could not clean ${table}: ${e.message}`);
            }
          }

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

            const { error: insertError } = await selfHostedClient
              .from(table)
              .insert(batch);

            if (insertError) {
              console.log(`Error inserting into ${table}: ${insertError.message}`);
              for (const record of batch) {
                try {
                  await selfHostedClient.from(table).insert(record);
                  migratedCount++;
                } catch {}
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
        migrate: 'action: "migrate", confirm: "CONFIRMO_MIGRAR_TUDO" - migra schema public',
        migrate_auth: 'action: "migrate-auth" - migra usuários do auth schema'
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
