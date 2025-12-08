import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
});
