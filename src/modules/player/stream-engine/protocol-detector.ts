/**
 * Protocol Detector
 * Enterprise-grade stream protocol detection without heuristics
 * 
 * Rules:
 * - *.m3u8 → HLS
 * - *.ts → TS  
 * - Xtream URLs → 'xtream' (NOT assumed as TS)
 * - No extension → HEAD request for Content-Type
 * - Unknown → fallback with low confidence
 */

import type { 
  ProtocolType, 
  ProtocolDetectionResult, 
  ContentTypeMapping,
  LogHandler 
} from './types';

// Content-Type to Protocol mappings
const CONTENT_TYPE_MAPPINGS: ContentTypeMapping[] = [
  { contentType: 'application/vnd.apple.mpegurl', protocol: 'hls' },
  { contentType: 'application/x-mpegurl', protocol: 'hls' },
  { contentType: 'audio/mpegurl', protocol: 'hls' },
  { contentType: 'audio/x-mpegurl', protocol: 'hls' },
  { contentType: 'video/mp2t', protocol: 'ts' },
  { contentType: 'video/mpeg', protocol: 'ts' },
  { contentType: 'application/dash+xml', protocol: 'dash' },
  { contentType: 'video/mp4', protocol: 'mp4' },
  { contentType: 'video/quicktime', protocol: 'mp4' },
];

// Extension to Protocol mappings
const EXTENSION_MAPPINGS: Record<string, ProtocolType> = {
  '.m3u8': 'hls',
  '.m3u': 'hls',
  '.ts': 'ts',
  '.mpd': 'dash',
  '.mp4': 'mp4',
  '.mkv': 'mp4',
  '.mov': 'mp4',
};

// Xtream API pattern detection
const XTREAM_PATTERNS = [
  // Pattern: /username/password/streamId (live)
  /^\/([^\/]+)\/([^\/]+)\/(\d+)$/,
  // Pattern: /live/username/password/streamId.ts
  /^\/live\/([^\/]+)\/([^\/]+)\/(\d+)(?:\.ts)?$/,
  // Pattern: /movie/username/password/streamId.ext
  /^\/movie\/([^\/]+)\/([^\/]+)\/(\d+)\.[a-z0-9]+$/i,
  // Pattern: /series/username/password/streamId.ext
  /^\/series\/([^\/]+)\/([^\/]+)\/(\d+)\.[a-z0-9]+$/i,
];

// Known Xtream API endpoints
const XTREAM_ENDPOINTS = [
  '/player_api.php',
  '/panel_api.php',
  '/get.php',
  '/xmltv.php',
];

export class ProtocolDetector {
  private logHandler?: LogHandler;
  private headRequestTimeout: number;
  private cache: Map<string, ProtocolDetectionResult>;
  private cacheMaxAge: number;

  constructor(options?: { 
    logHandler?: LogHandler; 
    headRequestTimeout?: number;
    cacheMaxAge?: number;
  }) {
    this.logHandler = options?.logHandler;
    this.headRequestTimeout = options?.headRequestTimeout ?? 5000;
    this.cacheMaxAge = options?.cacheMaxAge ?? 300000; // 5 minutes
    this.cache = new Map();
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
    this.logHandler?.({
      level,
      module: 'ProtocolDetector',
      message,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Main detection method - determines stream protocol
   */
  async detectStreamType(url: string, options?: { 
    skipHead?: boolean;
    forceRefresh?: boolean;
  }): Promise<ProtocolDetectionResult> {
    const cacheKey = url;
    
    // Check cache first
    if (!options?.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - (cached.metadata?.cachedAt as number || 0)) < this.cacheMaxAge) {
        this.log('debug', 'Using cached detection result', { url });
        return cached;
      }
    }

    this.log('info', 'Detecting stream protocol', { url });

    let result: ProtocolDetectionResult;

    // Step 1: Check for Xtream API pattern FIRST
    const xtreamCheck = this.isXtreamUrl(url);
    if (xtreamCheck.isXtream) {
      result = {
        protocol: 'xtream',
        confidence: 'high',
        detectionMethod: 'pattern',
        originalUrl: url,
        normalizedUrl: url,
        metadata: { 
          xtreamType: xtreamCheck.type,
          cachedAt: Date.now()
        },
      };
      this.cache.set(cacheKey, result);
      this.log('info', 'Detected Xtream API URL', { url, type: xtreamCheck.type });
      return result;
    }

    // Step 2: Try extension-based detection
    const extensionResult = this.detectByExtension(url);
    if (extensionResult) {
      result = {
        ...extensionResult,
        metadata: { ...extensionResult.metadata, cachedAt: Date.now() }
      };
      this.cache.set(cacheKey, result);
      this.log('info', 'Detected protocol by extension', { url, protocol: result.protocol });
      return result;
    }

    // Step 3: HEAD request for Content-Type (if not skipped)
    if (!options?.skipHead) {
      const headResult = await this.detectByContentType(url);
      if (headResult) {
        result = {
          ...headResult,
          metadata: { ...headResult.metadata, cachedAt: Date.now() }
        };
        this.cache.set(cacheKey, result);
        this.log('info', 'Detected protocol by Content-Type', { 
          url, 
          protocol: result.protocol,
          contentType: result.contentType 
        });
        return result;
      }
    }

    // Step 4: Fallback to unknown
    result = {
      protocol: 'unknown',
      confidence: 'low',
      detectionMethod: 'fallback',
      originalUrl: url,
      normalizedUrl: url,
      metadata: { cachedAt: Date.now() },
    };
    this.cache.set(cacheKey, result);
    this.log('warn', 'Could not detect protocol, using fallback', { url });
    return result;
  }

  /**
   * Synchronous quick detection (extension only, no network)
   */
  detectStreamTypeSync(url: string): ProtocolDetectionResult {
    // Check Xtream first
    const xtreamCheck = this.isXtreamUrl(url);
    if (xtreamCheck.isXtream) {
      return {
        protocol: 'xtream',
        confidence: 'high',
        detectionMethod: 'pattern',
        originalUrl: url,
        normalizedUrl: url,
        metadata: { xtreamType: xtreamCheck.type },
      };
    }

    // Check extension
    const extensionResult = this.detectByExtension(url);
    if (extensionResult) {
      return extensionResult;
    }

    // Unknown fallback
    return {
      protocol: 'unknown',
      confidence: 'low',
      detectionMethod: 'fallback',
      originalUrl: url,
      normalizedUrl: url,
    };
  }

  /**
   * Check if URL is an Xtream API URL
   * IMPORTANT: Does NOT assume protocol based on port!
   */
  private isXtreamUrl(url: string): { isXtream: boolean; type?: 'live' | 'movie' | 'series' | 'api' } {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;

      // Check for Xtream API endpoints
      for (const endpoint of XTREAM_ENDPOINTS) {
        if (pathname.includes(endpoint)) {
          return { isXtream: true, type: 'api' };
        }
      }

      // Check for Xtream stream patterns
      for (const pattern of XTREAM_PATTERNS) {
        if (pattern.test(pathname)) {
          // Determine type from path
          let type: 'live' | 'movie' | 'series' = 'live';
          if (pathname.startsWith('/movie/')) type = 'movie';
          else if (pathname.startsWith('/series/')) type = 'series';
          
          return { isXtream: true, type };
        }
      }

      // NOTE: We do NOT check port numbers (8880, 8080, etc.)
      // Port-based detection is unreliable and leads to wrong protocol assumptions

      return { isXtream: false };
    } catch {
      return { isXtream: false };
    }
  }

  /**
   * Detect protocol by file extension
   */
  private detectByExtension(url: string): ProtocolDetectionResult | null {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname.toLowerCase();
      
      for (const [ext, protocol] of Object.entries(EXTENSION_MAPPINGS)) {
        if (pathname.endsWith(ext)) {
          return {
            protocol,
            confidence: 'high',
            detectionMethod: 'extension',
            originalUrl: url,
            normalizedUrl: url,
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Detect protocol by Content-Type via HEAD request
   */
  private async detectByContentType(url: string): Promise<ProtocolDetectionResult | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.headRequestTimeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
        },
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type')?.toLowerCase() || '';

      for (const mapping of CONTENT_TYPE_MAPPINGS) {
        if (contentType.includes(mapping.contentType)) {
          return {
            protocol: mapping.protocol,
            confidence: 'high',
            detectionMethod: 'content-type',
            contentType,
            originalUrl: url,
            normalizedUrl: url,
          };
        }
      }

      // Check for generic video types that might be HLS
      if (contentType.includes('video/') || contentType.includes('application/octet-stream')) {
        // Could be anything, return medium confidence
        return {
          protocol: 'unknown',
          confidence: 'medium',
          detectionMethod: 'content-type',
          contentType,
          originalUrl: url,
          normalizedUrl: url,
        };
      }

      return null;
    } catch (error) {
      this.log('warn', 'HEAD request failed', { url, error: String(error) });
      return null;
    }
  }

  /**
   * Clear detection cache
   */
  clearCache(): void {
    this.cache.clear();
    this.log('debug', 'Detection cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; maxAge: number } {
    return {
      size: this.cache.size,
      maxAge: this.cacheMaxAge,
    };
  }
}

// Singleton instance
let detectorInstance: ProtocolDetector | null = null;

export function getProtocolDetector(options?: {
  logHandler?: LogHandler;
  headRequestTimeout?: number;
}): ProtocolDetector {
  if (!detectorInstance) {
    detectorInstance = new ProtocolDetector(options);
  }
  return detectorInstance;
}

/**
 * Quick synchronous detection function
 */
export function detectStreamTypeSync(url: string): ProtocolType {
  return getProtocolDetector().detectStreamTypeSync(url).protocol;
}

/**
 * Full async detection function
 */
export async function detectStreamType(url: string): Promise<ProtocolDetectionResult> {
  return getProtocolDetector().detectStreamType(url);
}
