/**
 * CDN Routing Service
 * 
 * ARQUITETURA DE ENTREGA DE CONTEÚDO:
 * =====================================
 * 
 * 1. TV AO VIVO → Link Direto (sem proxy, máxima performance)
 * 2. VOD (R2 uploaded) → R2 CDN com token JWT
 * 3. Cloudflare Stream → Para conteúdo transcodificado
 * 4. Proxy → Apenas para HTTP em página HTTPS (Mixed Content)
 */

import { generateCdnToken } from '@/services/r2CdnService';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// TYPES
// ============================================

export interface PlaybackResult {
  url: string;
  source: 'cdn_worker' | 'stream_proxy' | 'r2_direct' | 'cloudflare_stream' | 'origin' | 'direct';
  requiresToken: boolean;
  token?: string;
  expiresAt?: number;
  fallbackUrl?: string;
}

export interface CdnWorkerHealth {
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  lastCheck: number;
  error?: string;
}

export interface RoutingMetrics {
  cdn_worker_requests: number;
  stream_proxy_requests: number;
  direct_requests: number;
  cloudflare_stream_requests: number;
  fallback_count: number;
  avg_response_time: number;
  error_rate: number;
}

interface Channel {
  id: string;
  name: string;
  stream_url: string;
  r2_uploaded?: boolean;
  r2_url?: string | null;
  content_type?: 'live' | 'vod' | 'unknown';
  is_vod?: boolean;
  cf_stream_url?: string | null;
  category_name?: string;
}

// ============================================
// CONFIGURATION
// ============================================

const SUPABASE_URL = 'https://sdvyxdghxqmntyoweqbd.supabase.co';

// CDN Worker URL will be retrieved from secrets
let CDN_WORKER_URL: string | null = null;
let R2_PUBLIC_DOMAIN: string | null = null;

// Health check cache
let healthCache: CdnWorkerHealth = {
  status: 'healthy',
  lastCheck: 0,
};

const HEALTH_CHECK_INTERVAL = 60000; // 1 minute
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds

// Routing metrics
const metrics: RoutingMetrics = {
  cdn_worker_requests: 0,
  stream_proxy_requests: 0,
  direct_requests: 0,
  cloudflare_stream_requests: 0,
  fallback_count: 0,
  avg_response_time: 0,
  error_rate: 0,
};

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize CDN Worker configuration from Supabase secrets
 */
async function initializeConfig(): Promise<void> {
  if (CDN_WORKER_URL && R2_PUBLIC_DOMAIN) return;

  try {
    const { data, error } = await supabase.functions.invoke('cdn-config');
    
    if (!error && data) {
      CDN_WORKER_URL = data.cdn_worker_url;
      R2_PUBLIC_DOMAIN = data.r2_public_domain;
      console.log('[CDN Routing] Config initialized:', {
        cdnWorker: !!CDN_WORKER_URL,
        r2Domain: !!R2_PUBLIC_DOMAIN
      });
    }
  } catch (error) {
    console.warn('[CDN Routing] Config init failed, using defaults:', error);
  }
}

// ============================================
// CONTENT TYPE DETECTION
// ============================================

/**
 * Check if content is VOD (movie/series)
 */
function isVodContent(channel: Channel): boolean {
  if (channel.content_type === 'vod') return true;
  if (channel.is_vod) return true;
  
  const url = channel.stream_url?.toLowerCase() || '';
  return url.includes('/movie/') || 
         url.includes('/series/') || 
         url.includes('/vod/') ||
         url.endsWith('.mp4') ||
         url.endsWith('.mkv') ||
         url.endsWith('.avi') ||
         url.endsWith('.ts') ||
         url.endsWith('.webm');
}

/**
 * Check if content is Live TV
 */
function isLiveContent(channel: Channel): boolean {
  if (channel.content_type === 'live') return true;
  
  const catName = channel.category_name?.toLowerCase() || '';
  if (catName.includes('tv') || catName.includes('live') || catName.includes('ao vivo')) {
    return true;
  }
  
  const url = channel.stream_url?.toLowerCase() || '';
  return url.includes('/live/') ||
         url.includes('live.m3u8') ||
         url.includes('/stream/') ||
         (url.includes('.m3u8') && !isVodContent(channel));
}

/**
 * Check if URL is HTTP (needs proxy for Mixed Content)
 */
function isHttpUrl(url: string): boolean {
  return url?.toLowerCase().startsWith('http://') || false;
}

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Check CDN Worker health status
 */
export async function checkCdnWorkerHealth(): Promise<CdnWorkerHealth> {
  const now = Date.now();
  if (now - healthCache.lastCheck < HEALTH_CHECK_INTERVAL) {
    return healthCache;
  }

  await initializeConfig();

  if (!CDN_WORKER_URL) {
    healthCache = {
      status: 'down',
      lastCheck: now,
      error: 'CDN Worker URL not configured',
    };
    return healthCache;
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    const response = await fetch(`${CDN_WORKER_URL}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;

    healthCache = {
      status: response.ok ? (responseTime > 2000 ? 'degraded' : 'healthy') : 'degraded',
      responseTime,
      lastCheck: now,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    healthCache = {
      status: 'down',
      lastCheck: now,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  return healthCache;
}

/**
 * Get current health status (from cache)
 */
export function getCdnWorkerHealth(): CdnWorkerHealth {
  return healthCache;
}

// ============================================
// ROUTING LOGIC
// ============================================

/**
 * Get optimized playback URL for a channel
 * 
 * ARQUITETURA:
 * ============
 * 1. TV AO VIVO → Link Direto (máxima performance, sem latência)
 * 2. Cloudflare Stream → Se transcodificado
 * 3. R2 CDN Worker → Se VOD uploaded (com token JWT)
 * 4. R2 Direct → Se CDN Worker down
 * 5. Proxy → Apenas para HTTP (Mixed Content bypass)
 */
export async function getPlaybackUrl(channel: Channel): Promise<PlaybackResult> {
  await initializeConfig();

  // ===== PRIORIDADE 1: TV AO VIVO - LINK DIRETO =====
  if (isLiveContent(channel) && !isHttpUrl(channel.stream_url)) {
    console.log('[CDN Routing] 📺 TV AO VIVO - Link Direto:', channel.name);
    metrics.direct_requests++;
    return {
      url: channel.stream_url,
      source: 'direct',
      requiresToken: false,
    };
  }

  // ===== PRIORIDADE 2: CLOUDFLARE STREAM =====
  if (channel.cf_stream_url) {
    console.log('[CDN Routing] ☁️ Cloudflare Stream:', channel.name);
    metrics.cloudflare_stream_requests++;
    return {
      url: channel.cf_stream_url,
      source: 'cloudflare_stream',
      requiresToken: false,
    };
  }

  // ===== PRIORIDADE 3: R2 CDN (VOD UPLOADED) =====
  if (channel.r2_uploaded && channel.r2_url) {
    const health = await checkCdnWorkerHealth();
    
    // 3a: CDN Worker com token JWT
    if (health.status !== 'down' && CDN_WORKER_URL) {
      try {
        const tokenResult = await generateCdnToken({
          r2_key: extractR2Key(channel.r2_url),
          channel_id: channel.id,
          expires_in_seconds: 7200, // 2 hours
          token_type: 'manifest',
        });

        if (tokenResult.success && tokenResult.token) {
          const cdnUrl = `${CDN_WORKER_URL}/${extractR2Key(channel.r2_url)}?jwt=${tokenResult.token}`;
          
          metrics.cdn_worker_requests++;
          console.log('[CDN Routing] 📦 R2 CDN Worker:', channel.name);
          
          return {
            url: cdnUrl,
            source: 'cdn_worker',
            requiresToken: true,
            token: tokenResult.token,
            expiresAt: tokenResult.expires_at,
            fallbackUrl: channel.r2_url,
          };
        }
      } catch (error) {
        console.warn('[CDN Routing] CDN Worker token failed:', error);
        metrics.fallback_count++;
      }
    }

    // 3b: R2 Direct (fallback)
    console.log('[CDN Routing] 📦 R2 Direct:', channel.name);
    return {
      url: channel.r2_url,
      source: 'r2_direct',
      requiresToken: false,
      fallbackUrl: channel.stream_url,
    };
  }

  // ===== PRIORIDADE 4: VOD HTTPS - LINK DIRETO =====
  if (isVodContent(channel) && !isHttpUrl(channel.stream_url)) {
    console.log('[CDN Routing] 🎬 VOD HTTPS - Link Direto:', channel.name);
    metrics.direct_requests++;
    return {
      url: channel.stream_url,
      source: 'direct',
      requiresToken: false,
    };
  }

  // ===== PRIORIDADE 5: HTTP - LINK DIRETO (sem proxy) =====
  if (isHttpUrl(channel.stream_url)) {
    console.log('[CDN Routing] 🔗 HTTP - Link Direto:', channel.name);
    metrics.direct_requests++;
    
    return {
      url: channel.stream_url,
      source: 'direct',
      requiresToken: false,
    };
  }

  // ===== DEFAULT: LINK DIRETO =====
  console.log('[CDN Routing] 🎯 Default - Link Direto:', channel.name);
  metrics.direct_requests++;
  
  return {
    url: channel.stream_url,
    source: 'direct',
    requiresToken: false,
  };
}

/**
 * Extract R2 key from full R2 URL
 */
function extractR2Key(r2_url: string): string {
  try {
    const url = new URL(r2_url);
    return url.pathname.substring(1);
  } catch {
    return r2_url;
  }
}

/**
 * Refresh token for a CDN Worker URL
 */
export async function refreshToken(r2_key: string, channelId?: string): Promise<string | null> {
  try {
    const tokenResult = await generateCdnToken({
      r2_key,
      channel_id: channelId,
      expires_in_seconds: 7200,
      token_type: 'manifest',
    });

    return tokenResult.success ? tokenResult.token || null : null;
  } catch (error) {
    console.error('[CDN Routing] Token refresh failed:', error);
    return null;
  }
}

/**
 * Report playback issue for analytics
 */
export async function reportPlaybackIssue(
  channelId: string,
  error: string,
  source: PlaybackResult['source']
): Promise<void> {
  try {
    metrics.fallback_count++;
    
    await supabase.from('stream_analytics').insert({
      channel_id: channelId,
      route_type: source,
      error_code: 'PLAYBACK_FAILURE',
      created_at: new Date().toISOString(),
      metadata: { error } as unknown as Record<string, never>,
    });

    console.log('[CDN Routing] Playback issue reported:', { channelId, error, source });
  } catch (err) {
    console.error('[CDN Routing] Failed to report issue:', err);
  }
}

/**
 * Get routing metrics
 */
export function getRoutingMetrics(): RoutingMetrics {
  return { ...metrics };
}

/**
 * Reset metrics (for testing/debugging)
 */
export function resetMetrics(): void {
  metrics.cdn_worker_requests = 0;
  metrics.stream_proxy_requests = 0;
  metrics.direct_requests = 0;
  metrics.cloudflare_stream_requests = 0;
  metrics.fallback_count = 0;
  metrics.avg_response_time = 0;
  metrics.error_rate = 0;
}

// ============================================
// EXPORT SERVICE
// ============================================

export const cdnRoutingService = {
  getPlaybackUrl,
  checkCdnWorkerHealth,
  getCdnWorkerHealth,
  refreshToken,
  reportPlaybackIssue,
  getRoutingMetrics,
  resetMetrics,
  initializeConfig,
  isLiveContent,
  isVodContent,
};

export default cdnRoutingService;
