/**
 * Main Edge Function Router for Self-Hosted Supabase
 * 
 * Routes requests to appropriate Edge Functions based on URL path.
 * Pattern: /functions/v1/{function-name} -> ../function-name/index.ts
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id, x-webhook-signature, range, accept-encoding, x-playback-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
};

// Function registry - maps function names to their handlers
const functionHandlers: Record<string, (req: Request) => Promise<Response>> = {};

// Lazy load function modules
async function loadFunction(name: string): Promise<((req: Request) => Promise<Response>) | null> {
  if (functionHandlers[name]) {
    return functionHandlers[name];
  }

  try {
    const module = await import(`../${name}/index.ts`);
    
    if (typeof module.default === 'function') {
      functionHandlers[name] = module.default;
      return module.default;
    }
    
    if (typeof module.handler === 'function') {
      functionHandlers[name] = module.handler;
      return module.handler;
    }
    
    console.error(`[MainRouter] Function ${name} has no default or handler export`);
    return null;
  } catch (error) {
    console.error(`[MainRouter] Failed to load function ${name}:`, error);
    return null;
  }
}

// Extract function name from various path formats
function extractFunctionName(pathname: string): string | null {
  // Remove leading slash
  let path = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  
  // Handle /functions/v1/{name} format
  if (path.startsWith('functions/v1/')) {
    path = path.replace('functions/v1/', '');
  }
  
  // Handle /{name}/... format
  const parts = path.split('/');
  const name = parts[0];
  
  // Ignore empty or main
  if (!name || name === 'main' || name === 'functions') {
    return null;
  }
  
  return name;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;
  
  console.log(`[MainRouter] ${req.method} ${pathname}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoints
  if (pathname === '/' || pathname === '/health' || pathname === '/main' || pathname === '/functions/v1/main') {
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        router: 'main'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Extract function name
  const functionName = extractFunctionName(pathname);
  
  if (!functionName) {
    return new Response(
      JSON.stringify({ 
        error: 'Function not specified', 
        path: pathname,
        hint: 'Use /functions/v1/{function-name}'
      }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  console.log(`[MainRouter] Routing to: ${functionName}`);

  // Load and execute the function
  const handler = await loadFunction(functionName);
  
  if (!handler) {
    return new Response(
      JSON.stringify({ 
        error: 'Function not found or has no handler', 
        function: functionName
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
