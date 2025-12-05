/**
 * Smart Prefetch Types
 * Separates lightweight metadata from heavy stream data
 */

// Lightweight channel metadata (pre-loaded)
export interface ChannelMetadata {
  id: string;
  name: string;
  tvg_logo: string | null;
  tvg_id: string | null;
  category_id: string;
  category_name: string;
  order_position: number;
  content_type: 'live' | 'movie' | 'series' | 'unknown';
}

// Full channel with stream (loaded on-demand)
export interface ChannelFull extends ChannelMetadata {
  stream_url: string;
}

// Stream resolution result
export interface StreamResolution {
  url: string;
  protocol: 'hls' | 'mpegts' | 'mp4' | 'dash' | 'unknown';
  quality?: string;
  cached: boolean;
  resolvedAt: number;
}

// Prefetch stats for monitoring
export interface PrefetchStats {
  metadataLoaded: number;
  streamsResolved: number;
  cacheHits: number;
  cacheMisses: number;
  avgResolutionTimeMs: number;
}
