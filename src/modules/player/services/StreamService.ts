/**
 * ============================================================================
 * StreamService - Serviço de Streaming IPTV
 * ============================================================================
 * 
 * Centraliza toda a lógica de:
 * - Construção de URLs de proxy
 * - Validação de streams
 * - Cache de canais
 * - Healthcheck de URLs
 * 
 * @version 1.0.0
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

// URL do Supabase - usar valor fixo para garantir funcionamento
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

// =============================================================================
// STREAM SERVICE
// =============================================================================

class StreamService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // ===========================================================================
  // URL BUILDING
  // ===========================================================================

  /**
   * Constrói URL de proxy para um stream (DESABILITADO - carrega direto)
   */
  getProxyUrl(streamUrl: string): string {
    // Proxy desabilitado - retorna URL original sempre
    return streamUrl;
  }

  /**
   * Verifica se conteúdo é VOD (filme/série)
   */
  isVodContent(url: string): boolean {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    return urlLower.includes('/movie/') || 
           urlLower.includes('/series/') || 
           urlLower.includes('/vod/') ||
           urlLower.includes('.mp4') ||
           urlLower.includes('.mkv') ||
           urlLower.includes('.avi');
  }

  /**
   * Verifica se uma URL precisa de proxy - SEMPRE retorna false agora
   */
  needsProxy(_url: string): boolean {
    // Proxy desabilitado - carrega direto sempre
    return false;
  }

  /**
   * Retorna URL pronta para o player - SEMPRE carrega direto
   */
  getPlayableUrl(channelOrUrl: Channel | string): string {
    // Se é objeto Channel
    if (typeof channelOrUrl === 'object' && channelOrUrl) {
      // Priorizar R2 URL se o VOD foi uploaded
      if (channelOrUrl.r2_uploaded && channelOrUrl.r2_url) {
        console.log('[StreamService] Using R2 CDN URL for:', channelOrUrl.name);
        return channelOrUrl.r2_url;
      }
      
      const streamUrl = channelOrUrl.stream_url;
      if (!streamUrl) return '';
      
      // CARREGA DIRETO - sem proxy
      console.log('[StreamService] 🎬 DIRECT LOAD:', streamUrl.substring(0, 80));
      return streamUrl;
    }
    
    // Se é string direta
    const streamUrl = channelOrUrl as string;
    if (!streamUrl) return '';
    
    // CARREGA DIRETO - sem proxy
    console.log('[StreamService] 🎬 DIRECT LOAD:', streamUrl.substring(0, 80));
    return streamUrl;
  }
  
  /**
   * Verifica se um canal tem conteúdo otimizado no R2
   */
  isOptimizedContent(channel: Channel): boolean {
    return Boolean(channel.r2_uploaded && channel.r2_url);
  }
  
  /**
   * Obtém URL otimizada usando CDN Worker routing
   */
  async getOptimizedUrl(channel: Channel): Promise<{
    url: string;
    source: 'cdn_worker' | 'stream_proxy' | 'r2_direct' | 'cloudflare_stream' | 'origin';
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
    const cached = this.getFromCache(cacheKey);
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
      const proxyUrl = this.getProxyUrl(url);
      const response = await fetch(proxyUrl, {
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

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
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
