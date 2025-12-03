/**
 * useAdaptiveBuffer - Buffer Adaptativo Inteligente
 * Ajusta configurações de buffer baseado em:
 * - Qualidade da conexão
 * - Tipo de dispositivo
 * - Histórico de stalls
 * - Tipo de conteúdo (live vs VOD)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Hls from 'hls.js';

interface BufferConfig {
  maxBufferLength: number;
  maxMaxBufferLength: number;
  maxBufferSize: number;
  maxBufferHole: number;
  backBufferLength: number;
  liveSyncDurationCount: number;
  liveMaxLatencyDurationCount: number;
  lowLatencyMode: boolean;
}

interface BufferStats {
  currentBuffer: number;
  stallCount: number;
  lastStallTime: number;
  avgBufferHealth: number;
  connectionQuality: 'poor' | 'fair' | 'good' | 'excellent';
  adaptationLevel: number;
}

interface UseAdaptiveBufferOptions {
  isLive?: boolean;
  initialQuality?: 'poor' | 'fair' | 'good' | 'excellent';
}

// Presets baseados em qualidade de conexão
const BUFFER_PRESETS: Record<string, BufferConfig> = {
  // Conexão ruim - buffer agressivo para estabilidade
  poor: {
    maxBufferLength: 60,
    maxMaxBufferLength: 120,
    maxBufferSize: 120 * 1000 * 1000,
    maxBufferHole: 1.0,
    backBufferLength: 60,
    liveSyncDurationCount: 5,
    liveMaxLatencyDurationCount: 15,
    lowLatencyMode: false,
  },
  // Conexão razoável
  fair: {
    maxBufferLength: 40,
    maxMaxBufferLength: 90,
    maxBufferSize: 90 * 1000 * 1000,
    maxBufferHole: 0.5,
    backBufferLength: 45,
    liveSyncDurationCount: 4,
    liveMaxLatencyDurationCount: 12,
    lowLatencyMode: false,
  },
  // Conexão boa
  good: {
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    maxBufferSize: 60 * 1000 * 1000,
    maxBufferHole: 0.3,
    backBufferLength: 30,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 10,
    lowLatencyMode: false,
  },
  // Conexão excelente - pode ser mais agressivo
  excellent: {
    maxBufferLength: 20,
    maxMaxBufferLength: 40,
    maxBufferSize: 40 * 1000 * 1000,
    maxBufferHole: 0.2,
    backBufferLength: 20,
    liveSyncDurationCount: 2,
    liveMaxLatencyDurationCount: 6,
    lowLatencyMode: true,
  },
};

// Ajustes para VOD
const VOD_ADJUSTMENTS: Partial<BufferConfig> = {
  liveSyncDurationCount: 0,
  liveMaxLatencyDurationCount: 0,
  lowLatencyMode: false,
};

export function useAdaptiveBuffer(options: UseAdaptiveBufferOptions = {}) {
  const { isLive = true, initialQuality = 'good' } = options;
  
  const [stats, setStats] = useState<BufferStats>({
    currentBuffer: 0,
    stallCount: 0,
    lastStallTime: 0,
    avgBufferHealth: 100,
    connectionQuality: initialQuality,
    adaptationLevel: 0,
  });
  
  const [config, setConfig] = useState<BufferConfig>(BUFFER_PRESETS[initialQuality]);
  
  const stallHistory = useRef<number[]>([]);
  const bufferHistory = useRef<number[]>([]);
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const measurementInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detecta qualidade da conexão
  const detectConnectionQuality = useCallback((): 'poor' | 'fair' | 'good' | 'excellent' => {
    // @ts-ignore - Navigator connection API
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
      const { effectiveType, downlink, rtt } = connection;
      
      // Baseado em effective type
      if (effectiveType === '4g' && downlink > 5 && rtt < 100) {
        return 'excellent';
      }
      if (effectiveType === '4g' || (effectiveType === '3g' && downlink > 2)) {
        return 'good';
      }
      if (effectiveType === '3g' || downlink > 0.5) {
        return 'fair';
      }
      return 'poor';
    }
    
    // Fallback: estima baseado em histórico de buffer
    const avgBuffer = bufferHistory.current.length > 0
      ? bufferHistory.current.reduce((a, b) => a + b, 0) / bufferHistory.current.length
      : 10;
    
    const recentStalls = stallHistory.current.filter(
      t => Date.now() - t < 60000
    ).length;
    
    if (avgBuffer > 15 && recentStalls === 0) return 'excellent';
    if (avgBuffer > 8 && recentStalls <= 1) return 'good';
    if (avgBuffer > 4 && recentStalls <= 3) return 'fair';
    return 'poor';
  }, []);

  // Atualiza configuração baseado em qualidade
  const updateConfig = useCallback((quality: 'poor' | 'fair' | 'good' | 'excellent') => {
    let newConfig = { ...BUFFER_PRESETS[quality] };
    
    // Aplica ajustes VOD se não for live
    if (!isLive) {
      newConfig = { ...newConfig, ...VOD_ADJUSTMENTS };
    }
    
    // Aumenta buffer se houver muitos stalls recentes
    const recentStalls = stallHistory.current.filter(
      t => Date.now() - t < 60000
    ).length;
    
    if (recentStalls >= 3) {
      newConfig.maxBufferLength = Math.min(newConfig.maxBufferLength * 1.5, 90);
      newConfig.maxMaxBufferLength = Math.min(newConfig.maxMaxBufferLength * 1.5, 180);
    }
    
    setConfig(newConfig);
    setStats(prev => ({
      ...prev,
      connectionQuality: quality,
      adaptationLevel: prev.adaptationLevel + 1,
    }));
    
    console.log(`[AdaptiveBuffer] Configuração atualizada: ${quality}`, newConfig);
  }, [isLive]);

  // Registra stall
  const recordStall = useCallback(() => {
    const now = Date.now();
    stallHistory.current.push(now);
    
    // Mantém apenas últimos 10 minutos
    stallHistory.current = stallHistory.current.filter(t => now - t < 600000);
    
    setStats(prev => ({
      ...prev,
      stallCount: prev.stallCount + 1,
      lastStallTime: now,
    }));
    
    // Re-avalia qualidade após stall
    const quality = detectConnectionQuality();
    if (quality !== stats.connectionQuality) {
      updateConfig(quality);
    }
  }, [detectConnectionQuality, stats.connectionQuality, updateConfig]);

  // Mede buffer atual
  const measureBuffer = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    let currentBuffer = 0;
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      currentBuffer = bufferedEnd - video.currentTime;
    }
    
    bufferHistory.current.push(currentBuffer);
    
    // Mantém apenas últimas 60 medições
    if (bufferHistory.current.length > 60) {
      bufferHistory.current.shift();
    }
    
    // Calcula saúde do buffer (0-100)
    const avgBuffer = bufferHistory.current.reduce((a, b) => a + b, 0) / bufferHistory.current.length;
    const bufferHealth = Math.min(100, (avgBuffer / config.maxBufferLength) * 100);
    
    setStats(prev => ({
      ...prev,
      currentBuffer,
      avgBufferHealth: bufferHealth,
    }));
    
    // Adapta se buffer estiver muito baixo consistentemente
    if (avgBuffer < 5 && stats.connectionQuality !== 'poor') {
      console.log('[AdaptiveBuffer] Buffer baixo detectado, adaptando...');
      const newQuality = stats.connectionQuality === 'excellent' ? 'good' :
                         stats.connectionQuality === 'good' ? 'fair' : 'poor';
      updateConfig(newQuality);
    }
  }, [config.maxBufferLength, stats.connectionQuality, updateConfig]);

  // Anexa HLS instance para monitoramento
  const attachHls = useCallback((hls: Hls) => {
    hlsRef.current = hls;
    
    // Monitora eventos de buffer
    hls.on(Hls.Events.FRAG_BUFFERED, measureBuffer);
    
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
          data.details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL) {
        recordStall();
      }
    });
    
    // Aplica configuração inicial
    applyConfigToHls(hls, config);
  }, [config, measureBuffer, recordStall]);

  // Aplica configuração ao HLS
  const applyConfigToHls = useCallback((hls: Hls, cfg: BufferConfig) => {
    if (!hls) return;
    
    hls.config.maxBufferLength = cfg.maxBufferLength;
    hls.config.maxMaxBufferLength = cfg.maxMaxBufferLength;
    hls.config.maxBufferSize = cfg.maxBufferSize;
    hls.config.maxBufferHole = cfg.maxBufferHole;
    hls.config.backBufferLength = cfg.backBufferLength;
    hls.config.liveSyncDurationCount = cfg.liveSyncDurationCount;
    hls.config.liveMaxLatencyDurationCount = cfg.liveMaxLatencyDurationCount;
    hls.config.lowLatencyMode = cfg.lowLatencyMode;
  }, []);

  // Anexa video element
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
    
    // Monitora eventos de stall
    video.addEventListener('waiting', recordStall);
    video.addEventListener('stalled', recordStall);
    
    // Inicia medição periódica
    if (measurementInterval.current) {
      clearInterval(measurementInterval.current);
    }
    measurementInterval.current = setInterval(measureBuffer, 2000);
  }, [measureBuffer, recordStall]);

  // Detach
  const detach = useCallback(() => {
    if (measurementInterval.current) {
      clearInterval(measurementInterval.current);
      measurementInterval.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.removeEventListener('waiting', recordStall);
      videoRef.current.removeEventListener('stalled', recordStall);
    }
    
    hlsRef.current = null;
    videoRef.current = null;
  }, [recordStall]);

  // Obtém config HLS completa
  const getHlsConfig = useMemo((): Partial<Hls['config']> => {
    return {
      ...config,
      // Adiciona configurações extras de performance
      startFragPrefetch: true,
      abrEwmaDefaultEstimate: stats.connectionQuality === 'excellent' ? 5000000 :
                              stats.connectionQuality === 'good' ? 3000000 :
                              stats.connectionQuality === 'fair' ? 1500000 : 500000,
      abrBandWidthFactor: 0.9,
      abrBandWidthUpFactor: 0.7,
      fragLoadingTimeOut: stats.connectionQuality === 'poor' ? 30000 : 20000,
      fragLoadingMaxRetry: stats.connectionQuality === 'poor' ? 8 : 6,
      fragLoadingRetryDelay: 500,
      maxStarvationDelay: stats.connectionQuality === 'poor' ? 6 : 4,
      maxLoadingDelay: stats.connectionQuality === 'poor' ? 6 : 4,
    };
  }, [config, stats.connectionQuality]);

  // Cleanup
  useEffect(() => {
    return () => {
      detach();
    };
  }, [detach]);

  // Monitoramento inicial de conexão
  useEffect(() => {
    const quality = detectConnectionQuality();
    updateConfig(quality);
    
    // Escuta mudanças na conexão
    // @ts-ignore
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      const handleConnectionChange = () => {
        const newQuality = detectConnectionQuality();
        if (newQuality !== stats.connectionQuality) {
          updateConfig(newQuality);
        }
      };
      
      connection.addEventListener('change', handleConnectionChange);
      return () => connection.removeEventListener('change', handleConnectionChange);
    }
  }, [detectConnectionQuality, stats.connectionQuality, updateConfig]);

  return {
    config,
    stats,
    getHlsConfig,
    attachHls,
    attachVideo,
    detach,
    recordStall,
    forceQuality: updateConfig,
  };
}

export default useAdaptiveBuffer;
