/**
 * IPTV M3U Generator - Scalable Tokenized Playlist Generation
 * 
 * Features:
 * - Tokenized URLs for secure playback
 * - Streaming/paginated response for 209k+ channels
 * - Redis cache integration (external)
 * - LL-HLS ready manifest URLs
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const BATCH_SIZE = 500; // Channels per batch for streaming
const TOKEN_TTL = 3600; // 1 hour token validity
const CDN_BASE_URL = Deno.env.get('CDN_WORKER_URL') || '';
const STREAM_PROXY_URL = Deno.env.get('SUPABASE_URL') + '/functions/v1/stream-proxy';

interface Channel {
  id: number;
  slug: string;
  name: string;
  original_url: string;
  logo_url: string | null;
  category: string | null;
  content_type: string;
  transcode_status: string;
  transcode_manifest_url: string | null;
  is_healthy: boolean;
}

interface GeneratorOptions {
  playlistId?: number;
  category?: string;
  offset?: number;
  limit?: number;
  format?: 'm3u' | 'json';
  includeUnhealthy?: boolean;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const authHeader = req.headers.get('Authorization');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }

    // Parse options
    const options: GeneratorOptions = {
      playlistId: url.searchParams.get('playlist_id') ? parseInt(url.searchParams.get('playlist_id')!) : undefined,
      category: url.searchParams.get('category') || undefined,
      offset: parseInt(url.searchParams.get('offset') || '0'),
      limit: parseInt(url.searchParams.get('limit') || '1000'),
      format: (url.searchParams.get('format') as 'm3u' | 'json') || 'm3u',
      includeUnhealthy: url.searchParams.get('include_unhealthy') === 'true',
    };

    // Build query
    let query = supabase
      .from('iptv_channels')
      .select('id, slug, name, original_url, logo_url, category, content_type, transcode_status, transcode_manifest_url, is_healthy')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    // Filter by playlist if specified
    if (options.playlistId) {
      const { data: playlistChannels } = await supabase
        .from('iptv_playlist_channels')
        .select('channel_id, position')
        .eq('playlist_id', options.playlistId)
        .eq('is_hidden', false)
        .order('position', { ascending: true });

      if (playlistChannels && playlistChannels.length > 0) {
        const channelIds = playlistChannels.map(pc => pc.channel_id);
        query = query.in('id', channelIds);
      }
    }

    // Filter by category
    if (options.category) {
      query = query.eq('category', options.category);
    }

    // Filter healthy only
    if (!options.includeUnhealthy) {
      query = query.eq('is_healthy', true);
    }

    // Apply pagination
    query = query.range(options.offset!, options.offset! + options.limit! - 1);

    const { data: channels, error: queryError } = await query;

    if (queryError) {
      console.error('Query error:', queryError);
      throw new Error('Failed to fetch channels');
    }

    if (!channels || channels.length === 0) {
      return new Response(
        options.format === 'json' 
          ? JSON.stringify({ channels: [], count: 0 })
          : '#EXTM3U\n#EXTINF:-1,No channels available\n',
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': options.format === 'json' ? 'application/json' : 'audio/x-mpegurl' 
          } 
        }
      );
    }

    // Generate response based on format
    if (options.format === 'json') {
      const channelsWithTokens = await Promise.all(
        channels.map(async (channel: Channel) => ({
          ...channel,
          stream_url: await generateStreamUrl(supabase, userId, channel),
        }))
      );

      return new Response(
        JSON.stringify({
          channels: channelsWithTokens,
          count: channelsWithTokens.length,
          offset: options.offset,
          has_more: channels.length === options.limit,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate M3U
    const m3uContent = await generateM3U(supabase, userId, channels);
    
    return new Response(m3uContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/x-mpegurl',
        'Content-Disposition': `attachment; filename="playlist_${Date.now()}.m3u"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('M3U Generator error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateM3U(supabase: any, userId: string | null, channels: Channel[]): Promise<string> {
  let m3u = '#EXTM3U\n';
  m3u += '#EXTM3U url-tvg="http://example.com/epg.xml"\n\n';

  for (const channel of channels) {
    const streamUrl = await generateStreamUrl(supabase, userId, channel);
    
    // Build EXTINF line
    let extinf = `#EXTINF:-1`;
    
    if (channel.logo_url) {
      extinf += ` tvg-logo="${channel.logo_url}"`;
    }
    
    if (channel.category) {
      extinf += ` group-title="${channel.category}"`;
    }
    
    extinf += ` tvg-id="${channel.slug}"`;
    extinf += `,${channel.name}\n`;
    
    m3u += extinf;
    m3u += `${streamUrl}\n`;
  }

  return m3u;
}

async function generateStreamUrl(supabase: any, userId: string | null, channel: Channel): Promise<string> {
  // Priority: Transcoded manifest > CDN > Stream proxy > Original
  
  // 1. If transcoded and ready, use manifest URL
  if (channel.transcode_status === 'ready' && channel.transcode_manifest_url) {
    // Generate signed URL for CDN
    if (CDN_BASE_URL) {
      return `${CDN_BASE_URL}/hls/${channel.slug}/master.m3u8`;
    }
    return channel.transcode_manifest_url;
  }

  // 2. Generate tokenized URL through stream proxy
  if (userId) {
    // Generate a stream token
    const { data: tokenData } = await supabase.rpc('generate_stream_token', {
      p_user_id: userId,
      p_channel_id: channel.id,
      p_ttl_seconds: TOKEN_TTL,
    });

    if (tokenData) {
      return `${STREAM_PROXY_URL}?token=${tokenData}&channel=${channel.slug}`;
    }
  }

  // 3. Fallback to proxied URL (for non-authenticated access)
  const encodedUrl = encodeURIComponent(channel.original_url);
  return `${STREAM_PROXY_URL}?url=${encodedUrl}`;
}
