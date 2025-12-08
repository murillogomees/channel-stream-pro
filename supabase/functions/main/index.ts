const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  if (pathname === '/health' || pathname === '/' || pathname === '/functions/v1/health-check') {
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Extract function name from path: /functions/v1/{function-name}
  const functionMatch = pathname.match(/^\/functions\/v1\/([^\/]+)/);
  
  if (!functionMatch) {
    return new Response(
      JSON.stringify({ error: 'Function not found', path: pathname }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const functionName = functionMatch[1];
  console.log(`[Main] Routing to function: ${functionName}`);

  try {
    // Dynamic import of the function
    const functionModule = await import(`../${functionName}/index.ts`);
    
    // If the module exports a default function, call it
    if (typeof functionModule.default === 'function') {
      return await functionModule.default(req);
    }
    
    return new Response(
      JSON.stringify({ error: 'Function has no default export' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error(`[Main] Error loading function ${functionName}:`, error);
    return new Response(
      JSON.stringify({ 
        error: 'Function load error', 
        function: functionName,
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
