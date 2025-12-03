/**
 * Smart Stream Resolver
 * 
 * Determines the optimal way to play video content:
 * - VOD (movies, series): Direct URL (no proxy)
 * - HLS manifests: Through proxy for URL rewriting
 * - Live streams: Through CDN Router or direct
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

export interface StreamResolution {
  url: string;
  type: 'direct' | 'proxy' | 'cdn_router';
  contentType: 'vod' | 'live' | 'hls' | 'unknown';
  fallbackUrl?: string;
}

/**
 * Detect if URL is VOD content (movies, series)
 */
function isVodContent(url: string): boolean {
  const urlLower = url.toLowerCase();
  return urlLower.includes('/movie/') || 
         urlLower.includes('/series/') || 
         urlLower.includes('/vod/') ||
         urlLower.includes('.mp4') ||
         urlLower.includes('.mkv') ||
         urlLower.includes('.avi');
}

/**
 * Detect if URL is HLS manifest
 */
function isHlsManifest(url: string): boolean {
  const urlLower = url.toLowerCase();
  return urlLower.includes('.m3u8') || urlLower.includes('.m3u');
}

/**
 * Detect if URL is a direct live stream (Xtream Codes pattern)
 */
function isDirectLiveStream(url: string): boolean {
  const urlLower = url.toLowerCase();
  // Pattern: /live/user/pass/123 or /user/pass/123
  const xtreamPattern = /\/(?:live\/)?[^\/]+\/[^\/]+\/\d+$/;
  return xtreamPattern.test(urlLower) && !isHlsManifest(urlLower);
}

/**
 * Extract original URL if it's a proxy URL
 */
function extractOriginalUrl(url: string): string {
  if (url.includes('stream-proxy') && url.includes('url=')) {
    try {
      const urlObj = new URL(url);
      const originalUrl = urlObj.searchParams.get('url');
      if (originalUrl) return decodeURIComponent(originalUrl);
    } catch {
      // Fall through
    }
  }
  if (url.includes('cdn-router') && url.includes('url=')) {
    try {
      const urlObj = new URL(url);
      const originalUrl = urlObj.searchParams.get('url');
      if (originalUrl) return decodeURIComponent(originalUrl);
    } catch {
      // Fall through
    }
  }
  return url;
}

/**
 * Resolve the optimal streaming URL for given content
 * 
 * Strategy:
 * - VOD content: Use direct URL (Edge Functions timeout on large files)
 * - HLS manifests: Use proxy for URL rewriting (manifests are small/fast)
 * - Live streams: Direct or CDN Router
 */
export function resolveStreamUrl(originalUrl: string): StreamResolution {
  const url = extractOriginalUrl(originalUrl);
  
  // VOD content - ALWAYS use direct URL
  // Edge Functions cannot handle large file streaming
  if (isVodContent(url)) {
    console.log('[SmartResolver] VOD detected, using direct URL');
    return {
      url: url,
      type: 'direct',
      contentType: 'vod',
    };
  }
  
  // HLS manifest - use proxy for URL rewriting
  // Manifests are small text files, fast to process
  if (isHlsManifest(url)) {
    const proxyUrl = `${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`;
    console.log('[SmartResolver] HLS manifest, using proxy');
    return {
      url: proxyUrl,
      type: 'proxy',
      contentType: 'hls',
      fallbackUrl: url, // Fallback to direct if proxy fails
    };
  }
  
  // Direct live stream (Xtream) - use direct URL
  // These are continuous streams that Edge Functions can't handle
  if (isDirectLiveStream(url)) {
    console.log('[SmartResolver] Direct live stream, using direct URL');
    return {
      url: url,
      type: 'direct',
      contentType: 'live',
    };
  }
  
  // Unknown - try direct first
  console.log('[SmartResolver] Unknown content type, using direct URL');
  return {
    url: url,
    type: 'direct',
    contentType: 'unknown',
  };
}

/**
 * Get fallback URL for when primary fails
 */
export function getFallbackUrl(resolution: StreamResolution): string | undefined {
  if (resolution.fallbackUrl) {
    return resolution.fallbackUrl;
  }
  
  // If proxy failed, try direct
  if (resolution.type === 'proxy') {
    return extractOriginalUrl(resolution.url);
  }
  
  return undefined;
}
