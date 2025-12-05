/**
 * IPTV Playlist Endpoint
 * 
 * Returns dynamic M3U playlist for user.
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

    // Get user's assigned playlists
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

    // Get custom list assignments
    const { data: assignments } = await supabase
      .from('client_m3u_custom_assignments')
      .select('custom_list_id')
      .eq('cliente_id', user.id);

    const customListIds = assignments?.map(a => a.custom_list_id) || [];

    // Build channel query
    let query = supabase
      .from('m3u_channels')
      .select('id, name, url, logo_url, category, tvg_id, tvg_name')
      .eq('is_active', true);

    if (customListIds.length > 0) {
      query = query.in('custom_list_id', customListIds);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data: channels, error: channelsError } = await query
      .order('category')
      .order('name');

    if (channelsError) {
      throw channelsError;
    }

    // Return based on format
    if (type === 'json') {
      const groups = [...new Set(channels?.map(c => c.category) || [])];
      
      return new Response(
        JSON.stringify({
          channels: channels?.map(c => ({
            id: c.id,
            name: c.name,
            url: `${SUPABASE_URL}/functions/v1/iptv-play?channelId=${c.id}`,
            logo: c.logo_url,
            group: c.category,
            tvgId: c.tvg_id,
            tvgName: c.tvg_name,
          })),
          groups,
          count: channels?.length || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate M3U format
    let m3u = '#EXTM3U\n';
    
    for (const channel of channels || []) {
      const attrs = [
        channel.tvg_id ? `tvg-id="${channel.tvg_id}"` : '',
        channel.tvg_name ? `tvg-name="${channel.tvg_name}"` : '',
        channel.logo_url ? `tvg-logo="${channel.logo_url}"` : '',
        channel.category ? `group-title="${channel.category}"` : '',
      ].filter(Boolean).join(' ');

      m3u += `#EXTINF:-1 ${attrs},${channel.name}\n`;
      m3u += `${SUPABASE_URL}/functions/v1/iptv-play?channelId=${channel.id}\n`;
    }

    console.log(`[iptv-playlist] Generated ${channels?.length || 0} channels for user ${user.id}`);

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
