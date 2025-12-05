/**
 * List Objects Test Edge Function
 * Dedicated endpoint to test R2 ListObjectsV2 operation
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  checkR2Config, 
  listObjects,
  R2_BUCKET_NAME 
} from "../_shared/r2-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // Check config first
    const configStatus = checkR2Config();
    
    if (!configStatus.configured) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Missing R2 configuration: ${configStatus.missing.join(', ')}`,
          missing: configStatus.missing,
          bucket: R2_BUCKET_NAME,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Get optional prefix from query params
    const url = new URL(req.url);
    const prefix = url.searchParams.get('prefix') || '';
    const maxKeys = parseInt(url.searchParams.get('max-keys') || '10', 10);

    console.log('[list-objects-test] Testing ListObjectsV2 with prefix:', prefix, 'maxKeys:', maxKeys);

    // Attempt to list objects
    const result = await listObjects(prefix, maxKeys);
    
    const duration = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({
        success: true,
        bucket: R2_BUCKET_NAME,
        prefix,
        maxKeys,
        keysFound: result.keys.length,
        keys: result.keys,
        truncated: result.truncated,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = (error as Error).message || String(error);
    
    console.error('[list-objects-test] Error:', errorMessage);
    
    // Parse error details if available
    let errorDetails: Record<string, unknown> = {
      message: errorMessage,
    };
    
    // Extract SignatureDoesNotMatch details if present
    if (errorMessage.includes('SignatureDoesNotMatch')) {
      errorDetails.type = 'SignatureDoesNotMatch';
      errorDetails.suggestion = 'Verify R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are from the same token pair';
      
      // Try to extract server-calculated signature info
      const sigMatch = errorMessage.match(/calculated\s+([a-f0-9]+)/i);
      if (sigMatch) {
        errorDetails.serverCalculatedSignature = sigMatch[1].substring(0, 20) + '...';
      }
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        bucket: R2_BUCKET_NAME,
        error: errorDetails,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Return 200 to see error details in response
      }
    );
  }
});
