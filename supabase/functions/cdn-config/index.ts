/**
 * CDN Configuration Edge Function
 * 
 * Returns CDN Worker configuration from Supabase secrets
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function handler(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get configuration from environment
    const cdnWorkerUrl = Deno.env.get('CDN_WORKER_URL') || null;
    const r2PublicDomain = Deno.env.get('R2_PUBLIC_DOMAIN') || null;

    console.log('[CDN Config] Returning configuration:', {
      hasCdnWorkerUrl: !!cdnWorkerUrl,
      hasR2PublicDomain: !!r2PublicDomain,
    });

    return new Response(
      JSON.stringify({
        cdn_worker_url: cdnWorkerUrl,
        r2_public_domain: r2PublicDomain,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[CDN Config] Error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to get CDN configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
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
}

// Export for dynamic import by main router
export default handler;

// Also support direct Deno.serve for standalone mode
if (import.meta.main) {
  Deno.serve(handler);
}
