import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HealthCheckResult {
  originId: string
  isHealthy: boolean
  latencyMs: number
  statusCode: number
  error?: string
}

async function checkOriginHealth(url: string, timeout = 5000): Promise<HealthCheckResult & { url: string }> {
  const startTime = Date.now()
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(`${url}/health`, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'IPTV-HealthCheck/1.0'
      }
    })

    clearTimeout(timeoutId)
    const latencyMs = Date.now() - startTime

    return {
      originId: '',
      url,
      isHealthy: response.ok || response.status === 404, // 404 is acceptable if health endpoint doesn't exist
      latencyMs,
      statusCode: response.status
    }
  } catch (error) {
    return {
      originId: '',
      url,
      isHealthy: false,
      latencyMs: Date.now() - startTime,
      statusCode: 0,
      error: error.message
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('[origin-health-check] Starting health check for all origins')

    // Get all origins
    const { data: origins, error } = await supabase
      .from('iptv_origin_servers')
      .select('*')

    if (error) throw error

    if (!origins || origins.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No origins to check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check all origins in parallel
    const healthChecks = await Promise.all(
      origins.map(async (origin) => {
        const result = await checkOriginHealth(origin.url)
        return { ...result, originId: origin.origin_id }
      })
    )

    // Update database with results
    const updates = []
    for (const check of healthChecks) {
      const origin = origins.find(o => o.origin_id === check.originId)
      if (!origin) continue

      // Calculate new health score
      let newHealthScore = origin.health_score
      let newFailCount = origin.fail_count

      if (check.isHealthy) {
        // Recover health score gradually
        newHealthScore = Math.min(100, origin.health_score + 5)
        newFailCount = Math.max(0, origin.fail_count - 1)
      } else {
        // Decrease health score on failure
        newHealthScore = Math.max(0, origin.health_score - 15)
        newFailCount = origin.fail_count + 1
      }

      updates.push(
        supabase
          .from('iptv_origin_servers')
          .update({
            is_healthy: check.isHealthy,
            health_score: newHealthScore,
            latency_ms: check.latencyMs,
            fail_count: newFailCount,
            last_check_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('origin_id', check.originId)
      )
    }

    await Promise.all(updates)

    // Auto-disable origins with too many failures
    const criticalOrigins = healthChecks.filter(c => {
      const origin = origins.find(o => o.origin_id === c.originId)
      return origin && origin.fail_count >= 5
    })

    if (criticalOrigins.length > 0) {
      console.log(`[origin-health-check] Disabling ${criticalOrigins.length} critical origins`)
      
      for (const critical of criticalOrigins) {
        await supabase
          .from('iptv_origin_servers')
          .update({ is_active: false })
          .eq('origin_id', critical.originId)
      }
    }

    const summary = {
      checked: healthChecks.length,
      healthy: healthChecks.filter(c => c.isHealthy).length,
      unhealthy: healthChecks.filter(c => !c.isHealthy).length,
      disabled: criticalOrigins.length,
      results: healthChecks.map(c => ({
        originId: c.originId,
        healthy: c.isHealthy,
        latencyMs: c.latencyMs,
        error: c.error
      }))
    }

    console.log('[origin-health-check] Summary:', JSON.stringify(summary))

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[origin-health-check] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
