/**
 * StreamResolver - Resolução e reescrita de URLs de stream
 * 
 * Responsabilidades:
 * - Aceitar .m3u8
 * - Resolver .ts
 * - Reescrever URLs para proxy
 * - Normalizar streams inconsistentes
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export interface StreamInfo {
  originalUrl: string
  proxyUrl: string
  isHls: boolean
  isSegment: boolean
  contentType: 'live' | 'vod' | 'unknown'
}

export class StreamResolver {
  private static instance: StreamResolver
  private readonly proxyEndpoint = `${SUPABASE_URL}/functions/v1/stream-proxy`

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
    
    // Already proxied
    if (url.includes('/functions/v1/stream-proxy')) {
      return url
    }

    // Wrap through proxy
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
