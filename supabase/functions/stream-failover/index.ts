import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FailoverRequest {
  channelId: number
  currentOriginId: string
  errorCode: string
  errorMessage?: string
  clientRegion?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body: FailoverRequest = await req.json()
    const { channelId, currentOriginId, errorCode, errorMessage, clientRegion } = body

    console.log(`[stream-failover] Failover requested for channel ${channelId} from ${currentOriginId}`)
    console.log(`[stream-failover] Error: ${errorCode} - ${errorMessage}`)

    // Mark current origin as having a failure
    await supabase.rpc('increment_origin_fail_count', { p_origin_id: currentOriginId })

    // Get alternative origins
    const { data: origins, error } = await supabase
      .from('iptv_origin_servers')
      .select('*')
      .eq('is_active', true)
      .eq('is_healthy', true)
      .neq('origin_id', currentOriginId)
      .order('health_score', { ascending: false })
      .limit(2)

    if (error) throw error

    if (!origins || origins.length === 0) {
      // No alternatives available - try to re-enable fallback-global
      const { data: fallback } = await supabase
        .from('iptv_origin_servers')
        .select('*')
        .eq('origin_id', 'fallback-global')
        .single()

      if (fallback) {
        return new Response(
          JSON.stringify({
            success: true,
            newOrigin: {
              id: fallback.origin_id,
              url: fallback.url,
              region: fallback.region
            },
            message: 'Using global fallback'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No alternative origins available',
          retry: false 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Select best alternative (prioritize same region if known)
    let selectedOrigin = origins[0]
    if (clientRegion) {
      const sameRegion = origins.find(o => o.region === clientRegion)
      if (sameRegion) {
        selectedOrigin = sameRegion
      }
    }

    // Log failover event
    await supabase.from('iptv_routing_logs').insert({
      client_region: clientRegion || 'unknown',
      selected_cdn: selectedOrigin.origin_id,
      stream_path: `/failover/channel/${channelId}`,
      latency_ms: selectedOrigin.latency_ms
    })

    // Log security event for monitoring
    await supabase.from('security_events').insert({
      event_type: 'stream_failover',
      event_details: {
        channelId,
        fromOrigin: currentOriginId,
        toOrigin: selectedOrigin.origin_id,
        errorCode,
        errorMessage
      },
      severity: 'low'
    })

    console.log(`[stream-failover] Switched to ${selectedOrigin.origin_id}`)

    return new Response(
      JSON.stringify({
        success: true,
        newOrigin: {
          id: selectedOrigin.origin_id,
          url: selectedOrigin.url,
          region: selectedOrigin.region
        },
        alternatives: origins.slice(1).map(o => ({
          id: o.origin_id,
          url: o.url,
          region: o.region
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[stream-failover] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
