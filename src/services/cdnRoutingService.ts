/**
 * CDN Routing Service
 * 
 * Central service for intelligent CDN Worker routing decisions.
 * Determines optimal playback URLs using CDN Worker, R2, Stream, or origin.
 */

import { generateCdnToken } from '@/services/r2CdnService';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// TYPES
// ============================================

export interface PlaybackResult {
  url: string;
  source: 'cdn_worker' | 'stream_proxy' | 'r2_direct' | 'cloudflare_stream' | 'origin';
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
    // Try to get from edge function that reads secrets
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
    // Fallback to environment or default values
    CDN_WORKER_URL = import.meta.env.VITE_CDN_WORKER_URL || null;
    R2_PUBLIC_DOMAIN = import.meta.env.VITE_R2_PUBLIC_DOMAIN || null;
  }
}

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Check CDN Worker health status
 */
export async function checkCdnWorkerHealth(): Promise<CdnWorkerHealth> {
  // Return cached health if recent
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

    if (response.ok) {
      healthCache = {
        status: responseTime > 2000 ? 'degraded' : 'healthy',
        responseTime,
        lastCheck: now,
      };
    } else {
      healthCache = {
        status: 'degraded',
        responseTime,
        lastCheck: now,
        error: `HTTP ${response.status}`,
      };
    }
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
 * Priority:
 * 1. Cloudflare Stream (if available)
 * 2. R2 via CDN Worker (if VOD uploaded)
 * 3. R2 direct (if CDN Worker down)
 * 4. Stream proxy (fallback for live/origin)
 */
export async function getPlaybackUrl(channel: Channel): Promise<PlaybackResult> {
  await initializeConfig();

  // Priority 1: Cloudflare Stream
  if (channel.cf_stream_url) {
    console.log('[CDN Routing] Using Cloudflare Stream:', channel.name);
    return {
      url: channel.cf_stream_url,
      source: 'cloudflare_stream',
      requiresToken: false,
    };
  }

  // Priority 2: R2 CDN Worker (VOD content)
  if (channel.r2_uploaded && channel.r2_url) {
    const health = await checkCdnWorkerHealth();
    
    if (health.status !== 'down' && CDN_WORKER_URL) {
      try {
        // Generate JWT token for CDN Worker
        const tokenResult = await generateCdnToken({
          r2_key: extractR2Key(channel.r2_url),
          channel_id: channel.id,
          expires_in_seconds: 7200, // 2 hours
          token_type: 'manifest',
        });

        if (tokenResult.success && tokenResult.token) {
          const cdnUrl = `${CDN_WORKER_URL}/${extractR2Key(channel.r2_url)}?jwt=${tokenResult.token}`;
          
          metrics.cdn_worker_requests++;
          
          console.log('[CDN Routing] Using CDN Worker:', channel.name);
          return {
            url: cdnUrl,
            source: 'cdn_worker',
            requiresToken: true,
            token: tokenResult.token,
            expiresAt: tokenResult.expires_at,
            fallbackUrl: channel.r2_url, // Direct R2 as fallback
          };
        }
      } catch (error) {
        console.warn('[CDN Routing] CDN Worker token generation failed:', error);
        metrics.fallback_count++;
      }
    }

    // Priority 3: Direct R2 (if CDN Worker unavailable)
    if (channel.r2_url) {
      console.log('[CDN Routing] Using direct R2:', channel.name);
      return {
        url: channel.r2_url,
        source: 'r2_direct',
        requiresToken: false,
      };
    }
  }

  // Priority 4: Stream proxy (live streams and fallback)
  const proxyUrl = `${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(channel.stream_url)}`;
  
  metrics.stream_proxy_requests++;
  
  console.log('[CDN Routing] Using stream proxy:', channel.name);
  return {
    url: proxyUrl,
    source: 'stream_proxy',
    requiresToken: false,
    fallbackUrl: channel.stream_url, // Original as last resort
  };
}

/**
 * Extract R2 key from full R2 URL
 */
function extractR2Key(r2_url: string): string {
  try {
    const url = new URL(r2_url);
    // Remove leading slash
    return url.pathname.substring(1);
  } catch {
    // If parsing fails, assume the whole string is the key
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
};

export default cdnRoutingService;
