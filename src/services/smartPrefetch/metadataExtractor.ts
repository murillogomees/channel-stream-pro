/**
 * Metadata Extractor
 * Extracts lightweight metadata from full channel data
 * Stores stream_url reference but doesn't pass to UI initially
 */

import type { ChannelMetadata, ChannelFull } from './types';

// In-memory stream URL index (id -> url)
const streamUrlIndex = new Map<string, string>();

/**
 * Detect content type from channel data
 */
function detectContentType(channel: any): ChannelMetadata['content_type'] {
  const name = (channel.name || '').toLowerCase();
  const category = (channel.category_name || channel.group_title || '').toLowerCase();
  const url = (channel.stream_url || '').toLowerCase();
  
  // VOD indicators
  if (
    url.includes('/movie/') ||
    url.includes('/vod/') ||
    category.includes('filme') ||
    category.includes('movie') ||
    category.includes('vod')
  ) {
    return 'movie';
  }
  
  // Series indicators
  if (
    url.includes('/series/') ||
    category.includes('série') ||
    category.includes('series') ||
    /s\d{1,2}e\d{1,2}/i.test(name)
  ) {
    return 'series';
  }
  
  // Live TV indicators
  if (
    url.includes('/live/') ||
    url.includes(':8080') ||
    category.includes('tv') ||
    category.includes('ao vivo') ||
    category.includes('live')
  ) {
    return 'live';
  }
  
  return 'unknown';
}

/**
 * Extract lightweight metadata from full channel
 * Stores stream_url in index but doesn't include in metadata
 */
export function extractMetadata(channel: any, categoryId: string): ChannelMetadata {
  const id = channel.id || channel.entry_hash || `ch-${Math.random().toString(36).slice(2)}`;
  
  // Store stream URL in index for later retrieval
  if (channel.stream_url) {
    streamUrlIndex.set(id, channel.stream_url);
  }
  
  return {
    id,
    name: channel.name || channel.title || 'Canal sem nome',
    tvg_logo: channel.tvg_logo || null,
    tvg_id: channel.tvg_id || null,
    category_id: categoryId,
    category_name: channel.category_name || channel.group_title || 'Sem Categoria',
    order_position: channel.sequence || 0,
    content_type: detectContentType(channel),
  };
}

/**
 * Extract metadata from array of channels
 */
export function extractMetadataBatch(channels: any[]): ChannelMetadata[] {
  const categoriesMap = new Map<string, string>();
  
  return channels.map((channel, index) => {
    const categoryName = channel.category_name || channel.group_title || 'Sem Categoria';
    
    if (!categoriesMap.has(categoryName)) {
      categoriesMap.set(categoryName, `cat-${categoriesMap.size}`);
    }
    
    return extractMetadata(channel, categoriesMap.get(categoryName)!);
  });
}

/**
 * Get stream URL from index (for when user plays)
 */
export function getStoredStreamUrl(channelId: string): string | null {
  return streamUrlIndex.get(channelId) || null;
}

/**
 * Check if stream URL is in index
 */
export function hasStoredStreamUrl(channelId: string): boolean {
  return streamUrlIndex.has(channelId);
}

/**
 * Clear stream URL index
 */
export function clearStreamUrlIndex(): void {
  streamUrlIndex.clear();
}

/**
 * Get index stats
 */
export function getIndexStats() {
  return {
    indexedUrls: streamUrlIndex.size,
  };
}

/**
 * Convert metadata back to full channel (with stream from index)
 */
export function metadataToFull(metadata: ChannelMetadata): ChannelFull | null {
  const streamUrl = streamUrlIndex.get(metadata.id);
  if (!streamUrl) return null;
  
  return {
    ...metadata,
    stream_url: streamUrl,
  };
}
