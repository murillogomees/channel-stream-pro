/**
 * Smart Stream Resolver
 * 
 * Determines the optimal way to play video content:
 * - VOD (movies, series): Direct URL (no proxy)
 * - HLS manifests: Through Cloudflare Worker for URL rewriting
 * - Live streams: Through Cloudflare Worker for HTTP URLs
 * 
 * Uses Cloudflare Worker as PRIMARY proxy (faster, distributed edge).
 * Falls back to Supabase Edge Function if needed.
 */

import { SUPABASE_URL } from '@/config/supabase';

// Cloudflare Worker - PRIMARY (faster, distributed edge locations)
const CLOUDFLARE_WORKER_URL = 'https://iptv-stream-proxy.storgetec.workers.dev';

// Supabase Edge Function - FALLBACK
const SUPABASE_PROXY_URL = `${SUPABASE_URL}/functions/v1/stream-proxy`;

// Use Cloudflare Worker as primary proxy
const PROXY_URL = CLOUDFLARE_WORKER_URL;

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
         urlLower.includes('.avi') ||
         urlLower.includes('.webm');
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
 * Check if URL is HTTP (needs proxy for HTTPS pages)
 */
function isHttpUrl(url: string): boolean {
  return url.startsWith('http://');
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
 * - HTTP URLs: Always use proxy (Mixed Content policy)
 * - VOD content: Use direct URL (Edge Functions timeout on large files)
 * - HLS manifests: Use proxy for URL rewriting (manifests are small/fast)
 * - Live streams: Direct or CDN Router for HTTPS, proxy for HTTP
 */
export function resolveStreamUrl(originalUrl: string): StreamResolution {
  const url = extractOriginalUrl(originalUrl);
  
  // HTTP URLs MUST use proxy for Mixed Content compliance
  if (isHttpUrl(url)) {
    const contentType = isVodContent(url) ? 'vod' : isDirectLiveStream(url) ? 'live' : 'unknown';
    return {
      url: `${PROXY_URL}?url=${encodeURIComponent(url)}`,
      type: 'proxy',
      contentType,
      fallbackUrl: url, // Keep original as fallback (for native apps)
    };
  }
  
  // HLS manifest with HTTPS - use proxy for URL rewriting (manifests are tiny)
  if (isHlsManifest(url) && !isVodContent(url)) {
    return {
      url: `${PROXY_URL}?url=${encodeURIComponent(url)}`,
      type: 'proxy',
      contentType: 'hls',
      fallbackUrl: url,
    };
  }
  
  // HTTPS URLs - direct access
  const contentType = isVodContent(url) ? 'vod' : isDirectLiveStream(url) ? 'live' : 'unknown';
  return {
    url: url,
    type: 'direct',
    contentType: contentType,
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

/**
 * Get optimized stream URL - convenience wrapper
 */
export function getOptimizedStreamUrl(originalUrl: string): string {
  const resolution = resolveStreamUrl(originalUrl);
  return resolution.url;
}
