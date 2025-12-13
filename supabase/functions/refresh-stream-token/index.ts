import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stream-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[refresh-stream-token] Generating new stream token')

    /**
     * Token Generation Strategy:
     * - Generate a secure random token
     * - Short TTL (180 seconds = 3 minutes)
     * - Never cached
     * - Used only in proxy headers
     */
    const newToken = crypto.randomUUID()
    const expiresIn = 180 // 3 minutes

    console.log('[refresh-stream-token] Token generated successfully')

    return new Response(
      JSON.stringify({
        token: newToken,
        expiresIn,
        generatedAt: Date.now()
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      }
    )
  } catch (err) {
    console.error('[refresh-stream-token] Error:', err.message)

    return new Response(
      JSON.stringify({
        error: 'TOKEN_REFRESH_FAILED',
        message: err.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
