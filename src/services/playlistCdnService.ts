/**
 * Playlist CDN Service
 * 
 * Hybrid architecture:
 * - Metadata (name, logo, category) from R2/CDN - fast, cached
 * - Stream URL resolved on-demand when user clicks to play
 * 
 * Benefits:
 * - Initial load: ~20MB instead of ~200MB
 * - Instant category navigation
 * - Stream URLs always fresh
 */

import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = 'https://sdvyxdghxqmntyoweqbd.supabase.co';

export interface LightChannel {
  id: string;
  name: string;
  logo: string | null;
  cat: string;
  seq: number;
  // stream_url is NOT included - fetched on demand
}

export interface PlaylistManifest {
  version: number;
  generatedAt: string;
  totalChannels: number;
  categories: string[];
  chunksCount: number;
  chunkSize: number;
}

export interface ResolvedChannel {
  id: string;
  name: string;
  stream_url: string;
  original_url: string;
  logo: string | null;
  category: string;
  needsProxy: boolean;
}

// Cache for resolved stream URLs
interface StreamCacheEntry {
  url: string;
  name?: string;
  logo?: string | null;
  category?: string;
  needsProxy?: boolean;
  expiresAt: number;
}
const streamUrlCache = new Map<string, StreamCacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load playlist manifest from CDN/storage
 */
export async function loadPlaylistManifest(playlistKey: string): Promise<PlaylistManifest | null> {
  try {
    // Try Supabase storage first
    const { data, error } = await supabase.storage
      .from('playlists')
      .download(`playlist/${playlistKey}/manifest.json`);

    if (error || !data) {
      console.warn('[PlaylistCDN] Manifest not found, using legacy API');
      return null;
    }

    const text = await data.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('[PlaylistCDN] Error loading manifest:', error);
    return null;
  }
}

/**
 * Load a chunk of channels from CDN/storage
 */
export async function loadPlaylistChunk(
  playlistKey: string, 
  chunkIndex: number
): Promise<LightChannel[]> {
  try {
    const { data, error } = await supabase.storage
      .from('playlists')
      .download(`playlist/${playlistKey}/chunk-${chunkIndex}.json`);

    if (error || !data) {
      console.warn(`[PlaylistCDN] Chunk ${chunkIndex} not found`);
      return [];
    }

    const text = await data.text();
    return JSON.parse(text);
  } catch (error) {
    console.error(`[PlaylistCDN] Error loading chunk ${chunkIndex}:`, error);
    return [];
  }
}

/**
 * Resolve stream URL on-demand (called when user clicks to play)
 */
export async function resolveStreamUrl(channelId: string): Promise<ResolvedChannel | null> {
  // Check cache first
  const cached = streamUrlCache.get(channelId);
  if (cached && cached.expiresAt > Date.now()) {
    console.log('[StreamResolve] Cache hit:', channelId);
    return {
      id: channelId,
      name: cached.name || '',
      stream_url: cached.url,
      original_url: cached.url,
      logo: cached.logo || null,
      category: cached.category || '',
      needsProxy: cached.needsProxy || false,
    };
  }

  try {
    console.log('[StreamResolve] Fetching:', channelId);
    
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/stream-url-resolve?id=${channelId}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('[StreamResolve] Failed:', response.status);
      return null;
    }

    const data: ResolvedChannel = await response.json();
    
    // Cache the result
    streamUrlCache.set(channelId, {
      url: data.stream_url,
      name: data.name,
      logo: data.logo,
      category: data.category,
      needsProxy: data.needsProxy,
      expiresAt: Date.now() + CACHE_TTL,
    });

    console.log('[StreamResolve] Resolved:', data.name);
    return data;
  } catch (error) {
    console.error('[StreamResolve] Error:', error);
    return null;
  }
}

/**
 * Generate CDN playlist (admin only)
 */
export async function generateCdnPlaylist(playlistKey: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('playlist-cdn-generate', {
      body: { playlistKey },
    });

    if (error) {
      console.error('[PlaylistCDN] Generate error:', error);
      return false;
    }

    console.log('[PlaylistCDN] Generated:', data);
    return true;
  } catch (error) {
    console.error('[PlaylistCDN] Generate error:', error);
    return false;
  }
}

/**
 * Clear stream URL cache
 */
export function clearStreamCache(): void {
  streamUrlCache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: streamUrlCache.size,
    entries: Array.from(streamUrlCache.keys()),
  };
}
