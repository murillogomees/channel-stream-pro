import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COOLIFY_URL = "https://dashboard.iptvlink.com.br";
const COOLIFY_TOKEN = Deno.env.get('COOLIFY_API_TOKEN') || '';

interface CoolifyRequest {
  action: string;
  endpoint?: string;
  method?: string;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, endpoint, method = 'GET', body, params } = await req.json() as CoolifyRequest;

    // Build URL with params
    let url = `${COOLIFY_URL}/api/v1${endpoint || ''}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    // Predefined actions
    const actions: Record<string, { endpoint: string; method: string }> = {
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
    };

    let finalEndpoint = endpoint || '';
    let finalMethod = method;

    if (action && actions[action]) {
      finalEndpoint = actions[action].endpoint;
      finalMethod = actions[action].method;
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
