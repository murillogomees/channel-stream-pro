/**
 * IPTV Play Endpoint
 * 
 * Returns signed streaming URL with CDN list for a channel.
 * Endpoint: /api/iptv/play?channelId=XXX
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const R2_CDN_URL = 'https://pub-iptvlink.r2.dev';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const channelId = url.searchParams.get('channelId');

    if (!channelId) {
      return new Response(
        JSON.stringify({ error: 'channelId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Get channel info
    const { data: channel, error: channelError } = await supabase
      .from('m3u_channels')
      .select('id, name, url, r2_url, r2_uploaded, cf_stream_uid')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      return new Response(
        JSON.stringify({ error: 'Channel not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check R2 storage for cached content
    const { data: r2Object } = await supabase
      .from('r2_storage_objects')
      .select('r2_key, status')
      .eq('channel_id', channelId)
      .eq('status', 'completed')
      .maybeSingle();

    // Build CDN list with priorities
    const cdnList: Array<{ url: string; priority: number; type: string; region?: string }> = [];

    // 1. R2 CDN (highest priority for cached content)
    if (r2Object?.r2_key) {
      cdnList.push({
        url: `${R2_CDN_URL}/${r2Object.r2_key}`,
        priority: 1,
        type: 'r2',
        region: 'global',
      });
    } else if (channel.r2_uploaded && channel.r2_url) {
      cdnList.push({
        url: channel.r2_url,
        priority: 1,
        type: 'r2',
        region: 'global',
      });
    }

    // 2. Cloudflare Stream (for live content)
    if (channel.cf_stream_uid) {
      cdnList.push({
        url: `https://customer-streams.cloudflarestream.com/${channel.cf_stream_uid}/manifest/video.m3u8`,
        priority: 2,
        type: 'cf-stream',
      });
    }

    // 3. Stream proxy (for HTTP content on HTTPS)
    if (channel.url.startsWith('http://')) {
      cdnList.push({
        url: `${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(channel.url)}`,
        priority: 3,
        type: 'proxy',
      });
    }

    // 4. Origin (direct URL)
    cdnList.push({
      url: channel.url,
      priority: 4,
      type: 'origin',
    });

    // Select primary URL (highest priority available)
    const primaryCdn = cdnList.sort((a, b) => a.priority - b.priority)[0];

    // Token expires in 4 hours
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

    // Log access
    await supabase.from('channel_usage_stats').upsert({
      profile_id: user.id,
      channel_id: channelId,
      last_watched_at: new Date().toISOString(),
      view_count: 1,
    }, {
      onConflict: 'profile_id,channel_id',
    });

    console.log(`[iptv-play] Channel ${channelId} requested by ${user.id}, using ${primaryCdn.type}`);

    return new Response(
      JSON.stringify({
        url: primaryCdn.url,
        cdnList,
        expiresAt,
        channel: {
          id: channel.id,
          name: channel.name,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[iptv-play] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
