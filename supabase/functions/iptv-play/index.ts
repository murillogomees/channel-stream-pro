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

    // Get channel info from iptv_channels table
    const { data: channel, error: channelError } = await supabase
      .from('iptv_channels')
      .select('id, name, slug, original_url, transcode_manifest_url, transcode_status, content_type')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      return new Response(
        JSON.stringify({ error: 'Channel not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build CDN list with priorities
    const cdnList: Array<{ url: string; priority: number; type: string; region?: string }> = [];

    // 1. Transcoded manifest (highest priority if available)
    if (channel.transcode_status === 'ready' && channel.transcode_manifest_url) {
      cdnList.push({
        url: channel.transcode_manifest_url,
        priority: 1,
        type: 'transcode',
        region: 'global',
      });
    }

    // 2. Stream proxy (for HTTP content on HTTPS page)
    if (channel.original_url.startsWith('http://')) {
      cdnList.push({
        url: `${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(channel.original_url)}`,
        priority: 2,
        type: 'proxy',
      });
    }

    // 3. Origin (direct URL - works for HTTPS sources)
    cdnList.push({
      url: channel.original_url,
      priority: 3,
      type: 'origin',
    });

    // Select primary URL (highest priority available)
    const primaryCdn = cdnList.sort((a, b) => a.priority - b.priority)[0];

    // Token expires in 4 hours
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

    // Log access to metrics
    await supabase.from('iptv_channel_metrics').insert({
      channel_id: parseInt(channelId),
      metric_type: 'view',
      value: 1,
    }).catch(() => {}); // Non-blocking

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
