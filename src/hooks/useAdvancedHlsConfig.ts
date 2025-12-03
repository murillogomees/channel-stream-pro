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

    // =========================================================================
    // ULTRA-FAST STARTUP CONFIG - Prioriza TTFF (Time To First Frame)
    // =========================================================================
    const baseConfig: Partial<Hls['config']> = {
      enableWorker: true,
      
      // CRITICAL: Sempre começar na qualidade mais baixa para primeiro frame rápido
      startLevel: 0,
      
      // Progressive download - crítico para startup
      progressive: true,
      
      // Prefetch agressivo do primeiro fragmento
      startFragPrefetch: true,
      
      // STARTUP RÁPIDO: Começar a tocar com menos buffer
      // Estes são os parâmetros mais importantes para TTFF
      maxBufferLength: 10,           // Reduzido de 30 para 10s
      maxMaxBufferLength: 30,        // Limite máximo
      
      // Bandwidth testing rápido
      testBandwidth: true,
      
      // Cap para tamanho do player
      capLevelToPlayerSize: true,
      capLevelOnFPSDrop: true,
      fpsDroppedMonitoringPeriod: 2000,
      fpsDroppedMonitoringThreshold: 0.15,
      
      // Memory limit
      maxBufferSize: memoryLimit,
      
      // Tolerância maior a buracos no buffer para não travar
      maxBufferHole: 1.0,
      
      // Retry configuração agressiva
      fragLoadingMaxRetry: 4,
      manifestLoadingMaxRetry: 3,
      levelLoadingMaxRetry: 3,
      fragLoadingRetryDelay: 500,     // 500ms ao invés de 1000ms
      manifestLoadingRetryDelay: 500,
      levelLoadingRetryDelay: 500,
      
      // TIMEOUTS AGRESSIVOS - Falhar rápido e tentar de novo
      fragLoadingTimeOut: 10000,      // 10s ao invés de 20s
      manifestLoadingTimeOut: 5000,   // 5s ao invés de 10s
      levelLoadingTimeOut: 5000,
      
      // ABR otimizado para startup rápido
      abrEwmaDefaultEstimate: 500000,  // Assumir 500kbps inicialmente
      
      // Live sync - começar mais perto do live edge
      liveSyncDurationCount: 2,        // Reduzido de 3
      liveMaxLatencyDurationCount: 6,  // Reduzido de 10
    };

    // Configuração por tipo de dispositivo - OTIMIZADO para startup rápido
    const deviceConfig: Partial<Hls['config']> = {};
    
    switch (deviceType) {
      case 'tv':
        // Smart TVs: buffer reduzido para startup rápido
        deviceConfig.backBufferLength = 5;
        deviceConfig.maxBufferLength = 15;
        deviceConfig.maxMaxBufferLength = 30;
        deviceConfig.maxBufferSize = 15 * 1000 * 1000;
        break;
        
      case 'mobile':
        // Mobile: startup ultra-rápido
        deviceConfig.backBufferLength = 3;
        deviceConfig.maxBufferLength = 10;
        deviceConfig.maxMaxBufferLength = 20;
        deviceConfig.maxBufferSize = 10 * 1000 * 1000;
        break;
        
      case 'tablet':
        deviceConfig.backBufferLength = 5;
        deviceConfig.maxBufferLength = 15;
        deviceConfig.maxMaxBufferLength = 30;
        break;
        
      default: // desktop
        deviceConfig.backBufferLength = 10;
        deviceConfig.maxBufferLength = 20;
        deviceConfig.maxMaxBufferLength = 60;
    }

    // Configuração por qualidade de conexão
    // IMPORTANTE: Sempre startLevel: 0 para TTFF rápido, depois sobe automaticamente
    const connectionConfig: Partial<Hls['config']> = {
      startLevel: 0, // SEMPRE começar baixo para primeiro frame rápido
    };
    
    switch (connectionQuality) {
      case 'poor':
        connectionConfig.abrEwmaDefaultEstimate = 300000; // 300kbps
        connectionConfig.abrBandWidthFactor = 0.6;
        connectionConfig.abrBandWidthUpFactor = 0.4;
        connectionConfig.fragLoadingMaxRetry = 8;
        connectionConfig.fragLoadingRetryDelay = 300;
        break;
        
      case 'fair':
        connectionConfig.abrEwmaDefaultEstimate = 800000;
        connectionConfig.abrBandWidthFactor = 0.75;
        connectionConfig.abrBandWidthUpFactor = 0.55;
        connectionConfig.fragLoadingMaxRetry = 6;
        break;
        
      case 'excellent':
        connectionConfig.abrEwmaDefaultEstimate = 3000000;
        connectionConfig.abrBandWidthFactor = 0.9;
        connectionConfig.abrBandWidthUpFactor = 0.75;
        break;
        
      default: // good
        connectionConfig.abrEwmaDefaultEstimate = 1500000;
        connectionConfig.abrBandWidthFactor = 0.85;
        connectionConfig.abrBandWidthUpFactor = 0.65;
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
