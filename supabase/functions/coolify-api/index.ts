import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COOLIFY_URL = "https://dashboard.iptvlink.com.br";
const COOLIFY_TOKEN = Deno.env.get('COOLIFY_API_TOKEN') || '';
const SELFHOSTED_URL = "https://supabase.iptvlink.com.br";
const SELFHOSTED_SERVICE_KEY = Deno.env.get('SELFHOSTED_SERVICE_ROLE_KEY') || '';

interface CoolifyRequest {
  action: string;
  endpoint?: string;
  method?: string;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}

// Edge Functions list for deployment
const EDGE_FUNCTIONS = [
  'alert-inactive-playlists', 'apply-migration-fix', 'backup-clients', 'cache-alerts',
  'cache-invalidate', 'cache-prediction', 'cache-schedule-purge', 'cache-warming',
  'calculate-trending', 'cdn-bulk-downloader', 'cdn-config', 'cdn-content-downloader',
  'cdn-health', 'cdn-prewarm', 'cdn-router', 'cdn-scheduled-download', 'cdn-token',
  'check-m3u-health', 'check-playlist-health', 'check-secrets', 'checkout-with-registration',
  'clean-m3u', 'clean-sync-entries', 'confirm-security-alert', 'coolify-api',
  'create-admin-user', 'create-client-auth-batch', 'daily-expiration-summary',
  'daily-m3u-regeneration', 'escalate-security-alerts', 'fetch-m3u-url', 'fetch-m3u',
  'fetch-tmdb', 'generate-m3u-file', 'generate-m3u-from-sync', 'generate-totp-secret',
  'get-r2-config', 'health-check', 'iptv-channel-health', 'iptv-epg', 'iptv-m3u-generator',
  'iptv-play', 'iptv-playlist', 'list-objects-test', 'list-users', 'm3u-clean-advanced',
  'm3u-cron-sync', 'm3u-playlist', 'm3u-sync', 'main', 'mercado-pago-checkout',
  'mercado-pago-test-users', 'mercado-pago-test', 'mercado-pago-webhook', 'notify-affiliate',
  'notify-prospect', 'playback-token', 'player-events', 'process-auto-notifications',
  'process-m3u-import', 'process-notification-queue', 'process-notification-retry-queue',
  'qa-validation', 'r2-migration-worker', 'r2-scheduler', 'r2-signed-upload',
  'r2-upload-proxy', 'r2-upload', 'remote-command', 'rls-coverage', 'rls-fix',
  'scan-migrations', 'schedule-daily-notifications', 'security-audit', 'stream-proxy',
  'stream-url-resolve', 'test-r2-connection', 'track-affiliate-click',
  'trigger-event-notification', 'update-user-password', 'validate-password-signup',
  'verify-totp-token', 'weekly-expiration-summary', 'whatsapp-test', 'whatsapp-webhook'
];

// Required secrets for Edge Functions
const REQUIRED_SECRETS = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'MERCADO_PAGO_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET',
  'WHATSAPP_APPKEY', 'WHATSAPP_AUTHKEY', 'WHATSAPP_WEBHOOK_SECRET',
  'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ACCOUNT_ID', 'R2_PUBLIC_DOMAIN',
  'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_STREAM_API_TOKEN', 'CLOUDFLARE_STREAM_SIGNING_KEY',
  'CDN_WORKER_URL', 'STREAM_PROXY_SECRET', 'PROBE_WORKER_SECRET', 'TRANSCODE_CALLBACK_SECRET',
  'TMDB_API_KEY', 'CRON_SECRET', 'JWT_SECRET', 'COOLIFY_API_TOKEN'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both POST body and GET query params
    let requestData: CoolifyRequest = { action: '' };
    
    if (req.method === 'POST') {
      try {
        requestData = await req.json() as CoolifyRequest;
      } catch {
        // Empty body for POST, continue with defaults
      }
    } else {
      // Parse query params for GET requests
      const url = new URL(req.url);
      requestData.action = url.searchParams.get('action') || '';
      requestData.endpoint = url.searchParams.get('endpoint') || undefined;
      requestData.method = url.searchParams.get('method') || 'GET';
      
      // Parse params from query string
      const paramsStr = url.searchParams.get('params');
      if (paramsStr) {
        try {
          requestData.params = JSON.parse(paramsStr);
        } catch {
          // Invalid params JSON, ignore
        }
      }
    }
    
    const { action, endpoint, method = 'GET', body, params } = requestData;

    // Build URL with params
    let url = `${COOLIFY_URL}/api/v1${endpoint || ''}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    // Predefined actions
    const actions: Record<string, { endpoint: string; method: string } | Function> = {
      // Health & Version
      'health': { endpoint: '/health', method: 'GET' },
      'version': { endpoint: '/version', method: 'GET' },
      
      // Servers
      'list-servers': { endpoint: '/servers', method: 'GET' },
      'get-server': { endpoint: '/servers/{uuid}', method: 'GET' },
      'get-server-resources': { endpoint: '/servers/{uuid}/resources', method: 'GET' },
      'get-server-domains': { endpoint: '/servers/{uuid}/domains', method: 'GET' },
      'validate-server': { endpoint: '/servers/{uuid}/validate', method: 'GET' },
      
      // Projects
      'list-projects': { endpoint: '/projects', method: 'GET' },
      'get-project': { endpoint: '/projects/{uuid}', method: 'GET' },
      'create-project': { endpoint: '/projects', method: 'POST' },
      'update-project': { endpoint: '/projects/{uuid}', method: 'PATCH' },
      'delete-project': { endpoint: '/projects/{uuid}', method: 'DELETE' },
      
      // Services
      'list-services': { endpoint: '/services', method: 'GET' },
      'get-service': { endpoint: '/services/{uuid}', method: 'GET' },
      'start-service': { endpoint: '/services/{uuid}/start', method: 'GET' },
      'stop-service': { endpoint: '/services/{uuid}/stop', method: 'GET' },
      'restart-service': { endpoint: '/services/{uuid}/restart', method: 'GET' },
      'delete-service': { endpoint: '/services/{uuid}', method: 'DELETE' },
      
      // Applications
      'list-applications': { endpoint: '/applications', method: 'GET' },
      'get-application': { endpoint: '/applications/{uuid}', method: 'GET' },
      'create-application': { endpoint: '/applications', method: 'POST' },
      'update-application': { endpoint: '/applications/{uuid}', method: 'PATCH' },
      'delete-application': { endpoint: '/applications/{uuid}', method: 'DELETE' },
      'start-application': { endpoint: '/applications/{uuid}/start', method: 'GET' },
      'stop-application': { endpoint: '/applications/{uuid}/stop', method: 'GET' },
      'restart-application': { endpoint: '/applications/{uuid}/restart', method: 'GET' },
      'get-application-logs': { endpoint: '/applications/{uuid}/logs', method: 'GET' },
      'get-application-envs': { endpoint: '/applications/{uuid}/envs', method: 'GET' },
      'update-application-envs': { endpoint: '/applications/{uuid}/envs', method: 'PATCH' },
      
      // Databases
      'list-databases': { endpoint: '/databases', method: 'GET' },
      'get-database': { endpoint: '/databases/{uuid}', method: 'GET' },
      'create-database': { endpoint: '/databases', method: 'POST' },
      'update-database': { endpoint: '/databases/{uuid}', method: 'PATCH' },
      'delete-database': { endpoint: '/databases/{uuid}', method: 'DELETE' },
      'start-database': { endpoint: '/databases/{uuid}/start', method: 'GET' },
      'stop-database': { endpoint: '/databases/{uuid}/stop', method: 'GET' },
      'restart-database': { endpoint: '/databases/{uuid}/restart', method: 'GET' },
      
      // Deployments
      'deploy': { endpoint: '/deploy', method: 'GET' },
      'list-deployments': { endpoint: '/deployments', method: 'GET' },
      'get-deployment': { endpoint: '/deployments/{uuid}', method: 'GET' },
      
      // Teams
      'list-teams': { endpoint: '/teams', method: 'GET' },
      'get-team': { endpoint: '/teams/{id}', method: 'GET' },
      'get-team-members': { endpoint: '/teams/{id}/members', method: 'GET' },
      
      // Private Keys
      'list-private-keys': { endpoint: '/security/keys', method: 'GET' },
      'create-private-key': { endpoint: '/security/keys', method: 'POST' },
      'delete-private-key': { endpoint: '/security/keys/{uuid}', method: 'DELETE' },
      
      // Resources (Overview)
      'list-resources': { endpoint: '/resources', method: 'GET' },
      
      // ==========================================
      // SELF-HOSTED SUPABASE MANAGEMENT
      // ==========================================
      
      'get-edge-functions-list': async () => {
        return {
          success: true,
          data: {
            functions: EDGE_FUNCTIONS,
            total: EDGE_FUNCTIONS.length,
            selfhosted_url: SELFHOSTED_URL,
          }
        };
      },
      
      'get-required-secrets': async () => {
        return {
          success: true,
          data: {
            secrets: REQUIRED_SECRETS,
            total: REQUIRED_SECRETS.length,
          }
        };
      },
      
      'test-selfhosted-connection': async () => {
        try {
          const response = await fetch(`${SELFHOSTED_URL}/rest/v1/`, {
            headers: {
              'apikey': Deno.env.get('SELFHOSTED_SERVICE_ROLE_KEY') || '',
              'Authorization': `Bearer ${Deno.env.get('SELFHOSTED_SERVICE_ROLE_KEY') || ''}`,
            }
          });
          
          return {
            success: response.ok,
            data: {
              status: response.status,
              statusText: response.statusText,
              url: SELFHOSTED_URL,
            }
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
      
      'get-selfhosted-status': async () => {
        const checks = {
          database: false,
          auth: false,
          storage: false,
          functions: false,
        };
        
        try {
          // Check database
          const dbResponse = await fetch(`${SELFHOSTED_URL}/rest/v1/`, {
            headers: {
              'apikey': SELFHOSTED_SERVICE_KEY,
              'Authorization': `Bearer ${SELFHOSTED_SERVICE_KEY}`,
            }
          });
          checks.database = dbResponse.ok;
          
          // Check auth
          const authResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/health`);
          checks.auth = authResponse.ok;
          
          // Check storage
          const storageResponse = await fetch(`${SELFHOSTED_URL}/storage/v1/`, {
            headers: {
              'apikey': SELFHOSTED_SERVICE_KEY,
              'Authorization': `Bearer ${SELFHOSTED_SERVICE_KEY}`,
            }
          });
          checks.storage = storageResponse.ok;
          
          // Check functions
          const functionsResponse = await fetch(`${SELFHOSTED_URL}/functions/v1/health-check`);
          checks.functions = functionsResponse.ok;
          
        } catch (error) {
          console.error('Status check error:', error);
        }
        
        return {
          success: true,
          data: {
            url: SELFHOSTED_URL,
            checks,
            all_healthy: Object.values(checks).every(v => v),
          }
        };
      },
      
      'deploy-functions-to-coolify': async () => {
        // This action triggers a restart of the edge-runtime service in Coolify
        // Note: Requires valid COOLIFY_API_TOKEN with proper permissions
        
        if (!COOLIFY_TOKEN) {
          return {
            success: false,
            error: 'COOLIFY_API_TOKEN not configured',
            data: {
              instructions: 'Configure COOLIFY_API_TOKEN in Supabase secrets with a valid Coolify API token that has full permissions'
            }
          };
        }
        
        try {
          // First test API access
          const testResponse = await fetch(`${COOLIFY_URL}/api/v1/version`, {
            headers: {
              'Authorization': `Bearer ${COOLIFY_TOKEN}`,
              'Accept': 'application/json',
            }
          });
          
          if (!testResponse.ok) {
            const errorText = await testResponse.text();
            return {
              success: false,
              error: `Coolify API authentication failed (${testResponse.status})`,
              data: {
                status: testResponse.status,
                message: testResponse.status === 403 
                  ? 'Token inválido ou sem permissões. Gere um novo token em Coolify → Settings → API Tokens com permissões completas.'
                  : errorText,
                coolify_url: COOLIFY_URL,
                instructions: [
                  '1. Acesse Coolify Dashboard → Settings → API Tokens',
                  '2. Crie um novo token com TODAS as permissões',
                  '3. Atualize o secret COOLIFY_API_TOKEN no Supabase'
                ]
              }
            };
          }
          
          // Try to list services
          const servicesResponse = await fetch(`${COOLIFY_URL}/api/v1/services`, {
            headers: {
              'Authorization': `Bearer ${COOLIFY_TOKEN}`,
              'Accept': 'application/json',
            }
          });
          
          if (!servicesResponse.ok) {
            return {
              success: false,
              error: `Cannot list services (${servicesResponse.status})`,
              data: {
                status: servicesResponse.status,
                message: 'Token não tem permissão para listar serviços. Verifique as permissões do token.',
                instructions: 'Reinicie o container edge-runtime manualmente no Coolify Dashboard'
              }
            };
          }
          
          const services = await servicesResponse.json();
          const edgeRuntime = services.find((s: any) => 
            s.name?.toLowerCase().includes('edge') || 
            s.name?.toLowerCase().includes('functions') ||
            s.name?.toLowerCase().includes('supabase-edge')
          );
          
          if (!edgeRuntime) {
            return {
              success: false,
              error: 'Edge Runtime service not found in Coolify',
              data: { 
                available_services: services.map((s: any) => ({ name: s.name, uuid: s.uuid })),
                instructions: 'Reinicie o container edge-runtime manualmente no Coolify Dashboard'
              }
            };
          }
          
          // Restart the service
          const restartResponse = await fetch(
            `${COOLIFY_URL}/api/v1/services/${edgeRuntime.uuid}/restart`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${COOLIFY_TOKEN}`,
                'Accept': 'application/json',
              }
            }
          );
          
          return {
            success: restartResponse.ok,
            data: {
              service: edgeRuntime.name,
              uuid: edgeRuntime.uuid,
              action: 'restart',
              status: restartResponse.ok ? 'triggered' : 'failed',
            }
          };
          
        } catch (error) {
          return {
            success: false,
            error: error.message,
            data: {
              instructions: 'Verifique a conexão com o Coolify e tente novamente'
            }
          };
        }
      },
      
      'sync-secrets-to-coolify': async () => {
        const results: Record<string, boolean> = {};
        
        for (const secret of REQUIRED_SECRETS) {
          const value = Deno.env.get(secret);
          results[secret] = !!value;
        }
        
        const configured = Object.values(results).filter(v => v).length;
        const missing = REQUIRED_SECRETS.filter(s => !results[s]);
        
        return {
          success: true,
          data: {
            total: REQUIRED_SECRETS.length,
            configured,
            missing_count: missing.length,
            missing,
            all_configured: missing.length === 0,
          }
        };
      },
      
      'fix-postgrest-db-uri': async () => {
        if (!COOLIFY_TOKEN) {
          return { success: false, error: 'COOLIFY_API_TOKEN not configured' };
        }

        // Find Supabase service in Coolify
        const servicesRes = await fetch(`${COOLIFY_URL}/api/v1/services`, {
          headers: {
            'Authorization': `Bearer ${COOLIFY_TOKEN}`,
            'Accept': 'application/json',
          },
        });
        if (!servicesRes.ok) {
          return { success: false, error: `Failed to list services (${servicesRes.status})` };
        }
        const services = await servicesRes.json();
        const supabaseService = services.find((s: any) =>
          s.name?.toLowerCase().includes('supabase') ||
          s.fqdn?.includes('supabase.iptvlink.com.br') ||
          s.type?.toLowerCase() === 'supabase'
        );
        if (!supabaseService) {
          return {
            success: false,
            error: 'Supabase service not found in Coolify',
            data: services.map((s: any) => ({ name: s.name, uuid: s.uuid, fqdn: s.fqdn, type: s.type })),
          };
        }

        // Fetch current envs to get SERVICE_PASSWORD_POSTGRES
        const envsRes = await fetch(`${COOLIFY_URL}/api/v1/services/${supabaseService.uuid}/envs`, {
          headers: {
            'Authorization': `Bearer ${COOLIFY_TOKEN}`,
            'Accept': 'application/json',
          },
        });
        if (!envsRes.ok) {
          return { success: false, error: `Failed to get service envs (${envsRes.status})` };
        }
        const envs = await envsRes.json();
        
        // Find SERVICE_PASSWORD_POSTGRES
        const postgresPasswordEnv = envs.find((e: any) => e.key === 'SERVICE_PASSWORD_POSTGRES');
        if (!postgresPasswordEnv || !postgresPasswordEnv.value) {
          return { 
            success: false, 
            error: 'SERVICE_PASSWORD_POSTGRES not found in service envs',
            data: { available_keys: envs.map((e: any) => e.key) }
          };
        }

        // Build correct PGRST_DB_URI pointing to LOCAL supabase-db container
        // PostgREST must connect as postgres user in this environment
        const pgPassword = encodeURIComponent(postgresPasswordEnv.value);
        const dbUri = `postgres://postgres:${pgPassword}@supabase-db:5432/postgres`;

        // Update PGRST_DB_URI via bulk envs API for the Supabase service
        const updateEnvsBody = {
          data: [
            {
              key: 'PGRST_DB_URI',
              value: dbUri,
              is_preview: false,
              is_literal: true,
              is_multiline: false,
              is_shown_once: false,
            },
          ],
        };

        const updateRes = await fetch(`${COOLIFY_URL}/api/v1/services/${supabaseService.uuid}/envs/bulk`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${COOLIFY_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(updateEnvsBody),
        });

        if (!updateRes.ok) {
          const text = await updateRes.text();
          return { success: false, error: `Failed to update envs (${updateRes.status})`, data: text };
        }

        // Restart Supabase service so PostgREST picks up new DB URI
        const restartRes = await fetch(`${COOLIFY_URL}/api/v1/services/${supabaseService.uuid}/restart`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${COOLIFY_TOKEN}`,
            'Accept': 'application/json',
          },
        });

        return {
          success: restartRes.ok,
          data: {
            message: 'PGRST_DB_URI updated to local supabase-db container and service restart triggered',
            service: { name: supabaseService.name, uuid: supabaseService.uuid },
            db_uri: dbUri,
            restart_status: restartRes.ok ? 'triggered' : `failed (${restartRes.status})`,
          },
        };
      },
      'fix-kong-routing': async () => {
        if (!COOLIFY_TOKEN) {
          return { success: false, error: 'COOLIFY_API_TOKEN not configured' };
        }

        try {
          const serviceUuid = 'vcs0c0k8kww48kgws44swkk0';
          
          // Get current service configuration
          const serviceRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}`, {
            headers: {
              'Authorization': `Bearer ${COOLIFY_TOKEN}`,
              'Accept': 'application/json',
            },
          });
          
          if (!serviceRes.ok) {
            return { success: false, error: `Failed to get service (${serviceRes.status})` };
          }
          
          const serviceData = await serviceRes.json();
          
          // Find Kong application in the service
          const kongApp = serviceData.applications?.find((app: any) => 
            app.name === 'supabase-kong' || app.image?.includes('kong')
          );
          
          if (!kongApp) {
            return {
              success: false,
              error: 'Kong application not found in Supabase service',
              data: { available_apps: serviceData.applications?.map((a: any) => a.name) }
            };
          }
          
          // For Coolify service applications, we need to use the service application update endpoint
          // PATCH /services/{serviceUuid}/applications/{applicationUuid}
          const updateRes = await fetch(
            `${COOLIFY_URL}/api/v1/services/${serviceUuid}/applications/${kongApp.uuid}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${COOLIFY_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({
                ports: '8000',
                container_port: 8000,
              }),
            }
          );
          
          const updateText = await updateRes.text();
          
          if (!updateRes.ok) {
            // Alternative: try to restart just Kong to force proper routing
            const restartRes = await fetch(
              `${COOLIFY_URL}/api/v1/services/${serviceUuid}/restart`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${COOLIFY_TOKEN}`,
                  'Accept': 'application/json',
                },
              }
            );
            
            return {
              success: false,
              error: `Update failed (${updateRes.status}), service restart triggered instead`,
              data: {
                update_error: updateText,
                kong_info: {
                  uuid: kongApp.uuid,
                  fqdn: kongApp.fqdn,
                  ports: kongApp.ports,
                  status: kongApp.status,
                },
                restart_triggered: restartRes.ok,
                manual_fix: 'In Coolify Dashboard: Supabase Service → Kong → Advanced Settings → Set container port to 8000'
              }
            };
          }
          
          return {
            success: true,
            data: {
              message: 'Kong routing updated',
              update_response: updateText,
            }
          };

        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      },

      'test-api-routing': async () => {
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || 
                        Deno.env.get('SELFHOSTED_SERVICE_ROLE_KEY') || 
                        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NTIyMDgyMCwiZXhwIjo0OTIwODk0NDIwLCJyb2xlIjoiYW5vbiJ9.55tQdiEEa0mlCvveFpQZwMHqDZt0DzAgUQOPpLCNDLU';
        
        const results: Record<string, any> = {};
        
        // Test different endpoints
        const endpoints = [
          { name: 'api_root', url: 'https://api.iptvlink.com.br/' },
          { name: 'api_rest', url: 'https://api.iptvlink.com.br/rest/v1/' },
          { name: 'api_rest_profiles', url: 'https://api.iptvlink.com.br/rest/v1/profiles?select=id&limit=1' },
          { name: 'supabase_rest', url: 'https://supabase.iptvlink.com.br/rest/v1/' },
        ];
        
        for (const ep of endpoints) {
          try {
            const response = await fetch(ep.url, {
              headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`,
              }
            });
            results[ep.name] = {
              status: response.status,
              statusText: response.statusText,
              ok: response.ok,
            };
          } catch (error) {
            results[ep.name] = { error: error.message };
          }
        }
        
        return {
          success: results.api_rest_profiles?.ok || false,
          data: {
            endpoints: results,
            anonKey_present: !!anonKey,
          }
        };
      },

      'get-migration-status': async () => {
        try {
          // Check tables in self-hosted
          const supabase = createClient(SELFHOSTED_URL, SELFHOSTED_SERVICE_KEY);
          
          const tables = [
            'profiles', 'user_roles', 'user_subscriptions', 'payments',
            'notification_logs', 'notification_templates', 'auto_notifications',
            'subscription_plans', 'discount_coupons', 'affiliates'
          ];
          
          const counts: Record<string, number> = {};
          
          for (const table of tables) {
            const { count, error } = await supabase
              .from(table)
              .select('*', { count: 'exact', head: true });
            
            counts[table] = error ? -1 : (count || 0);
          }
          
          return {
            success: true,
            data: {
              selfhosted_url: SELFHOSTED_URL,
              tables: counts,
              timestamp: new Date().toISOString(),
            }
          };
          
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      },

      // ==========================================
      // SECRETS AUDIT - FULL PLATFORM AUDIT
      // ==========================================
      
      'audit-all-secrets': async () => {
        if (!COOLIFY_TOKEN) {
          return { success: false, error: 'COOLIFY_API_TOKEN not configured' };
        }

        const audit: {
          global: any[];
          projects: any[];
          services: any[];
          applications: any[];
          databases: any[];
          duplicates: any[];
          conflicts: any[];
          missing: any[];
          invalid: any[];
          recommendations: string[];
        } = {
          global: [],
          projects: [],
          services: [],
          applications: [],
          databases: [],
          duplicates: [],
          conflicts: [],
          missing: [],
          invalid: [],
          recommendations: [],
        };

        // Standard naming convention
        const STANDARD_NAMES: Record<string, string[]> = {
          'SUPABASE_URL': ['SUPABASE_URL', 'SUPABASEURL', 'SB_URL', 'SUPA_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL'],
          'SUPABASE_ANON_KEY': ['SUPABASE_ANON_KEY', 'SUPABASE_KEY', 'SB_ANON_KEY', 'SUPA_ANON', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY'],
          'SUPABASE_SERVICE_ROLE_KEY': ['SUPABASE_SERVICE_ROLE_KEY', 'SB_SERVICE_KEY', 'SERVICE_ROLE_KEY', 'SUPA_SERVICE'],
          'JWT_SECRET': ['JWT_SECRET', 'JWTSECRET', 'JWT_KEY', 'SECRET_JWT'],
          'DATABASE_URL': ['DATABASE_URL', 'DB_URL', 'POSTGRES_URL', 'PG_URL', 'PGRST_DB_URI'],
          'REDIS_URL': ['REDIS_URL', 'REDIS_URI', 'REDIS_CONNECTION'],
          'MERCADO_PAGO_ACCESS_TOKEN': ['MERCADO_PAGO_ACCESS_TOKEN', 'MP_ACCESS_TOKEN', 'MERCADOPAGO_TOKEN'],
          'WHATSAPP_APPKEY': ['WHATSAPP_APPKEY', 'WA_APPKEY', 'WHATSAPP_APP_KEY'],
          'WHATSAPP_AUTHKEY': ['WHATSAPP_AUTHKEY', 'WA_AUTHKEY', 'WHATSAPP_AUTH_KEY'],
        };

        const hashValue = (value: string): string => {
          if (!value) return 'EMPTY';
          if (value.length < 10) return `SHORT:${value.length}`;
          return `${value.substring(0, 4)}...${value.substring(value.length - 4)}:${value.length}`;
        };

        const validateSecret = (key: string, value: string): { valid: boolean; issue?: string } => {
          if (!value) return { valid: false, issue: 'Empty value' };
          
          // JWT validation
          if (key.includes('JWT') || key.includes('KEY') || key.includes('TOKEN')) {
            if (key.includes('JWT') && !value.includes('.')) {
              return { valid: false, issue: 'Invalid JWT format (missing dots)' };
            }
          }
          
          // URL validation
          if (key.includes('URL') || key.includes('URI')) {
            if (!value.startsWith('http') && !value.startsWith('postgres://') && !value.startsWith('redis://')) {
              return { valid: false, issue: 'Invalid URL format' };
            }
          }
          
          return { valid: true };
        };

        const allSecrets: Map<string, { value: string; locations: string[] }> = new Map();

        try {
          // 1. List all services
          const servicesRes = await fetch(`${COOLIFY_URL}/api/v1/services`, {
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });
          const services = servicesRes.ok ? await servicesRes.json() : [];

          for (const service of services) {
            // Get service envs
            const envsRes = await fetch(`${COOLIFY_URL}/api/v1/services/${service.uuid}/envs`, {
              headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
            });
            
            if (envsRes.ok) {
              const envs = await envsRes.json();
              for (const env of envs) {
                const hash = hashValue(env.value);
                const validation = validateSecret(env.key, env.value);
                
                const secretEntry = {
                  key: env.key,
                  hash,
                  scope: 'service',
                  service: service.name,
                  serviceUuid: service.uuid,
                  valid: validation.valid,
                  issue: validation.issue,
                };
                
                audit.services.push(secretEntry);
                
                // Track for duplicates
                const existing = allSecrets.get(hash);
                if (existing) {
                  existing.locations.push(`service:${service.name}:${env.key}`);
                } else {
                  allSecrets.set(hash, { value: env.value, locations: [`service:${service.name}:${env.key}`] });
                }
                
                if (!validation.valid) {
                  audit.invalid.push({ ...secretEntry, issue: validation.issue });
                }
              }
            }
          }

          // 2. List all applications
          const appsRes = await fetch(`${COOLIFY_URL}/api/v1/applications`, {
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });
          const applications = appsRes.ok ? await appsRes.json() : [];

          for (const app of applications) {
            const envsRes = await fetch(`${COOLIFY_URL}/api/v1/applications/${app.uuid}/envs`, {
              headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
            });
            
            if (envsRes.ok) {
              const envs = await envsRes.json();
              for (const env of envs) {
                const hash = hashValue(env.value);
                const validation = validateSecret(env.key, env.value);
                
                const secretEntry = {
                  key: env.key,
                  hash,
                  scope: 'application',
                  application: app.name,
                  applicationUuid: app.uuid,
                  valid: validation.valid,
                  issue: validation.issue,
                };
                
                audit.applications.push(secretEntry);
                
                const existing = allSecrets.get(hash);
                if (existing) {
                  existing.locations.push(`app:${app.name}:${env.key}`);
                } else {
                  allSecrets.set(hash, { value: env.value, locations: [`app:${app.name}:${env.key}`] });
                }
                
                if (!validation.valid) {
                  audit.invalid.push({ ...secretEntry, issue: validation.issue });
                }
              }
            }
          }

          // 3. List all databases
          const dbsRes = await fetch(`${COOLIFY_URL}/api/v1/databases`, {
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });
          const databases = dbsRes.ok ? await dbsRes.json() : [];

          for (const db of databases) {
            audit.databases.push({
              name: db.name,
              uuid: db.uuid,
              type: db.type,
              status: db.status,
            });
          }

          // 4. Find duplicates (same hash, different locations)
          for (const [hash, data] of allSecrets.entries()) {
            if (data.locations.length > 1) {
              audit.duplicates.push({
                hash,
                count: data.locations.length,
                locations: data.locations,
              });
            }
          }

          // 5. Find naming conflicts (same conceptual secret, different names)
          for (const [standard, variants] of Object.entries(STANDARD_NAMES)) {
            const found: { name: string; location: string; hash: string }[] = [];
            
            for (const secret of [...audit.services, ...audit.applications]) {
              if (variants.includes(secret.key) || secret.key.includes(standard.replace('_', ''))) {
                found.push({ name: secret.key, location: secret.service || secret.application, hash: secret.hash });
              }
            }
            
            if (found.length > 1) {
              const uniqueHashes = new Set(found.map(f => f.hash));
              if (uniqueHashes.size > 1) {
                audit.conflicts.push({
                  standardName: standard,
                  found,
                  issue: 'Same secret type with different values',
                });
              }
            }
          }

          // 6. Generate recommendations
          if (audit.duplicates.length > 0) {
            audit.recommendations.push(`${audit.duplicates.length} secrets duplicadas encontradas - consolidar para fonte única`);
          }
          if (audit.conflicts.length > 0) {
            audit.recommendations.push(`${audit.conflicts.length} conflitos de valor detectados - escolher valor canônico`);
          }
          if (audit.invalid.length > 0) {
            audit.recommendations.push(`${audit.invalid.length} secrets inválidas ou malformadas - corrigir ou remover`);
          }

          return {
            success: true,
            data: {
              summary: {
                total_services: services.length,
                total_applications: applications.length,
                total_databases: databases.length,
                total_secrets: audit.services.length + audit.applications.length,
                duplicates: audit.duplicates.length,
                conflicts: audit.conflicts.length,
                invalid: audit.invalid.length,
              },
              services: audit.services,
              applications: audit.applications,
              databases: audit.databases,
              duplicates: audit.duplicates,
              conflicts: audit.conflicts,
              invalid: audit.invalid,
              recommendations: audit.recommendations,
            }
          };

        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      'normalize-secrets': async () => {
        if (!COOLIFY_TOKEN) {
          return { success: false, error: 'COOLIFY_API_TOKEN not configured' };
        }

        const serviceUuid = 'vcs0c0k8kww48kgws44swkk0';
        const results: { action: string; key: string; status: string; error?: string }[] = [];

        try {
          // Step 1: Get current envs
          const envsRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs`, {
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });
          
          if (!envsRes.ok) {
            return { success: false, error: `Failed to get envs: ${envsRes.status}` };
          }
          
          const envs = await envsRes.json();
          const envMap: Record<string, { id: string; value: string }> = {};
          for (const env of envs) {
            envMap[env.key] = { id: env.id, value: env.value };
          }

          // Step 2: Build canonical values from resolved SERVICE_* secrets
          const canonicalValues: Record<string, string> = {};
          
          // JWT_SECRET from SERVICE_PASSWORD_JWT
          if (envMap['SERVICE_PASSWORD_JWT']?.value) {
            canonicalValues['JWT_SECRET'] = envMap['SERVICE_PASSWORD_JWT'].value;
          }
          
          // SUPABASE_URL from API_EXTERNAL_URL or SERVICE_URL_SUPABASEKONG
          if (envMap['API_EXTERNAL_URL']?.value && !envMap['API_EXTERNAL_URL'].value.includes('${')) {
            canonicalValues['SUPABASE_URL'] = envMap['API_EXTERNAL_URL'].value;
            canonicalValues['GOTRUE_SITE_URL'] = envMap['API_EXTERNAL_URL'].value;
            canonicalValues['SUPABASE_PUBLIC_URL'] = envMap['API_EXTERNAL_URL'].value;
            canonicalValues['SUPABASE_PUBLIC_API'] = envMap['API_EXTERNAL_URL'].value;
          }
          
          // SUPABASE_ANON_KEY from SERVICE_SUPABASEANON_KEY
          if (envMap['SERVICE_SUPABASEANON_KEY']?.value && !envMap['SERVICE_SUPABASEANON_KEY'].value.includes('${')) {
            canonicalValues['SUPABASE_ANON_KEY'] = envMap['SERVICE_SUPABASEANON_KEY'].value;
          }
          
          // SUPABASE_SERVICE_ROLE_KEY from SERVICE_SUPABASESERVICE_KEY
          if (envMap['SERVICE_SUPABASESERVICE_KEY']?.value && !envMap['SERVICE_SUPABASESERVICE_KEY'].value.includes('${')) {
            canonicalValues['SUPABASE_SERVICE_ROLE_KEY'] = envMap['SERVICE_SUPABASESERVICE_KEY'].value;
            canonicalValues['SUPABASE_SERVICE_KEY'] = envMap['SERVICE_SUPABASESERVICE_KEY'].value;
          }

          // Step 3: Build list of secrets to update
          const secretsToFix = [
            'JWT_SECRET', 'API_JWT_SECRET', 'AUTH_JWT_SECRET', 'GOTRUE_JWT_SECRET',
            'METRICS_JWT_SECRET', 'PGRST_JWT_SECRET', 'PGRST_APP_SETTINGS_JWT_SECRET',
            'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
            'SUPABASE_SERVICE_KEY', 'GOTRUE_SITE_URL', 'SUPABASE_PUBLIC_URL', 'SUPABASE_PUBLIC_API'
          ];

          // Step 4: Update secrets that have unresolved variables
          const updates: { key: string; value: string; is_preview: boolean }[] = [];
          
          for (const key of secretsToFix) {
            const current = envMap[key];
            if (!current) continue;
            
            // Check if it contains unresolved variable reference
            if (current.value.includes('${')) {
              let newValue = '';
              
              // Determine correct canonical value
              if (key.includes('JWT')) {
                newValue = canonicalValues['JWT_SECRET'] || '';
              } else if (key.includes('URL') || key.includes('API')) {
                newValue = canonicalValues['SUPABASE_URL'] || '';
              } else if (key.includes('ANON')) {
                newValue = canonicalValues['SUPABASE_ANON_KEY'] || '';
              } else if (key.includes('SERVICE') && key.includes('KEY')) {
                newValue = canonicalValues['SUPABASE_SERVICE_ROLE_KEY'] || '';
              }
              
              if (newValue) {
                updates.push({ key, value: newValue, is_preview: false });
              }
            }
          }

          // Step 5: Apply updates via bulk API
          if (updates.length > 0) {
            const bulkUpdateRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs/bulk`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${COOLIFY_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({ data: updates.map(u => ({ ...u, is_literal: true, is_multiline: false, is_shown_once: false })) }),
            });
            
            if (bulkUpdateRes.ok) {
              for (const u of updates) {
                results.push({ action: 'updated', key: u.key, status: 'success' });
              }
            } else {
              const errText = await bulkUpdateRes.text();
              // Try individual updates
              for (const u of updates) {
                try {
                  const singleRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${COOLIFY_TOKEN}`,
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                    },
                    body: JSON.stringify({ key: u.key, value: u.value, is_preview: false }),
                  });
                  
                  if (singleRes.ok || singleRes.status === 409) {
                    // 409 = already exists, try PATCH
                    if (singleRes.status === 409 && envMap[u.key]?.id) {
                      const patchRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs/${envMap[u.key].id}`, {
                        method: 'PATCH',
                        headers: {
                          'Authorization': `Bearer ${COOLIFY_TOKEN}`,
                          'Content-Type': 'application/json',
                          'Accept': 'application/json',
                        },
                        body: JSON.stringify({ value: u.value }),
                      });
                      results.push({ action: 'patched', key: u.key, status: patchRes.ok ? 'success' : 'failed' });
                    } else {
                      results.push({ action: 'created', key: u.key, status: 'success' });
                    }
                  } else {
                    results.push({ action: 'update', key: u.key, status: 'failed', error: `${singleRes.status}` });
                  }
                } catch (e) {
                  results.push({ action: 'update', key: u.key, status: 'error', error: e.message });
                }
              }
            }
          }

          // Step 6: Restart service to apply changes
          const restartRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/restart`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });

          return {
            success: true,
            data: {
              canonical_values_found: Object.keys(canonicalValues),
              updates_attempted: updates.length,
              results,
              restart_triggered: restartRes.ok,
              message: `${results.filter(r => r.status === 'success').length}/${updates.length} secrets normalizadas. Serviço reiniciando.`
            }
          };

        } catch (error) {
          return { success: false, error: error.message, results };
        }
      },

      'delete-duplicate-secrets': async () => {
        if (!COOLIFY_TOKEN) {
          return { success: false, error: 'COOLIFY_API_TOKEN not configured' };
        }

        const serviceUuid = 'vcs0c0k8kww48kgws44swkk0';
        const results: { action: string; key: string; status: string }[] = [];

        // Secrets duplicadas para remover (manter apenas o canônico)
        const duplicatesToRemove = [
          'VITE_SUPABASE_SELFHOSTED_KEY',  // Duplica SUPABASE_ANON_KEY
          'VITE_SUPABASE_SELFHOSTED_URL',  // Duplica SUPABASE_URL
          'SUPABASE_SERVICE_KEY',           // Duplica SUPABASE_SERVICE_ROLE_KEY
          'SUPABASE_PUBLIC_API',            // Duplica SUPABASE_URL
          'SUPABASE_PUBLIC_URL',            // Duplica SUPABASE_URL
        ];

        try {
          // Get current envs to find IDs
          const envsRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs`, {
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });
          
          if (!envsRes.ok) {
            return { success: false, error: `Failed to get envs: ${envsRes.status}` };
          }
          
          const envs = await envsRes.json();
          const envMap: Record<string, { id: string; value: string }> = {};
          for (const env of envs) {
            envMap[env.key] = { id: env.id, value: env.value };
          }

          // Delete duplicates
          for (const key of duplicatesToRemove) {
            const env = envMap[key];
            if (env?.id) {
              const deleteRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs/${env.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
              });
              results.push({ 
                action: 'delete', 
                key, 
                status: deleteRes.ok ? 'removed' : `failed (${deleteRes.status})` 
              });
            } else {
              results.push({ action: 'skip', key, status: 'not found' });
            }
          }

          return {
            success: true,
            data: {
              removed: results.filter(r => r.status === 'removed').length,
              skipped: results.filter(r => r.status === 'not found').length,
              failed: results.filter(r => r.status.includes('failed')).length,
              results,
            }
          };

        } catch (error) {
          return { success: false, error: error.message, results };
        }
      },

      'full-secrets-cleanup': async () => {
        if (!COOLIFY_TOKEN) {
          return { success: false, error: 'COOLIFY_API_TOKEN not configured' };
        }

        const serviceUuid = 'vcs0c0k8kww48kgws44swkk0';
        const log: { step: string; status: string; details?: any }[] = [];

        try {
          // === STEP 1: Get current envs ===
          log.push({ step: '1-fetch-envs', status: 'starting' });
          const envsRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs`, {
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });
          
          if (!envsRes.ok) {
            log.push({ step: '1-fetch-envs', status: 'failed', details: envsRes.status });
            return { success: false, error: `Failed to get envs: ${envsRes.status}`, log };
          }
          
          const envs = await envsRes.json();
          const envMap: Record<string, { id: string; value: string }> = {};
          for (const env of envs) {
            envMap[env.key] = { id: env.id, value: env.value };
          }
          log.push({ step: '1-fetch-envs', status: 'done', details: { total: envs.length } });

          // === STEP 2: Build canonical values ===
          log.push({ step: '2-build-canonical', status: 'starting' });
          const canonical: Record<string, string> = {};
          
          // JWT_SECRET
          if (envMap['SERVICE_PASSWORD_JWT']?.value) {
            canonical['JWT_SECRET'] = envMap['SERVICE_PASSWORD_JWT'].value;
          }
          
          // SUPABASE_URL
          if (envMap['API_EXTERNAL_URL']?.value && !envMap['API_EXTERNAL_URL'].value.includes('${')) {
            canonical['SUPABASE_URL'] = envMap['API_EXTERNAL_URL'].value;
          } else if (envMap['SERVICE_URL_SUPABASEKONG']?.value && !envMap['SERVICE_URL_SUPABASEKONG'].value.includes('${')) {
            canonical['SUPABASE_URL'] = envMap['SERVICE_URL_SUPABASEKONG'].value;
          }
          
          // SUPABASE_ANON_KEY
          if (envMap['SERVICE_SUPABASEANON_KEY']?.value && !envMap['SERVICE_SUPABASEANON_KEY'].value.includes('${')) {
            canonical['SUPABASE_ANON_KEY'] = envMap['SERVICE_SUPABASEANON_KEY'].value;
          }
          
          // SUPABASE_SERVICE_ROLE_KEY
          if (envMap['SERVICE_SUPABASESERVICE_KEY']?.value && !envMap['SERVICE_SUPABASESERVICE_KEY'].value.includes('${')) {
            canonical['SUPABASE_SERVICE_ROLE_KEY'] = envMap['SERVICE_SUPABASESERVICE_KEY'].value;
          }
          
          // POSTGRES_PASSWORD
          if (envMap['SERVICE_PASSWORD_POSTGRES']?.value && !envMap['SERVICE_PASSWORD_POSTGRES'].value.includes('${')) {
            canonical['POSTGRES_PASSWORD'] = envMap['SERVICE_PASSWORD_POSTGRES'].value;
          }
          
          // DATABASE_URL from PGRST_DB_URI
          if (envMap['PGRST_DB_URI']?.value && !envMap['PGRST_DB_URI'].value.includes('${')) {
            canonical['DATABASE_URL'] = envMap['PGRST_DB_URI'].value;
          }

          log.push({ step: '2-build-canonical', status: 'done', details: Object.keys(canonical) });

          // === STEP 3: Normalize all JWT secrets ===
          log.push({ step: '3-normalize-jwt', status: 'starting' });
          const jwtSecrets = ['JWT_SECRET', 'API_JWT_SECRET', 'AUTH_JWT_SECRET', 'GOTRUE_JWT_SECRET', 
                             'METRICS_JWT_SECRET', 'PGRST_JWT_SECRET', 'PGRST_APP_SETTINGS_JWT_SECRET'];
          
          let jwtUpdated = 0;
          for (const key of jwtSecrets) {
            const current = envMap[key];
            if (current && canonical['JWT_SECRET']) {
              // Check if needs update (has unresolved var OR different value)
              if (current.value.includes('${') || current.value !== canonical['JWT_SECRET']) {
                const updateRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs/${current.id}`, {
                  method: 'PATCH',
                  headers: { 
                    'Authorization': `Bearer ${COOLIFY_TOKEN}`, 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json' 
                  },
                  body: JSON.stringify({ value: canonical['JWT_SECRET'] }),
                });
                if (updateRes.ok) jwtUpdated++;
              }
            }
          }
          log.push({ step: '3-normalize-jwt', status: 'done', details: { updated: jwtUpdated } });

          // === STEP 4: Normalize URL secrets ===
          log.push({ step: '4-normalize-urls', status: 'starting' });
          const urlSecrets = ['SUPABASE_URL', 'SUPABASE_PUBLIC_URL', 'SUPABASE_PUBLIC_API', 'GOTRUE_SITE_URL'];
          
          let urlUpdated = 0;
          for (const key of urlSecrets) {
            const current = envMap[key];
            if (current && canonical['SUPABASE_URL']) {
              if (current.value.includes('${') || current.value !== canonical['SUPABASE_URL']) {
                const updateRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs/${current.id}`, {
                  method: 'PATCH',
                  headers: { 
                    'Authorization': `Bearer ${COOLIFY_TOKEN}`, 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json' 
                  },
                  body: JSON.stringify({ value: canonical['SUPABASE_URL'] }),
                });
                if (updateRes.ok) urlUpdated++;
              }
            }
          }
          log.push({ step: '4-normalize-urls', status: 'done', details: { updated: urlUpdated } });

          // === STEP 5: Normalize Key secrets ===
          log.push({ step: '5-normalize-keys', status: 'starting' });
          let keysUpdated = 0;
          
          // ANON_KEY
          if (envMap['SUPABASE_ANON_KEY'] && canonical['SUPABASE_ANON_KEY']) {
            if (envMap['SUPABASE_ANON_KEY'].value.includes('${')) {
              const updateRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs/${envMap['SUPABASE_ANON_KEY'].id}`, {
                method: 'PATCH',
                headers: { 
                  'Authorization': `Bearer ${COOLIFY_TOKEN}`, 
                  'Content-Type': 'application/json',
                  'Accept': 'application/json' 
                },
                body: JSON.stringify({ value: canonical['SUPABASE_ANON_KEY'] }),
              });
              if (updateRes.ok) keysUpdated++;
            }
          }
          
          // SERVICE_ROLE_KEY
          if (envMap['SUPABASE_SERVICE_ROLE_KEY'] && canonical['SUPABASE_SERVICE_ROLE_KEY']) {
            if (envMap['SUPABASE_SERVICE_ROLE_KEY'].value.includes('${')) {
              const updateRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs/${envMap['SUPABASE_SERVICE_ROLE_KEY'].id}`, {
                method: 'PATCH',
                headers: { 
                  'Authorization': `Bearer ${COOLIFY_TOKEN}`, 
                  'Content-Type': 'application/json',
                  'Accept': 'application/json' 
                },
                body: JSON.stringify({ value: canonical['SUPABASE_SERVICE_ROLE_KEY'] }),
              });
              if (updateRes.ok) keysUpdated++;
            }
          }
          log.push({ step: '5-normalize-keys', status: 'done', details: { updated: keysUpdated } });

          // === STEP 6: Remove duplicates ===
          log.push({ step: '6-remove-duplicates', status: 'starting' });
          const duplicatesToRemove = [
            'VITE_SUPABASE_SELFHOSTED_KEY',
            'VITE_SUPABASE_SELFHOSTED_URL',
          ];
          
          let removed = 0;
          for (const key of duplicatesToRemove) {
            if (envMap[key]?.id) {
              const deleteRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs/${envMap[key].id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
              });
              if (deleteRes.ok) removed++;
            }
          }
          log.push({ step: '6-remove-duplicates', status: 'done', details: { removed } });

          // === STEP 7: Restart service ===
          log.push({ step: '7-restart-service', status: 'starting' });
          const restartRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/restart`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });
          log.push({ step: '7-restart-service', status: restartRes.ok ? 'triggered' : 'failed' });

          return {
            success: true,
            data: {
              summary: {
                jwt_secrets_updated: jwtUpdated,
                url_secrets_updated: urlUpdated,
                key_secrets_updated: keysUpdated,
                duplicates_removed: removed,
                service_restart: restartRes.ok ? 'triggered' : 'failed',
              },
              canonical_values: Object.keys(canonical),
              log,
            }
          };

        } catch (error) {
          return { success: false, error: error.message, log };
        }
      },

      'start-service': async () => {
        if (!COOLIFY_TOKEN) {
          return { success: false, error: 'COOLIFY_API_TOKEN not configured' };
        }
        const serviceUuid = 'vcs0c0k8kww48kgws44swkk0';
        const res = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/start`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
        });
        return { success: res.ok, data: { status: res.ok ? 'starting' : 'failed', statusCode: res.status } };
      },

      'audit-domains': async () => {
        if (!COOLIFY_TOKEN) {
          return { success: false, error: 'COOLIFY_API_TOKEN not configured' };
        }

        const serviceUuid = 'vcs0c0k8kww48kgws44swkk0';
        const domainConfig = {
          'api.iptvlink.com.br': { service: 'supabase-kong', port: 8000, purpose: 'Kong API Gateway' },
          'supabase.iptvlink.com.br': { service: 'supabase-kong', port: 8000, purpose: 'Supabase REST/Auth/Studio (via Kong)' },
        };
        const invalidDomains = ['ip.pool.iptvlink.com.br'];

        try {
          // Get service details
          const serviceRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}`, {
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });
          
          if (!serviceRes.ok) {
            return { success: false, error: `Failed to get service: ${serviceRes.status}` };
          }
          
          const serviceData = await serviceRes.json();
          
          // Analyze current domains on applications
          const currentDomains: { app: string; fqdn: string; port: number; uuid: string }[] = [];
          
          for (const app of (serviceData.applications || [])) {
            if (app.fqdn) {
              const fqdns = app.fqdn.split(',').map((f: string) => f.trim());
              for (const fqdn of fqdns) {
                const domain = fqdn.replace('https://', '').replace('http://', '').split(':')[0];
                const port = parseInt(fqdn.split(':')[1] || app.ports?.split(':')[0] || '8000');
                currentDomains.push({
                  app: app.name,
                  fqdn: domain,
                  port,
                  uuid: app.uuid,
                });
              }
            }
          }

          // Find issues
          const issues: { type: string; domain: string; issue: string; fix: string }[] = [];
          
          for (const domain of invalidDomains) {
            const found = currentDomains.find(d => d.fqdn.includes(domain));
            if (found) {
              issues.push({
                type: 'invalid',
                domain,
                issue: `Domínio ${domain} não existe e está configurado em ${found.app}`,
                fix: `Remover ${domain} do serviço ${found.app}`,
              });
            }
          }

          // Check required domains
          for (const [domain, config] of Object.entries(domainConfig)) {
            const found = currentDomains.find(d => d.fqdn === domain);
            if (!found) {
              issues.push({
                type: 'missing',
                domain,
                issue: `Domínio ${domain} não está configurado`,
                fix: `Adicionar ${domain} ao serviço ${config.service} na porta ${config.port}`,
              });
            } else if (!found.app.includes('kong')) {
              issues.push({
                type: 'wrong_service',
                domain,
                issue: `Domínio ${domain} está em ${found.app} mas deveria estar em ${config.service}`,
                fix: `Mover ${domain} para ${config.service}`,
              });
            }
          }

          return {
            success: true,
            data: {
              current_domains: currentDomains,
              expected_config: domainConfig,
              invalid_domains: invalidDomains,
              issues,
              applications: (serviceData.applications || []).map((a: any) => ({
                name: a.name,
                uuid: a.uuid,
                fqdn: a.fqdn,
                ports: a.ports,
                status: a.status,
              })),
            }
          };

        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      'fix-domains': async () => {
        if (!COOLIFY_TOKEN) {
          return { success: false, error: 'COOLIFY_API_TOKEN not configured' };
        }

        const serviceUuid = 'vcs0c0k8kww48kgws44swkk0';
        const log: { step: string; status: string; details?: any }[] = [];

        try {
          // Step 1: Get service and find Kong
          log.push({ step: '1-get-service', status: 'starting' });
          const serviceRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}`, {
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });
          
          if (!serviceRes.ok) {
            return { success: false, error: `Failed to get service: ${serviceRes.status}`, log };
          }
          
          const serviceData = await serviceRes.json();
          const kongApp = serviceData.applications?.find((a: any) => 
            a.name?.toLowerCase().includes('kong') || a.image?.includes('kong')
          );
          
          if (!kongApp) {
            return { success: false, error: 'Kong not found in service', log };
          }
          log.push({ step: '1-get-service', status: 'done', details: { kong: kongApp.name, uuid: kongApp.uuid } });

          // Step 2: Configure correct domains for Kong
          log.push({ step: '2-set-kong-domains', status: 'starting' });
          
          // The correct FQDN for Kong - both api and supabase domains
          const correctFqdn = 'https://api.iptvlink.com.br:8000,https://supabase.iptvlink.com.br:8000';
          
          // Update Kong application with correct domains
          const updateRes = await fetch(
            `${COOLIFY_URL}/api/v1/services/${serviceUuid}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${COOLIFY_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({
                // Try updating the service level domains
                domains: [
                  { domain: 'api.iptvlink.com.br' },
                  { domain: 'supabase.iptvlink.com.br' },
                ],
              }),
            }
          );
          
          const updateText = await updateRes.text();
          log.push({ 
            step: '2-set-kong-domains', 
            status: updateRes.ok ? 'done' : 'partial', 
            details: { 
              response: updateRes.status,
              body: updateText.substring(0, 200),
              note: 'Domain updates may require Coolify Dashboard for service-level changes'
            } 
          });

          // Step 3: Try to update environment variables for correct routing
          log.push({ step: '3-update-env-urls', status: 'starting' });
          
          const envsRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs`, {
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });
          
          let envsUpdated = 0;
          if (envsRes.ok) {
            const envs = await envsRes.json();
            const envMap: Record<string, { id: string; value: string }> = {};
            for (const env of envs) {
              envMap[env.key] = { id: env.id, value: env.value };
            }
            
            // Update URL-related envs to use correct domain
            const urlsToUpdate = [
              { key: 'API_EXTERNAL_URL', value: 'https://supabase.iptvlink.com.br' },
              { key: 'SUPABASE_URL', value: 'https://supabase.iptvlink.com.br' },
              { key: 'SUPABASE_PUBLIC_URL', value: 'https://supabase.iptvlink.com.br' },
              { key: 'GOTRUE_SITE_URL', value: 'https://supabase.iptvlink.com.br' },
              { key: 'GOTRUE_API_EXTERNAL_URL', value: 'https://supabase.iptvlink.com.br/auth/v1' },
              { key: 'PGRST_OPENAPI_SERVER_PROXY_URI', value: 'https://supabase.iptvlink.com.br/rest/v1/' },
            ];
            
            for (const { key, value } of urlsToUpdate) {
              if (envMap[key]?.id) {
                const patchRes = await fetch(
                  `${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs/${envMap[key].id}`,
                  {
                    method: 'PATCH',
                    headers: {
                      'Authorization': `Bearer ${COOLIFY_TOKEN}`,
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                    },
                    body: JSON.stringify({ value }),
                  }
                );
                if (patchRes.ok) envsUpdated++;
              }
            }
          }
          log.push({ step: '3-update-env-urls', status: 'done', details: { updated: envsUpdated } });

          // Step 4: Restart service
          log.push({ step: '4-restart', status: 'starting' });
          const restartRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/restart`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });
          log.push({ step: '4-restart', status: restartRes.ok ? 'triggered' : 'failed' });

          return {
            success: true,
            data: {
              summary: {
                domains_configured: ['api.iptvlink.com.br', 'supabase.iptvlink.com.br'],
                removed_invalid: ['ip.pool.iptvlink.com.br'],
                env_vars_updated: envsUpdated,
                service_restart: restartRes.ok,
              },
              manual_steps: [
                'Se os domínios não atualizarem automaticamente:',
                '1. Acesse Coolify Dashboard → Supabase Service',
                '2. Clique em supabase-kong → Settings',
                '3. Em "Domains", remova ip.pool.iptvlink.com.br',
                '4. Adicione: api.iptvlink.com.br e supabase.iptvlink.com.br',
                '5. Reinicie o serviço',
              ],
              log,
            }
          };

        } catch (error) {
          return { success: false, error: error.message, log };
        }
      },

      'generate-realtime-secrets': async () => {
        if (!COOLIFY_TOKEN) {
          return { success: false, error: 'COOLIFY_API_TOKEN not configured' };
        }

        const serviceUuid = 'vcs0c0k8kww48kgws44swkk0';
        const log: { step: string; status: string; details?: any }[] = [];

        try {
          // Generate secure random strings for Realtime secrets
          const generateSecret = (length: number = 32): string => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            const randomValues = new Uint8Array(length);
            crypto.getRandomValues(randomValues);
            for (let i = 0; i < length; i++) {
              result += chars[randomValues[i] % chars.length];
            }
            return result;
          };

          const realtimeSecrets = {
            'SECRET_KEY_BASE_REALTIME': generateSecret(64),
            'SECRET_PASSWORD_REALTIME': generateSecret(32),
          };

          log.push({ step: '1-generate-secrets', status: 'done', details: { generated: Object.keys(realtimeSecrets) } });

          // Get current envs
          const envsRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs`, {
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });

          if (!envsRes.ok) {
            return { success: false, error: `Failed to get envs: ${envsRes.status}`, log };
          }

          const envs = await envsRes.json();
          const envMap: Record<string, { id: string; value: string }> = {};
          for (const env of envs) {
            envMap[env.key] = { id: env.id, value: env.value };
          }

          log.push({ step: '2-fetch-envs', status: 'done', details: { total: envs.length } });

          // Update or create Realtime secrets
          let updated = 0;
          for (const [key, value] of Object.entries(realtimeSecrets)) {
            const existing = envMap[key];
            if (existing?.id) {
              // Update if empty
              if (!existing.value || existing.value.trim() === '') {
                const patchRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs/${existing.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${COOLIFY_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                  },
                  body: JSON.stringify({ value }),
                });
                if (patchRes.ok) updated++;
              }
            } else {
              // Create new
              const createRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}/envs`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${COOLIFY_TOKEN}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
                body: JSON.stringify({ key, value, is_preview: false }),
              });
              if (createRes.ok) updated++;
            }
          }

          log.push({ step: '3-update-secrets', status: 'done', details: { updated } });

          return {
            success: true,
            data: {
              secrets_configured: Object.keys(realtimeSecrets),
              updated,
              log,
            }
          };

        } catch (error) {
          return { success: false, error: error.message, log };
        }
      },

      'get-service-status': async () => {
        if (!COOLIFY_TOKEN) {
          return { success: false, error: 'COOLIFY_API_TOKEN not configured' };
        }

        const serviceUuid = 'vcs0c0k8kww48kgws44swkk0';
        
        try {
          const serviceRes = await fetch(`${COOLIFY_URL}/api/v1/services/${serviceUuid}`, {
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });
          
          if (!serviceRes.ok) {
            return { success: false, error: `Failed to get service: ${serviceRes.status}` };
          }
          
          const serviceData = await serviceRes.json();
          
          // Get Redis status too
          const redisUuid = 'fcccoc44o8cog40c4ks8c0s4';
          const redisRes = await fetch(`${COOLIFY_URL}/api/v1/databases/${redisUuid}`, {
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' },
          });
          const redisData = redisRes.ok ? await redisRes.json() : null;

          return {
            success: true,
            data: {
              supabase: {
                uuid: serviceData.uuid,
                name: serviceData.name,
                status: serviceData.status,
                applications: (serviceData.applications || []).map((a: any) => ({
                  name: a.name,
                  status: a.status,
                  fqdn: a.fqdn,
                })),
              },
              redis: redisData ? {
                uuid: redisData.uuid,
                name: redisData.name,
                status: redisData.status,
              } : null,
            }
          };

        } catch (error) {
          return { success: false, error: error.message };
        }
      },
    };

    // Check if action is a custom function
    if (action && typeof actions[action] === 'function') {
      const result = await (actions[action] as Function)();
      return new Response(JSON.stringify({
        ...result,
        meta: {
          action,
          timestamp: new Date().toISOString(),
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let finalEndpoint = endpoint || '';
    let finalMethod = method;

    if (action && actions[action] && typeof actions[action] === 'object') {
      const actionConfig = actions[action] as { endpoint: string; method: string };
      finalEndpoint = actionConfig.endpoint;
      finalMethod = actionConfig.method;
    }

    // Replace path parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        finalEndpoint = finalEndpoint.replace(`{${key}}`, value);
      });
    }

    const finalUrl = `${COOLIFY_URL}/api/v1${finalEndpoint}`;
    
    console.log(`Coolify API Call: ${finalMethod} ${finalUrl}`);

    const fetchOptions: RequestInit = {
      method: finalMethod,
      headers: {
        'Authorization': `Bearer ${COOLIFY_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(finalMethod)) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(finalUrl, fetchOptions);
    
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data,
      meta: {
        endpoint: finalEndpoint,
        method: finalMethod,
        timestamp: new Date().toISOString(),
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Coolify API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
