/**
 * useAdvancedHlsConfig - Configuração HLS avançada com todas as otimizações
 */

import { useMemo } from 'react';
import Hls from 'hls.js';
import { connectionService } from '@/services/connectionService';

type DeviceType = 'desktop' | 'mobile' | 'tv' | 'tablet';
type StreamType = 'live' | 'vod';

interface AdvancedHlsConfigOptions {
  /** Tipo de stream */
  streamType?: StreamType;
  /** Forçar low latency */
  lowLatency?: boolean;
  /** Max bitrate cap (bps) */
  maxBitrate?: number;
  /** Tamanho da tela para cap automático */
  playerSize?: { width: number; height: number };
}

function detectDeviceType(): DeviceType {
  const ua = navigator.userAgent.toLowerCase();
  
  if (ua.includes('tizen') || ua.includes('webos') || ua.includes('android tv') || ua.includes('firetv')) {
    return 'tv';
  }
  if (ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))) {
    return 'tablet';
  }
  if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) {
    return 'mobile';
  }
  return 'desktop';
}

function getDeviceMemoryLimit(): number {
  // @ts-ignore - deviceMemory não está em todos os navegadores
  const deviceMemory = navigator.deviceMemory;
  if (deviceMemory) {
    // Dispositivos com menos de 4GB: limite mais baixo
    if (deviceMemory < 4) return 20 * 1000 * 1000; // 20MB
    if (deviceMemory < 8) return 40 * 1000 * 1000; // 40MB
  }
  return 60 * 1000 * 1000; // 60MB default
}

export function useAdvancedHlsConfig(options: AdvancedHlsConfigOptions = {}) {
  const {
    streamType = 'live',
    lowLatency = false,
    maxBitrate,
    playerSize,
  } = options;

  const config = useMemo((): Partial<Hls['config']> => {
    const deviceType = detectDeviceType();
    const connectionInfo = connectionService.getConnectionInfo();
    const connectionQuality = connectionInfo.quality;
    const memoryLimit = getDeviceMemoryLimit();

    console.log('[HlsConfig] Device:', deviceType, 'Connection:', connectionQuality, 'Stream:', streamType);

    // Base config otimizada
    const baseConfig: Partial<Hls['config']> = {
      enableWorker: true,
      
      // Progressive download para início mais rápido
      progressive: true,
      
      // Prefetch do primeiro fragmento
      startFragPrefetch: true,
      
      // Bandwidth testing
      testBandwidth: true,
      
      // Cap para tamanho do player (não carrega 4K em tela pequena)
      capLevelToPlayerSize: true,
      
      // Cap quando FPS cai (evita travamentos)
      capLevelOnFPSDrop: true,
      fpsDroppedMonitoringPeriod: 3000,
      fpsDroppedMonitoringThreshold: 0.1,
      
      // Memory limit baseado no dispositivo
      maxBufferSize: memoryLimit,
      
      // Tolerância a buracos no buffer
      maxBufferHole: 0.5,
      
      // Retry com backoff exponencial
      fragLoadingMaxRetry: 6,
      manifestLoadingMaxRetry: 4,
      levelLoadingMaxRetry: 4,
      fragLoadingRetryDelay: 1000,
      manifestLoadingRetryDelay: 1000,
      levelLoadingRetryDelay: 1000,
      
      // Timeouts otimizados
      fragLoadingTimeOut: 20000,
      manifestLoadingTimeOut: 10000,
      levelLoadingTimeOut: 10000,
    };

    // Configuração por tipo de dispositivo
    const deviceConfig: Partial<Hls['config']> = {};
    
    switch (deviceType) {
      case 'tv':
        // Smart TVs: memória limitada, priorizar estabilidade
        deviceConfig.backBufferLength = 15;
        deviceConfig.maxBufferLength = 30;
        deviceConfig.maxMaxBufferLength = 60;
        deviceConfig.maxBufferSize = 20 * 1000 * 1000;
        break;
        
      case 'mobile':
        // Mobile: economizar bateria e dados
        deviceConfig.backBufferLength = 10;
        deviceConfig.maxBufferLength = 20;
        deviceConfig.maxMaxBufferLength = 40;
        deviceConfig.maxBufferSize = 15 * 1000 * 1000;
        break;
        
      case 'tablet':
        deviceConfig.backBufferLength = 20;
        deviceConfig.maxBufferLength = 30;
        deviceConfig.maxMaxBufferLength = 60;
        break;
        
      default: // desktop
        deviceConfig.backBufferLength = 30;
        deviceConfig.maxBufferLength = 40;
        deviceConfig.maxMaxBufferLength = 120;
    }

    // Configuração por qualidade de conexão
    const connectionConfig: Partial<Hls['config']> = {};
    
    switch (connectionQuality) {
      case 'poor':
        connectionConfig.startLevel = 0; // Começa no mais baixo
        connectionConfig.abrEwmaDefaultEstimate = 500000; // 500kbps
        connectionConfig.abrBandWidthFactor = 0.7;
        connectionConfig.abrBandWidthUpFactor = 0.5;
        connectionConfig.fragLoadingMaxRetry = 10;
        connectionConfig.fragLoadingRetryDelay = 500;
        break;
        
      case 'fair':
        connectionConfig.startLevel = 0;
        connectionConfig.abrEwmaDefaultEstimate = 1500000;
        connectionConfig.abrBandWidthFactor = 0.8;
        connectionConfig.abrBandWidthUpFactor = 0.6;
        connectionConfig.fragLoadingMaxRetry = 8;
        break;
        
      case 'excellent':
        connectionConfig.startLevel = -1; // Auto (pode começar alto)
        connectionConfig.abrEwmaDefaultEstimate = 5000000;
        connectionConfig.abrBandWidthFactor = 0.95;
        connectionConfig.abrBandWidthUpFactor = 0.8;
        break;
        
      default: // good
        connectionConfig.startLevel = -1;
        connectionConfig.abrEwmaDefaultEstimate = 2000000;
        connectionConfig.abrBandWidthFactor = 0.9;
        connectionConfig.abrBandWidthUpFactor = 0.7;
        connectionConfig.abrMaxWithRealBitrate = true;
    }

    // Configuração por tipo de stream
    const streamConfig: Partial<Hls['config']> = {};
    
    if (streamType === 'live') {
      streamConfig.liveSyncDurationCount = 3;
      streamConfig.liveMaxLatencyDurationCount = 10;
      
      if (lowLatency) {
        // Low latency mode (~2-4s delay)
        streamConfig.lowLatencyMode = true;
        streamConfig.liveSyncDuration = 3;
        streamConfig.liveMaxLatencyDuration = 5;
        streamConfig.liveBackBufferLength = 10;
        streamConfig.maxBufferLength = 10;
        streamConfig.maxMaxBufferLength = 20;
        streamConfig.backBufferLength = 5;
      }
    } else {
      // VOD: prioriza seeking e qualidade
      streamConfig.maxBufferLength = 60;
      streamConfig.maxMaxBufferLength = 120;
      streamConfig.backBufferLength = 60;
    }

    // ABR smoothing para transições suaves
    const abrConfig: Partial<Hls['config']> = {
      abrEwmaFastLive: 3.0,
      abrEwmaSlowLive: 9.0,
      abrEwmaFastVoD: 3.0,
      abrEwmaSlowVoD: 9.0,
    };

  // Merge todas as configs
    return {
      ...baseConfig,
      ...deviceConfig,
      ...connectionConfig,
      ...streamConfig,
      ...abrConfig,
    };
  }, [streamType, lowLatency, maxBitrate, playerSize]);

  // Video element props for optimized loading
  const videoProps = useMemo(() => ({
    preload: 'metadata' as const,
  }), []);

  // Function to get the config (useful for lazy initialization)
  const getConfig = () => config;

  return {
    config,
    getConfig,
    videoProps,
  };
}

/**
 * Aplica configurações dinâmicas a uma instância HLS existente
 */
export function applyDynamicConfig(
  hls: Hls,
  options: {
    maxBitrate?: number;
    forceLowestQuality?: boolean;
    pauseLoading?: boolean;
  }
) {
  if (options.maxBitrate) {
    const levels = hls.levels;
    const maxLevel = levels.findIndex(l => l.bitrate > options.maxBitrate!);
    if (maxLevel > 0) {
      hls.autoLevelCapping = maxLevel - 1;
      console.log('[HlsConfig] Capped to level:', maxLevel - 1);
    }
  }

  if (options.forceLowestQuality) {
    hls.currentLevel = 0;
    hls.nextLevel = 0;
  }

  if (options.pauseLoading) {
    hls.stopLoad();
  }
}

export default useAdvancedHlsConfig;
