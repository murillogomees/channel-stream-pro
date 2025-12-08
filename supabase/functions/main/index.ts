/**
 * Main Edge Function Router for Self-Hosted Supabase
 * 
 * Routes requests to appropriate Edge Functions based on URL path.
 * Uses static imports for self-hosted compatibility.
 */

// Static imports for all functions (required for self-hosted)
import healthCheckHandler from '../health-check/index.ts';
import mercadoPagoTestHandler from '../mercado-pago-test/index.ts';
import cacheSchedulePurgeHandler from '../cache-schedule-purge/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id, x-webhook-signature, range, accept-encoding, x-playback-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
};

// Function registry with static handlers
const functionHandlers: Record<string, (req: Request) => Promise<Response>> = {
  'health-check': healthCheckHandler,
  'mercado-pago-test': mercadoPagoTestHandler,
  'cache-schedule-purge': cacheSchedulePurgeHandler,
};

// Extract function name from various path formats
function extractFunctionName(pathname: string): string | null {
  let path = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  
  if (path.startsWith('functions/v1/')) {
    path = path.replace('functions/v1/', '');
  }
  
  const parts = path.split('/');
  const name = parts[0];
  
  if (!name || name === 'main' || name === 'functions') {
    return null;
  }
  
  return name;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;
  
  console.log(`[MainRouter] ${req.method} ${pathname}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoints
  if (pathname === '/' || pathname === '/health' || pathname === '/main' || pathname === '/functions/v1/main') {
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '2.1.0',
        router: 'main',
        functions: Object.keys(functionHandlers)
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const functionName = extractFunctionName(pathname);
  
  if (!functionName) {
    return new Response(
      JSON.stringify({ 
        error: 'Function not specified', 
        path: pathname,
        hint: 'Use /functions/v1/{function-name}',
        available: Object.keys(functionHandlers)
      }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  console.log(`[MainRouter] Routing to: ${functionName}`);

  const handler = functionHandlers[functionName];
  
  if (!handler) {
    return new Response(
      JSON.stringify({ 
        error: 'Function not found', 
        function: functionName,
        available: Object.keys(functionHandlers)
      }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    const startTime = Date.now();
    const response = await handler(req);
    const duration = Date.now() - startTime;
    
    console.log(`[MainRouter] ${functionName} completed in ${duration}ms`);
    
    return response;
  } catch (error) {
    console.error(`[MainRouter] Error executing ${functionName}:`, error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Function execution error', 
        function: functionName,
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
