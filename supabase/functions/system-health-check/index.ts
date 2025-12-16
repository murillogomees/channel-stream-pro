import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HealthStatus {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number
  lastCheck: string
  details?: Record<string, any>
}

interface AutoHealAction {
  type: 'restart_service' | 'clear_cache' | 'switch_origin' | 'alert_admin' | 'scale_up'
  target: string
  executed: boolean
  result?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const startTime = Date.now()
    const healthStatuses: HealthStatus[] = []
    const autoHealActions: AutoHealAction[] = []

    console.log('[system-health-check] Starting comprehensive health check')

    // 1. Database Health
    const dbStart = Date.now()
    try {
      const { data, error } = await supabase.from('iptv_channels').select('id').limit(1)
      healthStatuses.push({
        service: 'database',
        status: error ? 'unhealthy' : 'healthy',
        latency: Date.now() - dbStart,
        lastCheck: new Date().toISOString(),
        details: error ? { error: error.message } : { connected: true }
      })
    } catch (e) {
      healthStatuses.push({
        service: 'database',
        status: 'unhealthy',
        latency: Date.now() - dbStart,
        lastCheck: new Date().toISOString(),
        details: { error: e.message }
      })
    }

    // 2. Origin Servers Health
    const { data: origins } = await supabase
      .from('iptv_origin_servers')
      .select('*')
      .eq('is_active', true)

    const healthyOrigins = origins?.filter(o => o.is_healthy) || []
    const unhealthyOrigins = origins?.filter(o => !o.is_healthy) || []

    healthStatuses.push({
      service: 'origin_servers',
      status: healthyOrigins.length > 0 ? (unhealthyOrigins.length > 0 ? 'degraded' : 'healthy') : 'unhealthy',
      latency: 0,
      lastCheck: new Date().toISOString(),
      details: {
        total: origins?.length || 0,
        healthy: healthyOrigins.length,
        unhealthy: unhealthyOrigins.length
      }
    })

    // Auto-heal: Re-enable origins that have been down for a while
    for (const origin of unhealthyOrigins) {
      if (origin.fail_count < 10) {
        // Try to re-enable
        await supabase
          .from('iptv_origin_servers')
          .update({ is_active: true, fail_count: Math.max(0, origin.fail_count - 1) })
          .eq('origin_id', origin.origin_id)

        autoHealActions.push({
          type: 'restart_service',
          target: `origin:${origin.origin_id}`,
          executed: true,
          result: 'Re-enabled origin for retry'
        })
      }
    }

    // 3. Streaming Health (check recent errors)
    const { data: recentErrors } = await supabase
      .from('security_events')
      .select('*')
      .eq('event_type', 'stream_failover')
      .gte('created_at', new Date(Date.now() - 3600000).toISOString())

    const errorCount = recentErrors?.length || 0
    healthStatuses.push({
      service: 'streaming',
      status: errorCount > 50 ? 'unhealthy' : errorCount > 10 ? 'degraded' : 'healthy',
      latency: 0,
      lastCheck: new Date().toISOString(),
      details: {
        failovers_last_hour: errorCount
      }
    })

    // 4. Cache Health
    const { data: cacheStats } = await supabase
      .from('iptv_cdn_cache')
      .select('is_warm')

    const warmCaches = cacheStats?.filter(c => c.is_warm)?.length || 0
    const totalCaches = cacheStats?.length || 0

    healthStatuses.push({
      service: 'cache',
      status: totalCaches === 0 ? 'degraded' : warmCaches / totalCaches > 0.8 ? 'healthy' : 'degraded',
      latency: 0,
      lastCheck: new Date().toISOString(),
      details: {
        total: totalCaches,
        warm: warmCaches,
        cold: totalCaches - warmCaches
      }
    })

    // 5. Record metrics
    const overallStatus = healthStatuses.every(h => h.status === 'healthy') 
      ? 'healthy' 
      : healthStatuses.some(h => h.status === 'unhealthy') 
        ? 'unhealthy' 
        : 'degraded'

    await supabase.rpc('record_metric', {
      p_type: 'system_health',
      p_name: 'overall_status',
      p_value: overallStatus === 'healthy' ? 100 : overallStatus === 'degraded' ? 50 : 0,
      p_tags: { statuses: healthStatuses.map(h => ({ service: h.service, status: h.status })) }
    })

    // 6. Refresh materialized views if healthy
    if (overallStatus !== 'unhealthy') {
      try {
        await supabase.rpc('refresh_hot_data_views')
        console.log('[system-health-check] Refreshed materialized views')
      } catch (e) {
        console.warn('[system-health-check] Failed to refresh views:', e)
      }
    }

    // 7. Create partition for next month if needed
    try {
      await supabase.rpc('create_next_partition')
    } catch (e) {
      console.warn('[system-health-check] Partition creation skipped:', e)
    }

    const totalDuration = Date.now() - startTime
    console.log(`[system-health-check] Completed in ${totalDuration}ms - Status: ${overallStatus}`)

    return new Response(
      JSON.stringify({
        status: overallStatus,
        duration_ms: totalDuration,
        services: healthStatuses,
        auto_heal_actions: autoHealActions,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[system-health-check] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message, status: 'unhealthy' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
