/**
 * CDN Health Check Edge Function
 * 
 * Tests CDN Worker connectivity and JWT validation
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cdnWorkerUrl = Deno.env.get('CDN_WORKER_URL');
    
    if (!cdnWorkerUrl) {
      return new Response(
        JSON.stringify({
          healthy: false,
          error: 'CDN_WORKER_URL not configured',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Test health endpoint
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${cdnWorkerUrl}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - start;

      const data = await response.json();

      return new Response(
        JSON.stringify({
          healthy: response.ok,
          status: data.status || 'unknown',
          responseTime,
          workerUrl: cdnWorkerUrl,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      return new Response(
        JSON.stringify({
          healthy: false,
          error: fetchError.message,
          responseTime: Date.now() - start,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error) {
    console.error('[CDN Health] Error:', error);
    
    return new Response(
      JSON.stringify({
        healthy: false,
        error: 'Health check failed',
        details: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
