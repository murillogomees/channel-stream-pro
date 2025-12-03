/**
 * ============================================================================
 * Stream Optimizer Service
 * ============================================================================
 * 
 * Serviço centralizado para otimização de streams:
 * - Detecção inteligente de tipo de conteúdo
 * - Roteamento para CDN ou proxy
 * - Gestão de qualidade adaptativa
 * - Métricas de performance
 */

const SUPABASE_URL = 'https://sdvyxdghxqmntyoweqbd.supabase.co';

interface OptimizedStreamResult {
  url: string;
  routeType: 'cdn-direct' | 'cdn-router' | 'stream-proxy' | 'direct';
  cacheHint: string;
  isOptimized: boolean;
}

interface StreamQualityLevel {
  bitrate: number;
  resolution: string;
  label: string;
}

// =============================================================================
// CONTENT DETECTION
// =============================================================================

export function detectStreamType(url: string): 'live' | 'vod' | 'hls' | 'direct' {
  const urlLower = url.toLowerCase();
  
  // HLS manifest
  if (urlLower.includes('.m3u8') || urlLower.includes('.m3u')) {
    return 'hls';
  }
  
  // VOD patterns
  if (urlLower.includes('/movie/') || urlLower.includes('/series/') ||
      urlLower.includes('/vod/') || urlLower.includes('.mp4')) {
    return 'vod';
  }
  
  // Live patterns
  if (urlLower.includes('/live/') || urlLower.includes('live.')) {
    return 'live';
  }
  
  // Xtream Codes pattern
  const xtreamPattern = /\/(?:live\/)?[^\/]+\/[^\/]+\/\d+$/;
  if (xtreamPattern.test(url)) {
    return 'live';
  }
  
  return 'direct';
}

export function isR2Url(url: string): boolean {
  return url.includes('r2.cloudflarestorage.com') || 
         url.includes('.r2.dev') ||
         url.includes('pub-'); // R2 public bucket pattern
}

// =============================================================================
// URL OPTIMIZATION
// =============================================================================

export function getOptimizedStreamUrl(
  originalUrl: string, 
  channelId?: string,
  options?: { useRouter?: boolean; forceProxy?: boolean }
): OptimizedStreamResult {
  const { useRouter = true, forceProxy = false } = options || {};
  
  // Already optimized R2 URL
  if (isR2Url(originalUrl)) {
    return {
      url: originalUrl,
      routeType: 'cdn-direct',
      cacheHint: 'public, max-age=86400, immutable',
      isOptimized: true,
    };
  }
  
  const streamType = detectStreamType(originalUrl);
  
  // LIVE content goes DIRECT - no proxy, no cache (real-time streams)
  if (streamType === 'live') {
    return {
      url: originalUrl,
      routeType: 'direct',
      cacheHint: 'no-cache, no-store',
      isOptimized: false,
    };
  }
  
  // Force proxy mode (only for VOD/HLS)
  if (forceProxy) {
    return {
      url: `${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(originalUrl)}`,
      routeType: 'stream-proxy',
      cacheHint: 'public, max-age=300',
      isOptimized: false,
    };
  }
  
  // Use CDN router for intelligent routing (VOD/HLS only)
  if (useRouter && streamType !== 'direct') {
    const routerUrl = new URL(`${SUPABASE_URL}/functions/v1/cdn-router`);
    routerUrl.searchParams.set('url', originalUrl);
    if (channelId) {
      routerUrl.searchParams.set('channelId', channelId);
    }
    
    return {
      url: routerUrl.toString(),
      routeType: 'cdn-router',
      cacheHint: streamType === 'vod' ? 'public, max-age=3600' : 'public, max-age=5',
      isOptimized: true,
    };
  }
  
  // Direct streams or fallback - no proxy
  return {
    url: originalUrl,
    routeType: 'direct',
    cacheHint: 'no-cache',
    isOptimized: false,
  };
}

// =============================================================================
// QUALITY MANAGEMENT
// =============================================================================

const QUALITY_LEVELS: StreamQualityLevel[] = [
  { bitrate: 500000, resolution: '480p', label: 'SD' },
  { bitrate: 1500000, resolution: '720p', label: 'HD' },
  { bitrate: 4000000, resolution: '1080p', label: 'Full HD' },
  { bitrate: 8000000, resolution: '4K', label: '4K UHD' },
];

export function getRecommendedQuality(bandwidthKbps: number): StreamQualityLevel {
  const bandwidthBps = bandwidthKbps * 1000;
  
  // Leave 20% headroom
  const targetBitrate = bandwidthBps * 0.8;
  
  // Find highest quality that fits
  const suitable = QUALITY_LEVELS
    .filter(q => q.bitrate <= targetBitrate)
    .sort((a, b) => b.bitrate - a.bitrate);
  
  return suitable[0] || QUALITY_LEVELS[0];
}

export function estimateBandwidth(downloadBytes: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.round((downloadBytes * 8) / (durationMs / 1000) / 1000); // kbps
}

// =============================================================================
// HLS CONFIGURATION PRESETS
// =============================================================================

export interface HlsPreset {
  name: string;
  config: {
    maxBufferLength: number;
    maxMaxBufferLength: number;
    maxBufferSize: number;
    maxBufferHole: number;
    lowLatencyMode: boolean;
    backBufferLength: number;
    startFragPrefetch: boolean;
  };
}

export const HLS_PRESETS: Record<string, HlsPreset> = {
  // For live TV - ULTRA-FAST STARTUP prioritizado
  live: {
    name: 'Live TV',
    config: {
      maxBufferLength: 10,       // Reduzido para startup rápido
      maxMaxBufferLength: 30,
      maxBufferSize: 15 * 1000 * 1000,
      maxBufferHole: 1.0,        // Mais tolerante
      lowLatencyMode: false,
      backBufferLength: 5,       // Menos back buffer
      startFragPrefetch: true,
    },
  },
  
  // For VOD - startup rápido, depois expande
  vod: {
    name: 'VOD',
    config: {
      maxBufferLength: 15,       // Começa baixo
      maxMaxBufferLength: 60,
      maxBufferSize: 30 * 1000 * 1000,
      maxBufferHole: 0.8,
      lowLatencyMode: false,
      backBufferLength: 15,
      startFragPrefetch: true,
    },
  },
  
  // For low bandwidth connections - MUITO tolerante
  lowBandwidth: {
    name: 'Low Bandwidth',
    config: {
      maxBufferLength: 20,       // Buffer maior para compensar
      maxMaxBufferLength: 60,
      maxBufferSize: 15 * 1000 * 1000,
      maxBufferHole: 2.0,        // Muito tolerante
      lowLatencyMode: false,
      backBufferLength: 5,
      startFragPrefetch: true,   // Prefetch habilitado
    },
  },
  
  // For Smart TVs - startup rápido com memória limitada
  smartTv: {
    name: 'Smart TV',
    config: {
      maxBufferLength: 10,
      maxMaxBufferLength: 30,
      maxBufferSize: 12 * 1000 * 1000,
      maxBufferHole: 1.0,
      lowLatencyMode: false,
      backBufferLength: 3,
      startFragPrefetch: true,
    },
  },
};

export function getHlsPresetForDevice(): HlsPreset {
  const ua = navigator.userAgent.toLowerCase();
  
  // Smart TVs typically have limited memory
  if (ua.includes('tizen') || ua.includes('webos') || ua.includes('android tv')) {
    return HLS_PRESETS.smartTv;
  }
  
  // Mobile devices - check connection type
  const connection = (navigator as any).connection;
  if (connection) {
    const effectiveType = connection.effectiveType;
    if (effectiveType === '2g' || effectiveType === 'slow-2g') {
      return HLS_PRESETS.lowBandwidth;
    }
  }
  
  // Default to VOD for best experience on desktop
  return HLS_PRESETS.vod;
}

// =============================================================================
// EXPORTS
// =============================================================================

export const streamOptimizer = {
  detectStreamType,
  isR2Url,
  getOptimizedStreamUrl,
  getRecommendedQuality,
  estimateBandwidth,
  getHlsPresetForDevice,
  HLS_PRESETS,
};

export default streamOptimizer;
