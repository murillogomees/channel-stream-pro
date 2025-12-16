import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Default LL-HLS configurations for different content types
const DEFAULT_CONFIGS = {
  live: {
    target_latency: 3.0,
    part_duration: 0.5,
    hold_back_multiplier: 2.0,
    prefetch_segments: 2,
    playlist_window: 30,
    can_skip_until: 6.0
  },
  sports: {
    target_latency: 2.0,      // Even lower for sports
    part_duration: 0.33,      // 333ms parts
    hold_back_multiplier: 1.5,
    prefetch_segments: 3,
    playlist_window: 20,
    can_skip_until: 4.0
  },
  vod: {
    target_latency: 10.0,     // Higher for VOD (not really LL-HLS)
    part_duration: 2.0,
    hold_back_multiplier: 3.0,
    prefetch_segments: 4,
    playlist_window: 60,
    can_skip_until: 10.0
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

    const { action, channelId, config, contentType } = await req.json()

    switch (action) {
      case 'get': {
        if (channelId) {
          const { data, error } = await supabase
            .from('iptv_llhls_config')
            .select('*')
            .eq('channel_id', channelId)
            .single()

          if (error && error.code !== 'PGRST116') throw error

          return new Response(
            JSON.stringify({ config: data || DEFAULT_CONFIGS.live }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Return all configs
        const { data, error } = await supabase
          .from('iptv_llhls_config')
          .select('*')
          .limit(100)

        if (error) throw error

        return new Response(
          JSON.stringify({ configs: data, defaults: DEFAULT_CONFIGS }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'set': {
        if (!channelId) {
          return new Response(
            JSON.stringify({ error: 'channelId required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const configToSave = config || DEFAULT_CONFIGS[contentType as keyof typeof DEFAULT_CONFIGS] || DEFAULT_CONFIGS.live

        const { data, error } = await supabase
          .from('iptv_llhls_config')
          .upsert({
            channel_id: channelId,
            ...configToSave,
            updated_at: new Date().toISOString()
          }, { onConflict: 'channel_id' })
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, config: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'apply_defaults': {
        // Apply default configs based on content type
        const { data: channels, error: channelError } = await supabase
          .from('iptv_channels')
          .select('id, category, content_type')
          .limit(1000)

        if (channelError) throw channelError

        let updated = 0
        for (const channel of channels || []) {
          // Determine content type
          let type = 'live'
          const category = (channel.category || '').toLowerCase()
          
          if (category.includes('esporte') || category.includes('sport') || category.includes('futebol')) {
            type = 'sports'
          } else if (category.includes('filme') || category.includes('movie') || category.includes('series')) {
            type = 'vod'
          }

          // Check if config exists
          const { data: existing } = await supabase
            .from('iptv_llhls_config')
            .select('id')
            .eq('channel_id', channel.id)
            .single()

          if (!existing) {
            await supabase
              .from('iptv_llhls_config')
              .insert({
                channel_id: channel.id,
                ...DEFAULT_CONFIGS[type as keyof typeof DEFAULT_CONFIGS]
              })
            updated++
          }
        }

        return new Response(
          JSON.stringify({ success: true, updated }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'get_defaults': {
        return new Response(
          JSON.stringify({ defaults: DEFAULT_CONFIGS }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('[llhls-config] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
