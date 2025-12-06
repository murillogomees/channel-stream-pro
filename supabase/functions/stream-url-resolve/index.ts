/**
 * stream-url-resolve
 * 
 * Resolves stream URL for a specific channel on-demand.
 * Called when user clicks to play a channel.
 * 
 * This is part of the Hybrid CDN architecture:
 * - Playlist metadata: Served from R2/CDN (fast, cached)
 * - Stream URL: Resolved on-demand (fresh, authenticated)
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

    if (req.method === 'GET') {
      const url = new URL(req.url);
      channelId = url.searchParams.get('id');
    } else {
      const body = await req.json();
      channelId = body.channelId || body.id;
    }

    if (!channelId) {
      return new Response(
        JSON.stringify({ error: 'channelId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Stream Resolve] Channel: ${channelId}`);

    // Fetch stream_url from database
    const { data, error } = await supabase
      .from('m3u_sync_entries')
      .select('id, name, stream_url, tvg_logo, category_name')
      .eq('id', channelId)
      .single();

    if (error || !data) {
      console.error('[Stream Resolve] Not found:', channelId);
      return new Response(
        JSON.stringify({ error: 'Channel not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if stream needs proxy (HTTP in HTTPS context)
    let streamUrl = data.stream_url;
    const needsProxy = streamUrl?.startsWith('http://');
    
    if (needsProxy) {
      const proxyUrl = `${supabaseUrl}/functions/v1/stream-proxy?url=${encodeURIComponent(streamUrl)}`;
      streamUrl = proxyUrl;
    }

    console.log(`[Stream Resolve] Resolved: ${data.name} (proxy: ${needsProxy})`);

    return new Response(
      JSON.stringify({
        id: data.id,
        name: data.name,
        stream_url: streamUrl,
        original_url: data.stream_url,
        logo: data.tvg_logo,
        category: data.category_name,
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
