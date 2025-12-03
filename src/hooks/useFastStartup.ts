/**
 * useFastStartup - Otimização de Startup Rápido
 * 
 * Detecta codecs suportados e qualidade ideal no startup
 * para iniciar playback o mais rápido possível
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Hls from 'hls.js';

interface CodecSupport {
  h264Baseline: boolean;
  h264Main: boolean;
  h264High: boolean;
  h265: boolean;
  vp9: boolean;
  av1: boolean;
  aacLC: boolean;
  aacHE: boolean;
  mp3: boolean;
  opus: boolean;
}

interface StartupConfig {
  preferredCodecs: string[];
  maxInitialBitrate: number;
  startLevel: number;
  enableWorker: boolean;
  preferredResolution: '480p' | '720p' | '1080p' | '4k';
}

interface DeviceCapabilities {
  isLowEnd: boolean;
  maxResolution: '480p' | '720p' | '1080p' | '4k';
  supportsHardwareDecoding: boolean;
  memory: number;
  cores: number;
}

interface UseFastStartupReturn {
  codecSupport: CodecSupport;
  deviceCapabilities: DeviceCapabilities;
  startupConfig: StartupConfig;
  isAnalyzing: boolean;
  getOptimalHlsConfig: () => Partial<Hls['config']>;
  preflightCheck: (url: string) => Promise<{ supported: boolean; bestLevel: number; estimatedStartTime: number }>;
}

// Cache de codec support (não muda durante sessão)
let cachedCodecSupport: CodecSupport | null = null;
let cachedDeviceCapabilities: DeviceCapabilities | null = null;

export function useFastStartup(): UseFastStartupReturn {
  const [codecSupport, setCodecSupport] = useState<CodecSupport>({
    h264Baseline: false,
    h264Main: false,
    h264High: false,
    h265: false,
    vp9: false,
    av1: false,
    aacLC: false,
    aacHE: false,
    mp3: false,
    opus: false,
  });
  
  const [deviceCapabilities, setDeviceCapabilities] = useState<DeviceCapabilities>({
    isLowEnd: false,
    maxResolution: '1080p',
    supportsHardwareDecoding: true,
    memory: 4,
    cores: 4,
  });
  
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const analyzedRef = useRef(false);

  // Detecta suporte a codecs
  const detectCodecSupport = useCallback(async (): Promise<CodecSupport> => {
    if (cachedCodecSupport) return cachedCodecSupport;
    
    const video = document.createElement('video');
    
    const support: CodecSupport = {
      h264Baseline: video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '',
      h264Main: video.canPlayType('video/mp4; codecs="avc1.4D401E"') !== '',
      h264High: video.canPlayType('video/mp4; codecs="avc1.64001E"') !== '',
      h265: video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') !== '' ||
            video.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"') !== '',
      vp9: video.canPlayType('video/webm; codecs="vp9"') !== '',
      av1: video.canPlayType('video/mp4; codecs="av01.0.01M.08"') !== '',
      aacLC: video.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '',
      aacHE: video.canPlayType('audio/mp4; codecs="mp4a.40.5"') !== '',
      mp3: video.canPlayType('audio/mpeg') !== '',
      opus: video.canPlayType('audio/webm; codecs="opus"') !== '',
    };
    
    cachedCodecSupport = support;
    return support;
  }, []);

  // Detecta capacidades do dispositivo
  const detectDeviceCapabilities = useCallback(async (): Promise<DeviceCapabilities> => {
    if (cachedDeviceCapabilities) return cachedDeviceCapabilities;
    
    const cores = navigator.hardwareConcurrency || 4;
    // @ts-ignore
    const memory = navigator.deviceMemory || 4;
    
    // Detecta se é dispositivo low-end
    const isLowEnd = cores <= 2 || memory <= 2;
    
    // Determina resolução máxima baseada em hardware
    let maxResolution: '480p' | '720p' | '1080p' | '4k' = '1080p';
    if (isLowEnd) {
      maxResolution = '480p';
    } else if (cores >= 8 && memory >= 8) {
      maxResolution = '4k';
    } else if (cores >= 4 && memory >= 4) {
      maxResolution = '1080p';
    } else {
      maxResolution = '720p';
    }
    
    // Verifica suporte a hardware decoding (heurística)
    const supportsHardwareDecoding = !isLowEnd && 
      ('gpu' in navigator || window.matchMedia('(color-gamut: p3)').matches);
    
    const capabilities: DeviceCapabilities = {
      isLowEnd,
      maxResolution,
      supportsHardwareDecoding,
      memory,
      cores,
    };
    
    cachedDeviceCapabilities = capabilities;
    return capabilities;
  }, []);

  // Calcula configuração de startup otimizada
  const startupConfig = useMemo((): StartupConfig => {
    // Prioriza codecs por eficiência
    const preferredCodecs: string[] = [];
    
    if (codecSupport.av1) preferredCodecs.push('av01');
    if (codecSupport.h265) preferredCodecs.push('hvc1', 'hev1');
    if (codecSupport.vp9) preferredCodecs.push('vp9');
    if (codecSupport.h264High) preferredCodecs.push('avc1.64');
    if (codecSupport.h264Main) preferredCodecs.push('avc1.4D');
    if (codecSupport.h264Baseline) preferredCodecs.push('avc1.42');
    
    // Bitrate inicial baseado em device e conexão
    let maxInitialBitrate = 2000000; // 2 Mbps default
    
    // @ts-ignore
    const connection = navigator.connection;
    if (connection?.downlink) {
      // 70% do downlink para ser conservador
      maxInitialBitrate = Math.min(connection.downlink * 1000 * 1000 * 0.7, 8000000);
    }
    
    if (deviceCapabilities.isLowEnd) {
      maxInitialBitrate = Math.min(maxInitialBitrate, 1000000);
    }
    
    // Start level baseado em bitrate
    let startLevel = -1; // Auto por default
    if (deviceCapabilities.isLowEnd) {
      startLevel = 0; // Força qualidade mais baixa em devices fracos
    }
    
    return {
      preferredCodecs,
      maxInitialBitrate,
      startLevel,
      enableWorker: !deviceCapabilities.isLowEnd,
      preferredResolution: deviceCapabilities.maxResolution,
    };
  }, [codecSupport, deviceCapabilities]);

  // Retorna config HLS otimizada
  const getOptimalHlsConfig = useCallback((): Partial<Hls['config']> => {
    return {
      // Fast startup
      startLevel: startupConfig.startLevel,
      startFragPrefetch: true,
      
      // Worker
      enableWorker: startupConfig.enableWorker,
      
      // ABR otimizado para startup rápido
      abrEwmaDefaultEstimate: startupConfig.maxInitialBitrate,
      abrBandWidthFactor: 0.95,
      abrBandWidthUpFactor: 0.7,
      abrMaxWithRealBitrate: true,
      
      // Buffer inicial mínimo para começar rápido
      maxBufferLength: deviceCapabilities.isLowEnd ? 15 : 30,
      maxMaxBufferLength: deviceCapabilities.isLowEnd ? 30 : 60,
      maxBufferSize: deviceCapabilities.isLowEnd ? 30 * 1000 * 1000 : 60 * 1000 * 1000,
      
      // Delays reduzidos para startup rápido
      maxStarvationDelay: 2,
      maxLoadingDelay: 2,
      
      // Retry agressivo para não falhar no startup
      fragLoadingMaxRetry: 6,
      manifestLoadingMaxRetry: 4,
      levelLoadingMaxRetry: 4,
      fragLoadingTimeOut: 15000,
      manifestLoadingTimeOut: 10000,
      
      // Progressive loading
      progressive: true,
      
      // Latência (não-live por default)
      lowLatencyMode: false,
      liveSyncDurationCount: 3,
      
      // Codec hints
      preferManagedMediaSource: true,
    };
  }, [startupConfig, deviceCapabilities]);

  // Preflight check de URL
  const preflightCheck = useCallback(async (url: string): Promise<{
    supported: boolean;
    bestLevel: number;
    estimatedStartTime: number;
  }> => {
    const startTime = performance.now();
    
    try {
      // Faz HEAD request para verificar disponibilidade
      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'no-cache',
      });
      
      const contentType = response.headers.get('content-type') || '';
      const supported = response.ok && (
        contentType.includes('mpegurl') ||
        contentType.includes('mp2t') ||
        contentType.includes('video') ||
        url.includes('.m3u8') ||
        url.includes('.ts')
      );
      
      const latency = performance.now() - startTime;
      
      // Estima tempo de start baseado em latência
      const estimatedStartTime = Math.max(500, latency * 3);
      
      // Determina melhor nível inicial baseado em latência
      let bestLevel = -1; // Auto
      if (latency > 2000) {
        bestLevel = 0; // Conexão lenta, começa no mais baixo
      } else if (latency > 1000) {
        bestLevel = 1;
      }
      
      return { supported, bestLevel, estimatedStartTime };
    } catch (error) {
      return { supported: false, bestLevel: 0, estimatedStartTime: 5000 };
    }
  }, []);

  // Análise inicial
  useEffect(() => {
    if (analyzedRef.current) return;
    analyzedRef.current = true;
    
    const analyze = async () => {
      setIsAnalyzing(true);
      
      const [codecs, capabilities] = await Promise.all([
        detectCodecSupport(),
        detectDeviceCapabilities(),
      ]);
      
      setCodecSupport(codecs);
      setDeviceCapabilities(capabilities);
      setIsAnalyzing(false);
      
      console.log('[FastStartup] Análise completa:', {
        codecs,
        capabilities,
      });
    };
    
    analyze();
  }, [detectCodecSupport, detectDeviceCapabilities]);

  return {
    codecSupport,
    deviceCapabilities,
    startupConfig,
    isAnalyzing,
    getOptimalHlsConfig,
    preflightCheck,
  };
}

export default useFastStartup;
