/**
 * Test R2 Connection Edge Function
 * Uses shared R2 config helper
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  checkR2Config, 
  testR2Connection, 
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

  try {
    // Check if basic config exists
    const configStatus = checkR2Config();
    
    if (!configStatus.configured) {
      return new Response(
        JSON.stringify({
          success: false,
          configured: false,
          message: `Missing R2 configuration: ${configStatus.missing.join(', ')}`,
          missing: configStatus.missing,
          defaultBucket: R2_BUCKET_NAME,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 // Return 200 for config check, not 500
        }
      );
    }

    // Run full connection test
    const testResult = await testR2Connection();
    
    return new Response(
      JSON.stringify({
        success: testResult.connected && testResult.canRead,
        configured: true,
        ...testResult,
        defaultBucket: R2_BUCKET_NAME,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('[test-r2-connection] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        defaultBucket: R2_BUCKET_NAME,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
