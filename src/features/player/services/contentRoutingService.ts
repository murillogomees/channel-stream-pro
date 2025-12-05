/**
 * Content Routing Service
 * Routes content to appropriate CDN based on content type:
 * - TV ao vivo → Cloudflare Stream
 * - Filmes/Séries → R2 CDN, fallback to direct
 * - HTTP → Proxy for Mixed Content bypass
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const R2_CDN_URL = 'https://pub-iptvlink.r2.dev';

export type ContentType = 'live' | 'movie' | 'series' | 'unknown';
export type CdnSource = 'cf-stream' | 'r2' | 'proxy' | 'direct';

export interface RoutedContent {
  url: string;
  source: CdnSource;
  contentType: ContentType;
  fallbackUrls: string[];
  requiresProxy: boolean;
}

export interface ContentChannel {
  id: string;
  name: string;
  stream_url?: string;
  group_title?: string;
  category_name?: string;
  cf_stream_uid?: string;
  r2_key?: string;
}

class ContentRoutingService {
  private proxyUrl: string;

  constructor() {
    this.proxyUrl = `${SUPABASE_URL}/functions/v1/stream-proxy`;
  }

  /**
   * Detect content type from channel data
   */
  detectContentType(channel: ContentChannel): ContentType {
    const url = (channel.stream_url || '').toLowerCase();
    const name = (channel.name || '').toLowerCase();
    const group = (channel.group_title || channel.category_name || '').toLowerCase();

    // URL-based detection (most reliable)
    if (url.includes('/live/') || url.includes('live.')) {
      return 'live';
    }
    if (url.includes('/movie/') || url.includes('/vod/')) {
      return 'movie';
    }
    if (url.includes('/series/')) {
      return 'series';
    }

    // Group/category keywords
    const liveKeywords = ['tv ao vivo', 'live', 'canais', 'abertos', 'esportes', 'notícias', '24h', 'hd', 'fhd'];
    const movieKeywords = ['filme', 'movie', 'cinema', 'lançamento', 'dublado', 'legendado'];
    const seriesKeywords = ['série', 'series', 'temporada', 'season', 'episódio', 'novela', 'anime', 'dorama'];

    // Episode pattern in name
    if (/S\d{1,2}\s*E\d{1,3}/i.test(name) || /\d{1,2}x\d{1,3}/i.test(name) || /Temporada/i.test(name)) {
      return 'series';
    }

    // Check group keywords
    for (const kw of seriesKeywords) {
      if (group.includes(kw)) return 'series';
    }
    for (const kw of movieKeywords) {
      if (group.includes(kw)) return 'movie';
    }
    for (const kw of liveKeywords) {
      if (group.includes(kw)) return 'live';
    }

    // Default to live for IPTV
    return 'live';
  }

  /**
   * Route content to appropriate CDN
   */
  route(channel: ContentChannel): RoutedContent {
    const contentType = this.detectContentType(channel);
    const originalUrl = channel.stream_url || '';
    const isHttp = originalUrl.startsWith('http://');
    const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const needsProxy = isHttp && isHttpsPage;

    const fallbackUrls: string[] = [];
    let primaryUrl = originalUrl;
    let source: CdnSource = 'direct';

    // Route based on content type
    switch (contentType) {
      case 'live':
        // TV ao vivo → Cloudflare Stream first
        if (channel.cf_stream_uid) {
          primaryUrl = `${SUPABASE_URL}/functions/v1/cf-stream-playback?uid=${channel.cf_stream_uid}`;
          source = 'cf-stream';
          
          // Fallback to proxy then direct
          if (needsProxy) {
            fallbackUrls.push(`${this.proxyUrl}?url=${encodeURIComponent(originalUrl)}`);
          }
          fallbackUrls.push(originalUrl);
        } else if (needsProxy) {
          // No CF Stream, use proxy for HTTP
          primaryUrl = `${this.proxyUrl}?url=${encodeURIComponent(originalUrl)}`;
          source = 'proxy';
          fallbackUrls.push(originalUrl);
        }
        break;

      case 'movie':
      case 'series':
        // Filmes/Séries → R2 CDN first
        if (channel.r2_key) {
          primaryUrl = `${R2_CDN_URL}/${channel.r2_key}`;
          source = 'r2';
          
          // Fallbacks: proxy (if HTTP), then direct
          if (needsProxy) {
            fallbackUrls.push(`${this.proxyUrl}?url=${encodeURIComponent(originalUrl)}`);
          }
          fallbackUrls.push(originalUrl);
        } else if (needsProxy) {
          // No R2, use proxy for HTTP
          primaryUrl = `${this.proxyUrl}?url=${encodeURIComponent(originalUrl)}`;
          source = 'proxy';
          fallbackUrls.push(originalUrl);
        }
        break;

      default:
        // Unknown → proxy if HTTP, else direct
        if (needsProxy) {
          primaryUrl = `${this.proxyUrl}?url=${encodeURIComponent(originalUrl)}`;
          source = 'proxy';
          fallbackUrls.push(originalUrl);
        }
    }

    return {
      url: primaryUrl,
      source,
      contentType,
      fallbackUrls,
      requiresProxy: needsProxy,
    };
  }

  /**
   * Get playable URL with automatic routing
   */
  getPlayableUrl(channel: ContentChannel): string {
    const routed = this.route(channel);
    return routed.url;
  }

  /**
   * Build complete CDN endpoint list for failover
   */
  buildEndpoints(channel: ContentChannel): Array<{ url: string; priority: number; type: CdnSource }> {
    const contentType = this.detectContentType(channel);
    const originalUrl = channel.stream_url || '';
    const isHttp = originalUrl.startsWith('http://');
    const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const needsProxy = isHttp && isHttpsPage;
    
    const endpoints: Array<{ url: string; priority: number; type: CdnSource }> = [];

    if (contentType === 'live') {
      // Live: CF Stream → Proxy → Direct
      if (channel.cf_stream_uid) {
        endpoints.push({
          url: `${SUPABASE_URL}/functions/v1/cf-stream-playback?uid=${channel.cf_stream_uid}`,
          priority: 1,
          type: 'cf-stream',
        });
      }
    } else {
      // VOD: R2 → Proxy → Direct
      if (channel.r2_key) {
        endpoints.push({
          url: `${R2_CDN_URL}/${channel.r2_key}`,
          priority: 1,
          type: 'r2',
        });
      }
    }

    // Add proxy if needed
    if (needsProxy) {
      endpoints.push({
        url: `${this.proxyUrl}?url=${encodeURIComponent(originalUrl)}`,
        priority: endpoints.length + 1,
        type: 'proxy',
      });
    }

    // Always add direct as final fallback
    endpoints.push({
      url: originalUrl,
      priority: endpoints.length + 1,
      type: 'direct',
    });

    return endpoints.sort((a, b) => a.priority - b.priority);
  }
}

export const contentRoutingService = new ContentRoutingService();
export default contentRoutingService;
