/**
 * Stream Resolver Service
 * Resolves stream URLs on-demand when user presses play
 */

import { supabase } from '@/integrations/supabase/client';
import type { StreamResolution } from './types';

// In-memory cache for resolved streams (short TTL)
const streamCache = new Map<string, StreamResolution>();
const STREAM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Resolution time tracking
const resolutionTimes: number[] = [];
const MAX_TRACKED_TIMES = 100;

/**
 * Detect stream protocol from URL
 */
function detectProtocol(url: string): StreamResolution['protocol'] {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('.m3u8') || lowerUrl.includes('/hls/')) {
    return 'hls';
  }
  if (lowerUrl.includes('.ts') || lowerUrl.includes(':8080') || lowerUrl.includes('/live/')) {
    return 'mpegts';
  }
  if (lowerUrl.includes('.mp4') || lowerUrl.includes('/movie/') || lowerUrl.includes('/vod/')) {
    return 'mp4';
  }
  if (lowerUrl.includes('.mpd') || lowerUrl.includes('/dash/')) {
    return 'dash';
  }
  
  return 'unknown';
}

/**
 * Resolve stream URL for a channel
 * Uses cache when available, fetches from server when needed
 */
export async function resolveStream(
  channelId: string,
  playlistUrl: string
): Promise<StreamResolution | null> {
  const cacheKey = `${channelId}`;
  const startTime = performance.now();
  
  // Check memory cache first
  const cached = streamCache.get(cacheKey);
  if (cached && Date.now() - cached.resolvedAt < STREAM_CACHE_TTL) {
    console.log(`[StreamResolver] Cache hit for ${channelId}`);
    return { ...cached, cached: true };
  }
  
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token || '';
    
    // Fetch single channel stream from server
    const response = await fetch('https://supabase.iptvlink.com.br/functions/v1/fetch-m3u-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: playlistUrl,
        channelId,
        streamOnly: true, // Signal we only want the stream URL
        limit: 1,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const channel = data.channels?.[0] || data.channel;
    
    if (!channel?.stream_url) {
      console.warn(`[StreamResolver] No stream found for ${channelId}`);
      return null;
    }
    
    const resolution: StreamResolution = {
      url: channel.stream_url,
      protocol: detectProtocol(channel.stream_url),
      quality: channel.quality,
      cached: false,
      resolvedAt: Date.now(),
    };
    
    // Cache the resolution
    streamCache.set(cacheKey, resolution);
    
    // Track resolution time
    const elapsed = performance.now() - startTime;
    resolutionTimes.push(elapsed);
    if (resolutionTimes.length > MAX_TRACKED_TIMES) {
      resolutionTimes.shift();
    }
    
    console.log(`[StreamResolver] Resolved ${channelId} in ${elapsed.toFixed(0)}ms`);
    
    return resolution;
    
  } catch (err) {
    console.error(`[StreamResolver] Error resolving ${channelId}:`, err);
    return null;
  }
}

/**
 * Pre-warm stream cache for likely next channels
 */
export async function prewarmStreams(
  channelIds: string[],
  playlistUrl: string
): Promise<void> {
  // Only prewarm a few channels to avoid overhead
  const toPrewarm = channelIds.slice(0, 3);
  
  for (const id of toPrewarm) {
    if (!streamCache.has(id)) {
      // Fire and forget - don't block
      resolveStream(id, playlistUrl).catch(() => {});
    }
  }
}

/**
 * Clear stream cache
 */
export function clearStreamCache(): void {
  streamCache.clear();
  console.log('[StreamResolver] Cache cleared');
}

/**
 * Get resolution stats
 */
export function getResolutionStats() {
  const avg = resolutionTimes.length > 0
    ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
    : 0;
    
  return {
    cacheSize: streamCache.size,
    avgResolutionTimeMs: Math.round(avg),
    resolutionCount: resolutionTimes.length,
  };
}
