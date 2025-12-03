/**
 * useOptimizedPlayer - Hook Unificado de Player Otimizado
 * 
 * Combina todas as otimizações de performance:
 * - Web Worker Preloading
 * - Adaptive Buffer
 * - Fast Startup
 * - Service Worker Cache
 */

import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import Hls from 'hls.js';
import { useWorkerPreloader } from './useWorkerPreloader';
import { useAdaptiveBuffer } from './useAdaptiveBuffer';
import { useFastStartup } from './useFastStartup';

interface Channel {
  id: string;
  name: string;
  stream_url: string;
}

interface UseOptimizedPlayerOptions {
  channels?: Channel[];
  currentChannelId?: string;
  isLive?: boolean;
  enablePreload?: boolean;
}

interface PlaybackStats {
  startupTime: number;
  timeToFirstFrame: number;
  bufferHealth: number;
  qualityLevel: number;
  stallCount: number;
  preloadedChannels: number;
  cacheHits: number;
}

export function useOptimizedPlayer(options: UseOptimizedPlayerOptions = {}) {
  const {
    channels = [],
    currentChannelId,
    isLive = true,
    enablePreload = true,
  } = options;

  // Sub-hooks
  const workerPreloader = useWorkerPreloader({ enabled: enablePreload });
  const adaptiveBuffer = useAdaptiveBuffer({ isLive });
  const fastStartup = useFastStartup();
  
  // Refs
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startTimeRef = useRef<number>(0);
  
  // Stats
  const [stats, setStats] = useState<PlaybackStats>({
    startupTime: 0,
    timeToFirstFrame: 0,
    bufferHealth: 100,
    qualityLevel: -1,
    stallCount: 0,
    preloadedChannels: 0,
    cacheHits: 0,
  });

  // Preload canais adjacentes quando canal muda
  useEffect(() => {
    if (!enablePreload || !currentChannelId || channels.length === 0) return;
    
    const currentIndex = channels.findIndex(c => c.id === currentChannelId);
    if (currentIndex === -1) return;
    
    // Preload próximos 3 canais
    const toPreload: Array<{ url: string; priority: 'high' | 'medium' | 'low' }> = [];
    
    // Canal anterior e próximo (alta prioridade)
    if (currentIndex > 0) {
      toPreload.push({ url: channels[currentIndex - 1].stream_url, priority: 'high' });
    }
    if (currentIndex < channels.length - 1) {
      toPreload.push({ url: channels[currentIndex + 1].stream_url, priority: 'high' });
    }
    
    // +2 e -2 (média prioridade)
    if (currentIndex > 1) {
      toPreload.push({ url: channels[currentIndex - 2].stream_url, priority: 'medium' });
    }
    if (currentIndex < channels.length - 2) {
      toPreload.push({ url: channels[currentIndex + 2].stream_url, priority: 'medium' });
    }
    
    // +3 (baixa prioridade)
    if (currentIndex < channels.length - 3) {
      toPreload.push({ url: channels[currentIndex + 3].stream_url, priority: 'low' });
    }
    
    workerPreloader.preloadBatch(toPreload);
    
    setStats(prev => ({
      ...prev,
      preloadedChannels: workerPreloader.stats.manifestCacheSize,
    }));
  }, [currentChannelId, channels, enablePreload, workerPreloader]);

  // Configuração HLS otimizada combinada
  const getOptimizedHlsConfig = useCallback((): Partial<Hls['config']> => {
    const fastConfig = fastStartup.getOptimalHlsConfig();
    const bufferConfig = adaptiveBuffer.getHlsConfig;
    
    // Merge das configurações priorizando fast startup para inicio
    return {
      ...bufferConfig,
      ...fastConfig,
      
      // Overrides específicos para performance máxima
      enableWorker: true,
      startFragPrefetch: true,
      progressive: true,
      
      // Delay mínimo para startup
      maxStarvationDelay: 2,
      maxLoadingDelay: 2,
      
      // Retry robusto
      fragLoadingMaxRetry: 8,
      fragLoadingRetryDelay: 500,
      fragLoadingMaxRetryTimeout: 64000,
      manifestLoadingMaxRetry: 4,
      levelLoadingMaxRetry: 4,
      
      // Holes/gaps tolerance
      maxBufferHole: 0.5,
      nudgeOffset: 0.1,
      nudgeMaxRetry: 5,
      
      // Latência otimizada para live
      ...(isLive ? {
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        lowLatencyMode: false,
        liveDurationInfinity: true,
      } : {}),
    };
  }, [fastStartup, adaptiveBuffer.getHlsConfig, isLive]);

  // Inicializa player com URL
  const initializePlayer = useCallback(async (
    video: HTMLVideoElement,
    url: string
  ): Promise<Hls | null> => {
    startTimeRef.current = performance.now();
    videoRef.current = video;
    
    // Cleanup anterior
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    // Verifica se URL está no cache do worker
    const cachedManifest = workerPreloader.getCachedManifest(url);
    if (cachedManifest) {
      setStats(prev => ({ ...prev, cacheHits: prev.cacheHits + 1 }));
      console.log('[OptimizedPlayer] Cache HIT - startup rápido');
    }
    
    // Preflight check
    const preflight = await fastStartup.preflightCheck(url);
    console.log('[OptimizedPlayer] Preflight:', preflight);
    
    if (!Hls.isSupported()) {
      // Fallback para native HLS (Safari)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.load();
        return null;
      }
      throw new Error('HLS não suportado');
    }
    
    // Cria HLS com config otimizada
    const config = getOptimizedHlsConfig();
    
    // Ajusta startLevel baseado em preflight
    if (preflight.bestLevel >= 0) {
      config.startLevel = preflight.bestLevel;
    }
    
    const hls = new Hls(config);
    hlsRef.current = hls;
    
    // Anexa ao buffer adaptativo
    adaptiveBuffer.attachHls(hls);
    adaptiveBuffer.attachVideo(video);
    
    // Event listeners para stats
    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      const startupTime = performance.now() - startTimeRef.current;
      setStats(prev => ({ ...prev, startupTime }));
      console.log(`[OptimizedPlayer] Manifest parsed em ${startupTime.toFixed(0)}ms`);
    });
    
    hls.on(Hls.Events.FRAG_LOADED, () => {
      if (stats.timeToFirstFrame === 0) {
        const ttff = performance.now() - startTimeRef.current;
        setStats(prev => ({ ...prev, timeToFirstFrame: ttff }));
        console.log(`[OptimizedPlayer] First frame em ${ttff.toFixed(0)}ms`);
      }
    });
    
    hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
      setStats(prev => ({ ...prev, qualityLevel: data.level }));
    });
    
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
        setStats(prev => ({ ...prev, stallCount: prev.stallCount + 1 }));
      }
    });
    
    // Carrega source
    hls.loadSource(url);
    hls.attachMedia(video);
    
    return hls;
  }, [adaptiveBuffer, fastStartup, getOptimizedHlsConfig, stats.timeToFirstFrame, workerPreloader]);

  // Preload manual de URL
  const preloadUrl = useCallback(async (url: string) => {
    return workerPreloader.preloadManifest(url, 'high');
  }, [workerPreloader]);

  // Verifica se URL está preloaded
  const isPreloaded = useCallback((url: string): boolean => {
    return workerPreloader.isCached(url);
  }, [workerPreloader]);

  // Destroy player
  const destroy = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    adaptiveBuffer.detach();
    workerPreloader.clearCache();
  }, [adaptiveBuffer, workerPreloader]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroy();
    };
  }, [destroy]);

  // Atualiza stats de buffer periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        bufferHealth: adaptiveBuffer.stats.avgBufferHealth,
        preloadedChannels: workerPreloader.stats.manifestCacheSize,
      }));
    }, 2000);
    
    return () => clearInterval(interval);
  }, [adaptiveBuffer.stats.avgBufferHealth, workerPreloader.stats.manifestCacheSize]);

  return {
    // Initialization
    initializePlayer,
    destroy,
    
    // Preloading
    preloadUrl,
    isPreloaded,
    preloadBatch: workerPreloader.preloadBatch,
    
    // Config
    getOptimizedHlsConfig,
    
    // Stats
    stats,
    bufferStats: adaptiveBuffer.stats,
    deviceCapabilities: fastStartup.deviceCapabilities,
    codecSupport: fastStartup.codecSupport,
    
    // Refs
    hlsRef,
    videoRef,
    
    // Status
    isWorkerReady: workerPreloader.isReady,
    isAnalyzing: fastStartup.isAnalyzing,
  };
}

export default useOptimizedPlayer;
