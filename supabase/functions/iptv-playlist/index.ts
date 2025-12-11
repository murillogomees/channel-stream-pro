/**
 * IPTV Playlist Endpoint
 * 
 * Returns dynamic M3U playlist for user from iptv_channels table.
 * Endpoint: /api/iptv/playlist?type=m3u|json
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'm3u';
    const category = url.searchParams.get('category');
    const playlistId = url.searchParams.get('playlistId');

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user subscription
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, plano, cliente_ativo')
      .eq('id', user.id)
      .single();

    if (!profile?.cliente_ativo) {
      return new Response(
        JSON.stringify({ error: 'Subscription inactive' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let channels: any[] = [];

    // If playlistId provided, get channels from that playlist
    if (playlistId) {
      const { data: playlistChannels, error: playlistError } = await supabase
        .from('iptv_playlist_channels')
        .select(`
          position,
          custom_name,
          custom_logo,
          channel:iptv_channels(id, name, slug, original_url, logo_url, category, content_type)
        `)
        .eq('playlist_id', playlistId)
        .eq('is_hidden', false)
        .order('position');

      if (playlistError) throw playlistError;

      channels = (playlistChannels || []).map(pc => ({
        id: pc.channel.id,
        name: pc.custom_name || pc.channel.name,
        slug: pc.channel.slug,
        original_url: pc.channel.original_url,
        logo_url: pc.custom_logo || pc.channel.logo_url,
        category: pc.channel.category,
        content_type: pc.channel.content_type,
      }));
    } else {
      // Get all healthy channels
      let query = supabase
        .from('iptv_channels')
        .select('id, name, slug, original_url, logo_url, category, content_type')
        .eq('is_healthy', true)
        .order('category')
        .order('name');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error: channelsError } = await query;
      if (channelsError) throw channelsError;
      channels = data || [];
    }

    // Return based on format
    if (type === 'json') {
      const groups = [...new Set(channels.map(c => c.category) || [])];
      
      return new Response(
        JSON.stringify({
          channels: channels.map(c => ({
            id: c.id,
            name: c.name,
            url: `${SUPABASE_URL}/functions/v1/iptv-play?channelId=${c.id}`,
            logo: c.logo_url,
            group: c.category,
            slug: c.slug,
            type: c.content_type,
          })),
          groups,
          count: channels.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate M3U format
    let m3u = '#EXTM3U\n';
    
    for (const channel of channels) {
      const attrs = [
        `tvg-id="${channel.slug}"`,
        `tvg-name="${channel.name}"`,
        channel.logo_url ? `tvg-logo="${channel.logo_url}"` : '',
        channel.category ? `group-title="${channel.category}"` : '',
      ].filter(Boolean).join(' ');

      m3u += `#EXTINF:-1 ${attrs},${channel.name}\n`;
      m3u += `${SUPABASE_URL}/functions/v1/iptv-play?channelId=${channel.id}\n`;
    }

    console.log(`[iptv-playlist] Generated ${channels.length} channels for user ${user.id}`);

    return new Response(m3u, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/x-mpegurl',
        'Content-Disposition': 'attachment; filename="playlist.m3u"',
      },
    });

  } catch (error) {
    console.error('[iptv-playlist] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
