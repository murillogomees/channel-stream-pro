/**
 * ============================================================================
 * StreamService - Serviço de Streaming IPTV
 * ============================================================================
 * 
 * ARQUITETURA DE ENTREGA:
 * - TV AO VIVO: Link direto (sem proxy)
 * - VOD: R2 Cloudflare CDN
 * - Cloudflare Stream: Para conteúdo transcodificado
 * 
 * @version 2.0.0
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUPABASE_URL = 'https://sdvyxdghxqmntyoweqbd.supabase.co';

const ENDPOINTS = {
  STREAM_PROXY: `${SUPABASE_URL}/functions/v1/stream-proxy`,
  M3U_FETCHER: `${SUPABASE_URL}/functions/v1/fetch-m3u-url`,
} as const;

// =============================================================================
// TYPES
// =============================================================================

export interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo?: string | null;
  tvg_id?: string | null;
  tvg_name?: string | null;
  category_name: string;
  // VOD/R2 fields
  is_vod?: boolean;
  r2_uploaded?: boolean;
  r2_url?: string | null;
  content_type?: 'live' | 'vod' | 'unknown';
  // Cloudflare Stream
  cf_stream_url?: string | null;
  cf_stream_uid?: string | null;
}

export interface Category {
  id: string;
  name: string;
  display_name: string;
  channels: Channel[];
}

export interface M3UFetchResult {
  channels: Channel[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface StreamHealthResult {
  url: string;
  isHealthy: boolean;
  responseTime?: number;
  error?: string;
}

export interface PlaybackSource {
  url: string;
  source: 'direct' | 'r2_cdn' | 'cloudflare_stream' | 'proxy';
  requiresAuth: boolean;
  fallbackUrl?: string;
}

// =============================================================================
// STREAM SERVICE
// =============================================================================

class StreamService {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // ===========================================================================
  // CONTENT TYPE DETECTION
  // ===========================================================================

  /**
   * Verifica se conteúdo é VOD (filme/série)
   */
  isVodContent(urlOrChannel: string | Channel): boolean {
    const url = typeof urlOrChannel === 'string' 
      ? urlOrChannel 
      : urlOrChannel.stream_url;
    
    if (!url) return false;
    
    // Check explicit content_type first
    if (typeof urlOrChannel === 'object') {
      if (urlOrChannel.content_type === 'vod') return true;
      if (urlOrChannel.is_vod) return true;
    }
    
    const urlLower = url.toLowerCase();
    return urlLower.includes('/movie/') || 
           urlLower.includes('/series/') || 
           urlLower.includes('/vod/') ||
           urlLower.endsWith('.mp4') ||
           urlLower.endsWith('.mkv') ||
           urlLower.endsWith('.avi') ||
           urlLower.endsWith('.ts') ||
           urlLower.endsWith('.webm');
  }

  /**
   * Verifica se conteúdo é TV ao vivo
   */
  isLiveContent(urlOrChannel: string | Channel): boolean {
    if (typeof urlOrChannel === 'object') {
      if (urlOrChannel.content_type === 'live') return true;
      // Explicit live detection
      const catName = urlOrChannel.category_name?.toLowerCase() || '';
      if (catName.includes('tv') || catName.includes('live') || catName.includes('ao vivo')) {
        return true;
      }
    }
    
    const url = typeof urlOrChannel === 'string' 
      ? urlOrChannel 
      : urlOrChannel.stream_url;
    
    if (!url) return false;
    
    const urlLower = url.toLowerCase();
    // Live indicators
    return urlLower.includes('/live/') ||
           urlLower.includes('live.m3u8') ||
           urlLower.includes('/stream/') ||
           urlLower.includes('iptv') ||
           (urlLower.includes('.m3u8') && !this.isVodContent(url));
  }

  // ===========================================================================
  // URL BUILDING - ARQUITETURA CDN
  // ===========================================================================

  /**
   * Obtém URL de playback otimizada seguindo a arquitetura:
   * 
   * 1. Cloudflare Stream (se transcodificado)
   * 2. R2 CDN (se VOD uploaded)
   * 3. Link Direto (para HTTPS)
   * 4. Proxy (HTTP em página HTTPS - Mixed Content)
   */
  getPlaybackSource(channel: Channel): PlaybackSource {
    // PRIORIDADE 1: Cloudflare Stream (conteúdo transcodificado)
    if (channel.cf_stream_url) {
      console.log('[StreamService] ☁️ CF Stream:', channel.name);
      return {
        url: channel.cf_stream_url,
        source: 'cloudflare_stream',
        requiresAuth: false,
      };
    }

    // PRIORIDADE 2: R2 CDN (VOD uploaded)
    if (channel.r2_uploaded && channel.r2_url) {
      console.log('[StreamService] 📦 R2 CDN:', channel.name);
      return {
        url: channel.r2_url,
        source: 'r2_cdn',
        requiresAuth: false,
        fallbackUrl: channel.stream_url,
      };
    }

    const streamUrl = channel.stream_url;
    if (!streamUrl) {
      return {
        url: '',
        source: 'direct',
        requiresAuth: false,
      };
    }

    // PRIORIDADE 3: Para HTTPS - link direto (funciona em todas as páginas)
    if (streamUrl.startsWith('https://')) {
      console.log('[StreamService] 🔒 HTTPS - Link Direto:', channel.name);
      return {
        url: streamUrl,
        source: 'direct',
        requiresAuth: false,
      };
    }

    // PRIORIDADE 4: Proxy para HTTP (Mixed Content - obrigatório em páginas HTTPS)
    // IMPORTANTE: Isso se aplica a TODOS os conteúdos HTTP (live, VOD, etc.)
    if (streamUrl.startsWith('http://')) {
      // Só usa proxy se estamos em HTTPS (browser environment)
      const isSecurePage = typeof window !== 'undefined' && window.location?.protocol === 'https:';
      
      if (isSecurePage) {
        console.log('[StreamService] 🔄 HTTP → Proxy (Mixed Content):', channel.name);
        return {
          url: `${ENDPOINTS.STREAM_PROXY}?url=${encodeURIComponent(streamUrl)}`,
          source: 'proxy',
          requiresAuth: false,
          fallbackUrl: streamUrl,
        };
      }
      
      // Se não estamos em HTTPS (dev mode), pode usar direto
      console.log('[StreamService] 📺 HTTP direto (não-HTTPS page):', channel.name);
      return {
        url: streamUrl,
        source: 'direct',
        requiresAuth: false,
      };
    }

    // Default: link direto
    console.log('[StreamService] 🎯 Default - Link Direto:', channel.name);
    return {
      url: streamUrl,
      source: 'direct',
      requiresAuth: false,
    };
  }

  /**
   * Retorna URL pronta para o player (simplificado)
   * Automaticamente aplica proxy para URLs HTTP em páginas HTTPS
   */
  getPlayableUrl(channelOrUrl: Channel | string): string {
    // Se é string direta
    if (typeof channelOrUrl === 'string') {
      const url = channelOrUrl || '';
      
      // Se URL HTTP em página HTTPS, precisa de proxy
      if (url.startsWith('http://')) {
        const isSecurePage = typeof window !== 'undefined' && window.location?.protocol === 'https:';
        if (isSecurePage) {
          return `${ENDPOINTS.STREAM_PROXY}?url=${encodeURIComponent(url)}`;
        }
      }
      
      return url;
    }
    
    // Se é Channel object
    const source = this.getPlaybackSource(channelOrUrl);
    return source.url;
  }
  
  /**
   * Verifica se um canal tem conteúdo otimizado no R2
   */
  isOptimizedContent(channel: Channel): boolean {
    return Boolean(channel.r2_uploaded && channel.r2_url);
  }

  /**
   * Verifica se canal tem Cloudflare Stream
   */
  hasCloudflareStream(channel: Channel): boolean {
    return Boolean(channel.cf_stream_url);
  }
  
  /**
   * Obtém URL otimizada usando CDN Worker routing (avançado)
   */
  async getOptimizedUrl(channel: Channel): Promise<{
    url: string;
    source: 'cdn_worker' | 'stream_proxy' | 'r2_direct' | 'cloudflare_stream' | 'origin' | 'direct';
    requiresToken: boolean;
    fallbackUrl?: string;
  }> {
    const { cdnRoutingService } = await import('@/services/cdnRoutingService');
    return await cdnRoutingService.getPlaybackUrl(channel);
  }

  /**
   * Verifica se CDN Worker está disponível
   */
  async checkCdnWorkerHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    responseTime?: number;
  }> {
    const { cdnRoutingService } = await import('@/services/cdnRoutingService');
    return await cdnRoutingService.checkCdnWorkerHealth();
  }

  // ===========================================================================
  // LEGACY METHODS (mantidos para compatibilidade)
  // ===========================================================================

  /**
   * @deprecated Use getPlaybackSource instead
   */
  getProxyUrl(streamUrl: string): string {
    return streamUrl;
  }

  /**
   * @deprecated Use getPlaybackSource instead  
   */
  needsProxy(_url: string): boolean {
    return false;
  }

  // ===========================================================================
  // M3U FETCHING
  // ===========================================================================

  /**
   * Busca e parseia uma lista M3U
   */
  async fetchM3U(
    url: string,
    options?: { limit?: number; offset?: number }
  ): Promise<M3UFetchResult> {
    const { limit = 500, offset = 0 } = options || {};
    const cacheKey = `m3u:${url}:${offset}:${limit}`;

    // Check cache
    const cached = this.getFromCache<M3UFetchResult>(cacheKey);
    if (cached) {
      console.log('[StreamService] M3U from cache');
      return cached;
    }

    const response = await fetch(ENDPOINTS.M3U_FETCHER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, limit, offset }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `M3U fetch failed: ${response.status}`);
    }

    const result: M3UFetchResult = await response.json();
    
    // Cache result
    this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Busca M3U completa com loading progressivo
   */
  async fetchM3UProgressive(
    url: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<Channel[]> {
    const allChannels: Channel[] = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;

    while (hasMore) {
      const result = await this.fetchM3U(url, { limit, offset });
      
      allChannels.push(...result.channels);
      hasMore = result.hasMore;
      offset += limit;

      onProgress?.(allChannels.length, result.total);

      // Small delay to prevent overwhelming the server
      if (hasMore) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    return allChannels;
  }

  // ===========================================================================
  // CHANNEL ORGANIZATION
  // ===========================================================================

  /**
   * Agrupa canais por categoria
   */
  groupByCategory(channels: Channel[]): Category[] {
    const categoryMap = new Map<string, Channel[]>();

    channels.forEach(channel => {
      const catName = channel.category_name || 'Outros';
      if (!categoryMap.has(catName)) {
        categoryMap.set(catName, []);
      }
      categoryMap.get(catName)!.push(channel);
    });

    return Array.from(categoryMap.entries()).map(([name, channels], index) => ({
      id: `cat-${index}`,
      name: name.toLowerCase().replace(/\s+/g, '-'),
      display_name: name,
      channels,
    }));
  }

  /**
   * Categoriza conteúdo por tipo (Live, Movies, Series)
   */
  categorizeContent(categories: Category[]): {
    live: Category[];
    movies: Category[];
    series: Category[];
  } {
    const live: Category[] = [];
    const movies: Category[] = [];
    const series: Category[] = [];

    const movieKeywords = ['filme', 'movie', 'cinema', 'vod filme', 'filmes', 'movies', 'film', 'peliculas'];
    const seriesKeywords = ['série', 'series', 'seriado', 'novela', 'temporada', 'season', 'episódio', 'serie', 'séries'];

    categories.forEach(cat => {
      const text = `${cat.display_name} ${cat.name}`.toLowerCase();
      
      const isMovie = movieKeywords.some(k => text.includes(k)) && 
                      !seriesKeywords.some(k => text.includes(k));
      const isSeries = seriesKeywords.some(k => text.includes(k));

      if (isSeries) {
        series.push(cat);
      } else if (isMovie) {
        movies.push(cat);
      } else {
        live.push(cat);
      }
    });

    return { live, movies, series };
  }

  // ===========================================================================
  // HEALTH CHECK
  // ===========================================================================

  /**
   * Verifica se um stream está acessível
   */
  async checkStreamHealth(url: string): Promise<StreamHealthResult> {
    const start = Date.now();
    
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
      });

      return {
        url,
        isHealthy: response.ok,
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        url,
        isHealthy: false,
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ===========================================================================
  // CACHE
  // ===========================================================================

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Limpa cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const streamService = new StreamService();
export default StreamService;
