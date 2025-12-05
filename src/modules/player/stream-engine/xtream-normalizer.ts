/**
 * Xtream Normalizer
 * Transforms Xtream API URLs into playable stream URLs
 * 
 * NO port-based heuristics - only pattern-based detection
 */

import type { 
  XtreamCredentials, 
  XtreamStreamInfo, 
  XtreamNormalizedResult,
  LogHandler 
} from './types';

// Xtream URL patterns
const XTREAM_LIVE_PATTERN = /^\/(?:live\/)?([^\/]+)\/([^\/]+)\/(\d+)(?:\.ts)?$/;
const XTREAM_MOVIE_PATTERN = /^\/movie\/([^\/]+)\/([^\/]+)\/(\d+)\.([a-z0-9]+)$/i;
const XTREAM_SERIES_PATTERN = /^\/series\/([^\/]+)\/([^\/]+)\/(\d+)\.([a-z0-9]+)$/i;

export class XtreamNormalizer {
  private logHandler?: LogHandler;
  private validationTimeout: number;

  constructor(options?: {
    logHandler?: LogHandler;
    validationTimeout?: number;
  }) {
    this.logHandler = options?.logHandler;
    this.validationTimeout = options?.validationTimeout ?? 5000;
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
    this.logHandler?.({
      level,
      module: 'XtreamNormalizer',
      message,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Parse Xtream URL into components
   */
  parseXtreamUrl(url: string): XtreamStreamInfo | null {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      const server = `${parsed.protocol}//${parsed.host}`;

      // Try live pattern
      let match = pathname.match(XTREAM_LIVE_PATTERN);
      if (match) {
        return {
          streamId: match[3],
          streamType: 'live',
          credentials: {
            server,
            username: match[1],
            password: match[2],
            port: parsed.port ? parseInt(parsed.port) : undefined,
          },
          originalUrl: url,
        };
      }

      // Try movie pattern
      match = pathname.match(XTREAM_MOVIE_PATTERN);
      if (match) {
        return {
          streamId: match[3],
          streamType: 'movie',
          credentials: {
            server,
            username: match[1],
            password: match[2],
            port: parsed.port ? parseInt(parsed.port) : undefined,
          },
          originalUrl: url,
        };
      }

      // Try series pattern
      match = pathname.match(XTREAM_SERIES_PATTERN);
      if (match) {
        return {
          streamId: match[3],
          streamType: 'series',
          credentials: {
            server,
            username: match[1],
            password: match[2],
            port: parsed.port ? parseInt(parsed.port) : undefined,
          },
          originalUrl: url,
        };
      }

      return null;
    } catch (error) {
      this.log('error', 'Failed to parse Xtream URL', { url, error: String(error) });
      return null;
    }
  }

  /**
   * Build HLS URL from Xtream credentials
   */
  buildHlsUrl(info: XtreamStreamInfo): string {
    const { server, username, password } = info.credentials;
    const { streamId, streamType } = info;

    switch (streamType) {
      case 'live':
        return `${server}/live/${username}/${password}/${streamId}.m3u8`;
      case 'movie':
        return `${server}/movie/${username}/${password}/${streamId}.m3u8`;
      case 'series':
        return `${server}/series/${username}/${password}/${streamId}.m3u8`;
      default:
        return `${server}/${username}/${password}/${streamId}.m3u8`;
    }
  }

  /**
   * Build TS URL from Xtream credentials
   */
  buildTsUrl(info: XtreamStreamInfo): string {
    const { server, username, password } = info.credentials;
    const { streamId, streamType } = info;

    switch (streamType) {
      case 'live':
        return `${server}/live/${username}/${password}/${streamId}.ts`;
      case 'movie':
        return `${server}/movie/${username}/${password}/${streamId}.mp4`;
      case 'series':
        return `${server}/series/${username}/${password}/${streamId}.mp4`;
      default:
        return `${server}/${username}/${password}/${streamId}`;
    }
  }

  /**
   * Normalize Xtream URL - returns both HLS and TS options
   */
  async normalize(url: string, options?: {
    preferHls?: boolean;
    validateCredentials?: boolean;
  }): Promise<XtreamNormalizedResult> {
    this.log('info', 'Normalizing Xtream URL', { url });

    const streamInfo = this.parseXtreamUrl(url);
    
    if (!streamInfo) {
      return {
        hlsUrl: url,
        tsUrl: url,
        preferredUrl: url,
        preferredProtocol: 'unknown',
        streamInfo: {
          streamId: '',
          streamType: 'live',
          credentials: { server: '', username: '', password: '' },
          originalUrl: url,
        },
        isValid: false,
        error: 'Could not parse Xtream URL pattern',
      };
    }

    const hlsUrl = this.buildHlsUrl(streamInfo);
    const tsUrl = this.buildTsUrl(streamInfo);

    // Validate credentials if requested
    if (options?.validateCredentials) {
      const isValid = await this.validateCredentials(streamInfo.credentials);
      if (!isValid) {
        this.log('warn', 'Xtream credentials validation failed', { 
          server: streamInfo.credentials.server 
        });
        return {
          hlsUrl,
          tsUrl,
          preferredUrl: url,
          preferredProtocol: 'unknown',
          streamInfo,
          isValid: false,
          error: 'Credential validation failed',
        };
      }
    }

    // Determine preferred format
    // For live streams, HLS is usually more reliable
    // For VOD (movie/series), either works but HLS is more adaptive
    const preferHls = options?.preferHls ?? true;
    const preferredUrl = preferHls ? hlsUrl : tsUrl;
    const preferredProtocol = preferHls ? 'hls' : 'ts';

    this.log('info', 'Xtream URL normalized', {
      originalUrl: url,
      hlsUrl,
      tsUrl,
      preferredProtocol,
    });

    return {
      hlsUrl,
      tsUrl,
      preferredUrl,
      preferredProtocol,
      streamInfo,
      isValid: true,
    };
  }

  /**
   * Validate Xtream credentials via API
   */
  async validateCredentials(credentials: XtreamCredentials): Promise<boolean> {
    try {
      const { server, username, password } = credentials;
      const apiUrl = `${server}/player_api.php?username=${username}&password=${password}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.validationTimeout);

      const response = await fetch(apiUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      
      // Check for valid response structure
      if (data.user_info && data.user_info.auth === 1) {
        return true;
      }

      // Some servers return different structures
      if (data.user && data.server_info) {
        return true;
      }

      return false;
    } catch (error) {
      this.log('warn', 'Credential validation request failed', { error: String(error) });
      return false;
    }
  }

  /**
   * Get stream info from Xtream API
   */
  async getStreamInfo(credentials: XtreamCredentials, streamId: string, streamType: 'live' | 'vod'): Promise<Record<string, unknown> | null> {
    try {
      const { server, username, password } = credentials;
      const action = streamType === 'live' ? 'get_live_info' : 'get_vod_info';
      const apiUrl = `${server}/player_api.php?username=${username}&password=${password}&action=${action}&stream_id=${streamId}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.validationTimeout);

      const response = await fetch(apiUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      this.log('error', 'Failed to get stream info', { error: String(error) });
      return null;
    }
  }

  /**
   * Check if URL looks like Xtream (quick sync check)
   */
  isXtreamUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;

      return (
        XTREAM_LIVE_PATTERN.test(pathname) ||
        XTREAM_MOVIE_PATTERN.test(pathname) ||
        XTREAM_SERIES_PATTERN.test(pathname) ||
        pathname.includes('/player_api.php')
      );
    } catch {
      return false;
    }
  }
}

// Singleton instance
let normalizerInstance: XtreamNormalizer | null = null;

export function getXtreamNormalizer(options?: {
  logHandler?: LogHandler;
}): XtreamNormalizer {
  if (!normalizerInstance) {
    normalizerInstance = new XtreamNormalizer(options);
  }
  return normalizerInstance;
}

/**
 * Quick check if URL is Xtream
 */
export function isXtreamUrl(url: string): boolean {
  return getXtreamNormalizer().isXtreamUrl(url);
}

/**
 * Normalize Xtream URL
 */
export async function normalizeXtreamUrl(url: string): Promise<XtreamNormalizedResult> {
  return getXtreamNormalizer().normalize(url);
}
