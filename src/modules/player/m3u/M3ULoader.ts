/**
 * ============================================================================
 * M3U Loader - Carregamento Resiliente de Playlists
 * ============================================================================
 * 
 * Sistema de carregamento com:
 * - Retry automático com exponential backoff
 * - Cache inteligente
 * - Timeout configurável
 * - Progress tracking
 * - Fallback para múltiplas URLs
 * 
 * @version 1.0.0
 */

import { M3UParser, type M3UParseResult, type M3UParseOptions } from './M3UParser';
import { M3UValidator, type ValidationResult } from './M3UValidator';
import { M3USanitizer, type SanitizeOptions, type SanitizeResult } from './M3USanitizer';

// =============================================================================
// TYPES
// =============================================================================

export interface LoadOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  useCache?: boolean;
  cacheTTL?: number;
  validate?: boolean;
  sanitize?: boolean;
  parseOptions?: M3UParseOptions;
  sanitizeOptions?: SanitizeOptions;
  proxyBaseUrl?: string;
  onProgress?: (loaded: number, total: number) => void;
}

export interface LoadResult {
  success: boolean;
  data?: M3UParseResult;
  validation?: ValidationResult;
  sanitization?: SanitizeResult;
  loadTime: number;
  fromCache: boolean;
  error?: string;
  sourceUrl: string;
}

interface CacheEntry {
  data: M3UParseResult;
  timestamp: number;
  ttl: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_OPTIONS: Required<Omit<LoadOptions, 'parseOptions' | 'sanitizeOptions' | 'proxyBaseUrl' | 'onProgress'>> = {
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  useCache: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  validate: true,
  sanitize: true,
};

// =============================================================================
// M3U LOADER CLASS
// =============================================================================

export class M3ULoader {
  private cache = new Map<string, CacheEntry>();
  private parser = new M3UParser();
  private validator = new M3UValidator();
  private sanitizer = new M3USanitizer();

  /**
   * Load M3U from URL
   */
  async load(url: string, options: LoadOptions = {}): Promise<LoadResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const startTime = performance.now();
    const cacheKey = this.getCacheKey(url);

    // Check cache
    if (opts.useCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log('[M3ULoader] Cache hit:', url.substring(0, 50));
        return {
          success: true,
          data: cached,
          loadTime: performance.now() - startTime,
          fromCache: true,
          sourceUrl: url,
        };
      }
    }

    // Fetch with retry
    let content: string;
    try {
      content = await this.fetchWithRetry(url, opts);
    } catch (error) {
      return {
        success: false,
        loadTime: performance.now() - startTime,
        fromCache: false,
        error: error instanceof Error ? error.message : 'Failed to fetch',
        sourceUrl: url,
      };
    }

    // Parse
    const parseOptions = options.parseOptions || {};
    const parseResult = this.parser.parse(content);

    // Validate
    let validation: ValidationResult | undefined;
    if (opts.validate) {
      validation = this.validator.validate(parseResult);
    }

    // Sanitize
    let sanitization: SanitizeResult | undefined;
    let finalData = parseResult;

    if (opts.sanitize) {
      const sanitizeOpts: SanitizeOptions = {
        ...options.sanitizeOptions,
        proxyBaseUrl: options.proxyBaseUrl,
      };
      const sanitizer = new M3USanitizer(sanitizeOpts);
      sanitization = sanitizer.sanitize(parseResult.channels);
      
      // Update parse result with sanitized data
      finalData = {
        ...parseResult,
        channels: sanitization.channels,
        categories: sanitization.categories,
        totalChannels: sanitization.channels.length,
        validChannels: sanitization.channels.filter(c => c.isValid).length,
        invalidChannels: sanitization.channels.filter(c => !c.isValid).length,
      };
    }

    // Cache result
    if (opts.useCache && finalData.totalChannels > 0) {
      this.setCache(cacheKey, finalData, opts.cacheTTL);
    }

    return {
      success: true,
      data: finalData,
      validation,
      sanitization,
      loadTime: performance.now() - startTime,
      fromCache: false,
      sourceUrl: url,
    };
  }

  /**
   * Load from multiple URLs with fallback
   */
  async loadWithFallback(urls: string[], options: LoadOptions = {}): Promise<LoadResult> {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`[M3ULoader] Trying URL ${i + 1}/${urls.length}: ${url.substring(0, 50)}`);
      
      const result = await this.load(url, options);
      
      if (result.success && result.data && result.data.totalChannels > 0) {
        return result;
      }
      
      console.warn(`[M3ULoader] Failed: ${result.error || 'No channels found'}`);
    }

    return {
      success: false,
      loadTime: 0,
      fromCache: false,
      error: 'All URLs failed',
      sourceUrl: urls[0] || '',
    };
  }

  /**
   * Parse M3U content directly (no fetch)
   */
  parseContent(content: string, options: LoadOptions = {}): LoadResult {
    const startTime = performance.now();
    const parseResult = this.parser.parse(content);

    let validation: ValidationResult | undefined;
    if (options.validate !== false) {
      validation = this.validator.validate(parseResult);
    }

    let sanitization: SanitizeResult | undefined;
    let finalData = parseResult;

    if (options.sanitize !== false) {
      const sanitizeOpts: SanitizeOptions = {
        ...options.sanitizeOptions,
        proxyBaseUrl: options.proxyBaseUrl,
      };
      const sanitizer = new M3USanitizer(sanitizeOpts);
      sanitization = sanitizer.sanitize(parseResult.channels);
      
      finalData = {
        ...parseResult,
        channels: sanitization.channels,
        categories: sanitization.categories,
        totalChannels: sanitization.channels.length,
        validChannels: sanitization.channels.filter(c => c.isValid).length,
        invalidChannels: sanitization.channels.filter(c => !c.isValid).length,
      };
    }

    return {
      success: true,
      data: finalData,
      validation,
      sanitization,
      loadTime: performance.now() - startTime,
      fromCache: false,
      sourceUrl: 'inline',
    };
  }

  /**
   * Fetch with retry and exponential backoff
   */
  private async fetchWithRetry(url: string, opts: typeof DEFAULT_OPTIONS & LoadOptions): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
      try {
        const content = await this.fetchWithTimeout(url, opts.timeout, opts.onProgress);
        return content;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[M3ULoader] Attempt ${attempt + 1}/${opts.maxRetries} failed:`, lastError.message);

        if (attempt < opts.maxRetries - 1) {
          const delay = opts.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Fetch with timeout and progress
   */
  private async fetchWithTimeout(
    url: string, 
    timeout: number,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'IPTV-Player/1.0',
          'Accept': 'text/plain, application/x-mpegurl, */*',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Track progress if possible
      if (onProgress && response.body) {
        const contentLength = parseInt(response.headers.get('Content-Length') || '0');
        
        if (contentLength > 0) {
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let loaded = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunks.push(value);
            loaded += value.length;
            onProgress(loaded, contentLength);
          }

          const allChunks = new Uint8Array(loaded);
          let position = 0;
          for (const chunk of chunks) {
            allChunks.set(chunk, position);
            position += chunk.length;
          }

          return new TextDecoder().decode(allChunks);
        }
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Cache helpers
   */
  private getCacheKey(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
    }
    return `m3u-${Math.abs(hash).toString(36)}`;
  }

  private getFromCache(key: string): M3UParseResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: M3UParseResult, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const m3uLoader = new M3ULoader();

export async function loadM3U(url: string, options?: LoadOptions): Promise<LoadResult> {
  return m3uLoader.load(url, options);
}

export default M3ULoader;
