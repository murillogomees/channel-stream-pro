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
        // PostgREST needs to connect as "authenticator" role
        const pgPassword = encodeURIComponent(postgresPasswordEnv.value);
        const dbUri = `postgres://authenticator:${pgPassword}@supabase-db:5432/postgres`;

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
