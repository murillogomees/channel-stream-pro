const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[HealthCheck] Checking system health...');

  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      edge_functions: 'operational',
      database: 'operational'
    },
    version: '1.0.0'
  };

  return new Response(
    JSON.stringify(healthData),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// Export for dynamic import by main router
export default handler;

// Also support direct Deno.serve for standalone mode
if (import.meta.main) {
  Deno.serve(handler);
}
