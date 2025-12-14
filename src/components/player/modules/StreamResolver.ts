/**
 * StreamResolver - Resolução e reescrita de URLs de stream
 * 
 * Responsabilidades:
 * - Aceitar .m3u8
 * - Resolver .ts
 * - Reescrever URLs para proxy
 * - Normalizar streams inconsistentes
 */

import { SUPABASE_URL } from '@/config/supabase';

// Cloudflare Worker proxy URL - PRIMARY (faster, distributed edge)
// Format: https://iptv-stream-proxy.<account>.workers.dev
const CLOUDFLARE_WORKER_URL = 'https://iptv-stream-proxy.murillogg.workers.dev';

// Supabase Edge Function - FALLBACK
const SUPABASE_PROXY_URL = `${SUPABASE_URL}/functions/v1/stream-proxy`;

export interface StreamInfo {
  originalUrl: string
  proxyUrl: string
  isHls: boolean
  isSegment: boolean
  contentType: 'live' | 'vod' | 'unknown'
}

export class StreamResolver {
  private static instance: StreamResolver
  // Prefer Cloudflare Worker (faster), fallback to Supabase
  private readonly proxyEndpoint = CLOUDFLARE_WORKER_URL || SUPABASE_PROXY_URL

  private constructor() {}

  static getInstance(): StreamResolver {
    if (!StreamResolver.instance) {
      StreamResolver.instance = new StreamResolver()
    }
    return StreamResolver.instance
  }

  /**
   * Resolve any URL to proxy URL
   */
  resolve(url: string): string {
    if (!url) return ''
    
    // Already proxied (Supabase or Cloudflare)
    if (url.includes('/functions/v1/stream-proxy') || url.includes('iptv-stream-proxy')) {
      return url
    }

    // Wrap through proxy (Cloudflare Worker or Supabase fallback)
    return `${this.proxyEndpoint}?url=${encodeURIComponent(url)}`
  }

  /**
   * Get stream info without resolving
   */
  analyze(url: string): StreamInfo {
    const urlLower = url.toLowerCase()
    
    return {
      originalUrl: url,
      proxyUrl: this.resolve(url),
      isHls: urlLower.includes('.m3u8') || urlLower.includes('.m3u'),
      isSegment: urlLower.includes('.ts') || urlLower.includes('.m4s'),
      contentType: this.detectContentType(url)
    }
  }

  /**
   * Check if URL is HLS manifest
   */
  isManifest(url: string): boolean {
    const urlLower = url.toLowerCase()
    return urlLower.includes('.m3u8') || urlLower.includes('.m3u')
  }

  /**
   * Check if URL is media segment
   */
  isSegment(url: string): boolean {
    const urlLower = url.toLowerCase()
    return urlLower.includes('.ts') || 
           urlLower.includes('.m4s') || 
           urlLower.includes('.aac') ||
           urlLower.includes('.mp4') ||
           urlLower.includes('.fmp4')
  }

  /**
   * Normalize URL - ensure proper encoding
   */
  normalize(url: string): string {
    try {
      const parsed = new URL(url)
      return parsed.toString()
    } catch {
      return url
    }
  }

  /**
   * Extract base URL for relative resolution
   */
  getBaseUrl(url: string): string {
    try {
      const parsed = new URL(url)
      const pathParts = parsed.pathname.split('/')
      pathParts.pop()
      return `${parsed.protocol}//${parsed.host}${pathParts.join('/')}`
    } catch {
      const lastSlash = url.lastIndexOf('/')
      return lastSlash > 0 ? url.substring(0, lastSlash) : url
    }
  }

  /**
   * Resolve relative URL against base
   */
  resolveRelative(relativeUrl: string, baseUrl: string): string {
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl
    }
    
    if (relativeUrl.startsWith('/')) {
      try {
        const base = new URL(baseUrl)
        return `${base.protocol}//${base.host}${relativeUrl}`
      } catch {
        return relativeUrl
      }
    }
    
    return `${baseUrl}/${relativeUrl}`
  }

  private detectContentType(url: string): 'live' | 'vod' | 'unknown' {
    const urlLower = url.toLowerCase()
    
    if (urlLower.includes('/live/') || urlLower.includes('live.m3u8')) {
      return 'live'
    }
    
    if (urlLower.includes('/vod/') || urlLower.includes('/series/') || urlLower.includes('.mp4')) {
      return 'vod'
    }
    
    return 'unknown'
  }
}

export const streamResolver = StreamResolver.getInstance()
