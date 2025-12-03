/**
 * Player Buffer Configuration - Anti-Buffering Settings
 * 
 * Configurações agressivas de buffer para minimizar buffering frequente
 */

import Hls from 'hls.js';

export type ConnectionQuality = 'poor' | 'fair' | 'good' | 'excellent';
export type ContentType = 'live' | 'vod';

interface BufferPreset {
  // Buffer lengths
  maxBufferLength: number;
  maxMaxBufferLength: number;
  maxBufferSize: number;
  backBufferLength: number;
  
  // Buffer hole tolerance
  maxBufferHole: number;
  
  // Live sync settings
  liveSyncDurationCount: number;
  liveMaxLatencyDurationCount: number;
  lowLatencyMode: boolean;
  
  // Stall recovery
  nudgeOffset: number;
  nudgeMaxRetry: number;
  maxStarvationDelay: number;
  maxLoadingDelay: number;
  
  // ABR settings
  abrEwmaDefaultEstimate: number;
  abrBandWidthFactor: number;
  abrBandWidthUpFactor: number;
}

/**
 * Buffer presets optimized for different connection qualities
 */
export const BUFFER_PRESETS: Record<ConnectionQuality, BufferPreset> = {
  // Conexão muito ruim - buffer super agressivo
  poor: {
    maxBufferLength: 120,           // 2 minutos de buffer
    maxMaxBufferLength: 180,        // Até 3 minutos
    maxBufferSize: 200 * 1000000,   // 200MB
    backBufferLength: 90,           // 1.5 min back buffer
    maxBufferHole: 2.0,             // Tolera gaps de 2s
    liveSyncDurationCount: 6,       // 6 segmentos atrás do live
    liveMaxLatencyDurationCount: 20,// 20 segmentos de latência máxima
    lowLatencyMode: false,
    nudgeOffset: 0.2,
    nudgeMaxRetry: 10,
    maxStarvationDelay: 8,
    maxLoadingDelay: 8,
    abrEwmaDefaultEstimate: 500000, // Assume 500kbps
    abrBandWidthFactor: 0.7,        // Muito conservador
    abrBandWidthUpFactor: 0.5,
  },
  
  // Conexão regular
  fair: {
    maxBufferLength: 60,
    maxMaxBufferLength: 120,
    maxBufferSize: 120 * 1000000,
    backBufferLength: 60,
    maxBufferHole: 1.0,
    liveSyncDurationCount: 4,
    liveMaxLatencyDurationCount: 15,
    lowLatencyMode: false,
    nudgeOffset: 0.15,
    nudgeMaxRetry: 7,
    maxStarvationDelay: 6,
    maxLoadingDelay: 6,
    abrEwmaDefaultEstimate: 1000000,
    abrBandWidthFactor: 0.8,
    abrBandWidthUpFactor: 0.6,
  },
  
  // Boa conexão
  good: {
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    maxBufferSize: 60 * 1000000,
    backBufferLength: 30,
    maxBufferHole: 0.5,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 10,
    lowLatencyMode: false,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 5,
    maxStarvationDelay: 4,
    maxLoadingDelay: 4,
    abrEwmaDefaultEstimate: 2000000,
    abrBandWidthFactor: 0.9,
    abrBandWidthUpFactor: 0.7,
  },
  
  // Excelente conexão
  excellent: {
    maxBufferLength: 20,
    maxMaxBufferLength: 40,
    maxBufferSize: 40 * 1000000,
    backBufferLength: 20,
    maxBufferHole: 0.3,
    liveSyncDurationCount: 2,
    liveMaxLatencyDurationCount: 6,
    lowLatencyMode: false,
    nudgeOffset: 0.05,
    nudgeMaxRetry: 3,
    maxStarvationDelay: 2,
    maxLoadingDelay: 2,
    abrEwmaDefaultEstimate: 5000000,
    abrBandWidthFactor: 0.95,
    abrBandWidthUpFactor: 0.8,
  },
};

/**
 * Network resilience settings for HLS.js
 */
export const NETWORK_RESILIENCE_CONFIG: Partial<Hls['config']> = {
  // Fragment loading
  fragLoadingTimeOut: 30000,        // 30s timeout
  fragLoadingMaxRetry: 10,          // 10 retries
  fragLoadingRetryDelay: 500,       // Start at 500ms
  fragLoadingMaxRetryTimeout: 64000,// Max 64s between retries
  
  // Manifest loading
  manifestLoadingTimeOut: 20000,
  manifestLoadingMaxRetry: 6,
  manifestLoadingRetryDelay: 1000,
  
  // Level loading
  levelLoadingTimeOut: 20000,
  levelLoadingMaxRetry: 6,
  levelLoadingRetryDelay: 1000,
  
  // Progressive loading
  progressive: true,
  
  // High buffer watchdog
  highBufferWatchdogPeriod: 2,
};

/**
 * Get optimized HLS config based on connection quality
 */
export function getOptimizedHlsConfig(
  quality: ConnectionQuality = 'good',
  contentType: ContentType = 'live'
): Partial<Hls['config']> {
  const preset = BUFFER_PRESETS[quality];
  
  return {
    // Buffer settings from preset
    maxBufferLength: preset.maxBufferLength,
    maxMaxBufferLength: preset.maxMaxBufferLength,
    maxBufferSize: preset.maxBufferSize,
    backBufferLength: preset.backBufferLength,
    maxBufferHole: preset.maxBufferHole,
    
    // Live settings
    liveSyncDurationCount: preset.liveSyncDurationCount,
    liveMaxLatencyDurationCount: preset.liveMaxLatencyDurationCount,
    lowLatencyMode: preset.lowLatencyMode,
    liveDurationInfinity: contentType === 'live',
    
    // Stall recovery
    nudgeOffset: preset.nudgeOffset,
    nudgeMaxRetry: preset.nudgeMaxRetry,
    maxStarvationDelay: preset.maxStarvationDelay,
    maxLoadingDelay: preset.maxLoadingDelay,
    
    // ABR
    abrEwmaDefaultEstimate: preset.abrEwmaDefaultEstimate,
    abrBandWidthFactor: preset.abrBandWidthFactor,
    abrBandWidthUpFactor: preset.abrBandWidthUpFactor,
    abrEwmaFastLive: 3,
    abrEwmaSlowLive: 9,
    
    // Fast startup
    startLevel: -1,
    startFragPrefetch: true,
    
    // Worker
    enableWorker: true,
    
    // Network resilience
    ...NETWORK_RESILIENCE_CONFIG,
  };
}

/**
 * Detect connection quality based on effective type
 */
export function detectConnectionQuality(): ConnectionQuality {
  if (typeof navigator === 'undefined') return 'good';
  
  const connection = (navigator as any).connection;
  if (!connection) return 'good';
  
  const effectiveType = connection.effectiveType;
  const downlink = connection.downlink || 10;
  
  // Based on effective type
  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return 'poor';
  }
  if (effectiveType === '3g') {
    return downlink < 1 ? 'poor' : 'fair';
  }
  
  // Based on downlink speed
  if (downlink < 1) return 'poor';
  if (downlink < 3) return 'fair';
  if (downlink < 10) return 'good';
  
  return 'excellent';
}

/**
 * MPEGTS config for live streams - anti-buffering
 */
export function getMpegtsConfig(quality: ConnectionQuality = 'good') {
  const preset = BUFFER_PRESETS[quality];
  
  return {
    enableWorker: true,
    enableStashBuffer: true,
    stashInitialSize: quality === 'poor' ? 256 * 1024 : 128 * 1024,
    autoCleanupSourceBuffer: true,
    autoCleanupMaxBackwardDuration: preset.backBufferLength,
    autoCleanupMinBackwardDuration: Math.floor(preset.backBufferLength / 2),
    
    // CRITICAL: Disable features that cause restarts
    liveBufferLatencyChasing: false,
    liveSync: false,
    
    lazyLoad: false,
    lazyLoadMaxDuration: 0,
    lazyLoadRecoverDuration: 0,
    deferLoadAfterSourceOpen: false,
    
    fixAudioTimestampGap: true,
    accurateSeek: true,
    seekType: 'range' as const,
    reuseRedirectedURL: true,
  };
}
