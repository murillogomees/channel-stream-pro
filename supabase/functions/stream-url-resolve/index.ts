/**
 * stream-url-resolve
 * 
 * Resolves stream URL for a specific channel on-demand.
 * Called when user clicks to play a channel.
 * 
 * Supports both:
 * - m3u_sync_entries (M3U imported channels)
 * - iptv_channels (manually added channels)
 * 
 * Automatically wraps HTTP URLs through stream-proxy for HTTPS pages.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Support both GET (query params) and POST (body)
    let channelId: string | null = null;
    let source: string = 'auto'; // 'sync' for m3u_sync_entries, 'channels' for iptv_channels, 'auto' to try both

    if (req.method === 'GET') {
      const url = new URL(req.url);
      channelId = url.searchParams.get('id');
      source = url.searchParams.get('source') || 'auto';
    } else {
      const body = await req.json();
      channelId = body.channelId || body.id;
      source = body.source || 'auto';
    }

    if (!channelId) {
      return new Response(
        JSON.stringify({ error: 'channelId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Stream Resolve] Channel: ${channelId}, Source: ${source}`);

    let data: any = null;
    let streamUrl: string | null = null;
    let title: string = '';
    let logo: string | null = null;
    let category: string | null = null;

    // Try m3u_sync_entries first (if source is 'sync' or 'auto')
    if (source === 'sync' || source === 'auto') {
      const { data: syncEntry, error: syncError } = await supabase
        .from('m3u_sync_entries')
        .select('id, title, stream_url, tvg_logo, group_title')
        .eq('id', channelId)
        .single();

      if (!syncError && syncEntry) {
        data = syncEntry;
        streamUrl = syncEntry.stream_url;
        title = syncEntry.title;
        logo = syncEntry.tvg_logo;
        category = syncEntry.group_title;
        console.log(`[Stream Resolve] Found in m3u_sync_entries: ${title}`);
      }
    }

    // Try iptv_channels if not found (if source is 'channels' or 'auto')
    if (!data && (source === 'channels' || source === 'auto')) {
      const { data: channel, error: channelError } = await supabase
        .from('iptv_channels')
        .select('id, name, original_url, logo_url, category')
        .eq('id', channelId)
        .single();

      if (!channelError && channel) {
        data = channel;
        streamUrl = channel.original_url;
        title = channel.name;
        logo = channel.logo_url;
        category = channel.category;
        console.log(`[Stream Resolve] Found in iptv_channels: ${title}`);
      }
    }

    if (!data || !streamUrl) {
      console.error('[Stream Resolve] Not found:', channelId);
      return new Response(
        JSON.stringify({ error: 'Channel not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if stream needs proxy (HTTP in HTTPS context)
    const needsProxy = streamUrl.startsWith('http://');
    let finalUrl = streamUrl;
    
    if (needsProxy) {
      finalUrl = `${supabaseUrl}/functions/v1/stream-proxy?url=${encodeURIComponent(streamUrl)}`;
      console.log(`[Stream Resolve] Wrapping HTTP URL through proxy`);
    }

    console.log(`[Stream Resolve] Resolved: ${title} (proxy: ${needsProxy})`);

    return new Response(
      JSON.stringify({
        id: data.id,
        name: title,
        stream_url: finalUrl,
        original_url: streamUrl,
        logo,
        category,
        needsProxy,
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // Cache 5 minutes
        } 
      }
    );

  } catch (error) {
    console.error('[Stream Resolve] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});