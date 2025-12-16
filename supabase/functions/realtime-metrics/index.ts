import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MetricPoint {
  time: string
  value: number
}

interface DashboardMetrics {
  overview: {
    totalChannels: number
    healthyChannels: number
    activeUsers24h: number
    totalViews24h: number
    avgBufferEvents: number
  }
  streaming: {
    failovers: number
    avgLatency: number
    originHealth: Record<string, number>
  }
  performance: {
    dbLatency: MetricPoint[]
    apiLatency: MetricPoint[]
    errorRate: MetricPoint[]
  }
  hotChannels: Array<{
    id: number
    name: string
    category: string
    views: number
    uniqueViewers: number
  }>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { timeRange = '24h' } = await req.json().catch(() => ({}))

    const hours = timeRange === '1h' ? 1 : timeRange === '7d' ? 168 : 24

    console.log(`[realtime-metrics] Fetching metrics for last ${hours} hours`)

    // 1. Overview metrics
    const { data: channelStats } = await supabase
      .from('mv_channel_health_summary')
      .select('*')

    const totalChannels = channelStats?.reduce((sum, c) => sum + (c.total_channels || 0), 0) || 0
    const healthyChannels = channelStats?.reduce((sum, c) => sum + (c.healthy_channels || 0), 0) || 0

    // Active users and views from materialized view
    const { data: activityStats } = await supabase
      .from('mv_user_activity_summary')
      .select('*')
      .gte('hour_bucket', new Date(Date.now() - hours * 3600000).toISOString())

    const activeUsers24h = activityStats?.reduce((sum, a) => sum + (a.unique_users || 0), 0) || 0
    const totalViews24h = activityStats?.reduce((sum, a) => sum + (a.total_views || 0), 0) || 0
    const avgBufferEvents = activityStats?.length 
      ? activityStats.reduce((sum, a) => sum + (a.total_buffer_events || 0), 0) / activityStats.length 
      : 0

    // 2. Streaming metrics
    const { data: failovers } = await supabase
      .from('security_events')
      .select('id')
      .eq('event_type', 'stream_failover')
      .gte('created_at', new Date(Date.now() - hours * 3600000).toISOString())

    const { data: origins } = await supabase
      .from('iptv_origin_servers')
      .select('origin_id, health_score, latency_ms')
      .eq('is_active', true)

    const originHealth: Record<string, number> = {}
    let avgLatency = 0
    if (origins) {
      for (const o of origins) {
        originHealth[o.origin_id] = o.health_score
        avgLatency += o.latency_ms || 0
      }
      avgLatency = origins.length > 0 ? avgLatency / origins.length : 0
    }

    // 3. Performance metrics from time-series
    const { data: perfMetrics } = await supabase
      .from('performance_metrics')
      .select('metric_name, metric_value, recorded_at')
      .gte('recorded_at', new Date(Date.now() - hours * 3600000).toISOString())
      .order('recorded_at', { ascending: true })

    const dbLatency: MetricPoint[] = []
    const apiLatency: MetricPoint[] = []
    const errorRate: MetricPoint[] = []

    for (const m of perfMetrics || []) {
      const point = { time: m.recorded_at, value: m.metric_value }
      if (m.metric_name === 'db_latency') dbLatency.push(point)
      else if (m.metric_name === 'api_latency') apiLatency.push(point)
      else if (m.metric_name === 'error_rate') errorRate.push(point)
    }

    // 4. Hot channels from materialized view
    const { data: hotChannels } = await supabase
      .from('mv_hot_channels')
      .select('id, name, category, view_count_24h, unique_viewers_24h')
      .order('view_count_24h', { ascending: false })
      .limit(10)

    const metrics: DashboardMetrics = {
      overview: {
        totalChannels,
        healthyChannels,
        activeUsers24h,
        totalViews24h,
        avgBufferEvents: Math.round(avgBufferEvents)
      },
      streaming: {
        failovers: failovers?.length || 0,
        avgLatency: Math.round(avgLatency),
        originHealth
      },
      performance: {
        dbLatency,
        apiLatency,
        errorRate
      },
      hotChannels: (hotChannels || []).map(c => ({
        id: c.id,
        name: c.name,
        category: c.category || 'Unknown',
        views: c.view_count_24h || 0,
        uniqueViewers: c.unique_viewers_24h || 0
      }))
    }

    return new Response(
      JSON.stringify(metrics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[realtime-metrics] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
