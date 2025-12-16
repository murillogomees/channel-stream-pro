import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-region',
}

interface OriginServer {
  id: string
  origin_id: string
  url: string
  region: string
  is_active: boolean
  is_healthy: boolean
  health_score: number
  latency_ms: number
  fail_count: number
}

interface GeoLocation {
  country: string
  region: string
  city?: string
  latitude?: number
  longitude?: number
}

// Region mapping for geo-routing
const REGION_MAPPING: Record<string, string[]> = {
  'BR': ['BR', 'SA', 'AR', 'CL', 'UY', 'PY', 'BO', 'PE', 'EC', 'CO', 'VE'],
  'US': ['US', 'CA', 'MX', 'NA'],
  'EU': ['DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'UK', 'GB', 'PL', 'AT', 'CH'],
  'AS': ['JP', 'KR', 'CN', 'TW', 'HK', 'SG', 'TH', 'MY', 'ID', 'PH', 'VN', 'IN'],
}

function getRegionFromCountry(countryCode: string): string {
  for (const [region, countries] of Object.entries(REGION_MAPPING)) {
    if (countries.includes(countryCode.toUpperCase())) {
      return region
    }
  }
  return 'global'
}

function calculateOriginScore(origin: OriginServer, clientRegion: string): number {
  let score = origin.health_score

  // Boost score for same region
  if (origin.region === clientRegion) {
    score += 30
  } else if (origin.region === 'global') {
    score += 10 // Global is neutral
  }

  // Penalize for latency
  if (origin.latency_ms > 0) {
    score -= Math.min(origin.latency_ms / 10, 20)
  }

  // Penalize for failures
  score -= origin.fail_count * 5

  // Bonus for being healthy
  if (origin.is_healthy) {
    score += 10
  }

  return Math.max(0, Math.min(100, score))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get client region from header or request body
    const clientRegion = req.headers.get('x-client-region') || 
                         req.headers.get('cf-ipcountry') || 
                         'BR'
    
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const { channelId, preferredRegion } = body

    const targetRegion = preferredRegion || getRegionFromCountry(clientRegion)

    console.log(`[origin-selector] Client region: ${clientRegion}, Target: ${targetRegion}`)

    // Get all active origins
    const { data: origins, error } = await supabase
      .from('iptv_origin_servers')
      .select('*')
      .eq('is_active', true)
      .order('health_score', { ascending: false })

    if (error) throw error

    if (!origins || origins.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No origins available' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Score and rank origins
    const scoredOrigins = origins.map(origin => ({
      ...origin,
      calculatedScore: calculateOriginScore(origin as OriginServer, targetRegion)
    })).sort((a, b) => b.calculatedScore - a.calculatedScore)

    // Select primary (best score) and fallbacks
    const primary = scoredOrigins[0]
    const fallbacks = scoredOrigins.slice(1, 3) // Up to 2 fallbacks

    // Log routing decision
    await supabase.from('iptv_routing_logs').insert({
      client_region: clientRegion,
      selected_cdn: primary.origin_id,
      stream_path: channelId ? `/channel/${channelId}` : '/general',
      latency_ms: primary.latency_ms
    })

    return new Response(
      JSON.stringify({
        primary: {
          id: primary.origin_id,
          url: primary.url,
          region: primary.region,
          score: primary.calculatedScore
        },
        fallbacks: fallbacks.map(f => ({
          id: f.origin_id,
          url: f.url,
          region: f.region,
          score: f.calculatedScore
        })),
        clientRegion,
        targetRegion
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[origin-selector] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
