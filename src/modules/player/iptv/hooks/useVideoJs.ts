/**
 * Video.js + HLS.js React Hook
 * Optimized for fastest startup and HTTP support via proxy
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import type { IptvPlayerEvent, IptvPlayerOptions, PlayerMetrics } from '../types';
import { streamOptimizer } from '../services/streamOptimizer';

import 'video.js/dist/video-js.css';

interface UseVideoJsOptions {
  src?: string;
  options?: IptvPlayerOptions;
  hlsConfig?: Record<string, any>; // Platform-specific HLS config (Smart TV)
  onEvent?: (evt: IptvPlayerEvent, data?: any) => void;
}

interface UseVideoJsReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  player: Player | null;
  isReady: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  error: string | null;
  metrics: PlayerMetrics;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  setSource: (url: string) => void;
}

// Detect if native HLS is supported (Safari, iOS)
function supportsNativeHls(): boolean {
  const video = document.createElement('video');
  return Boolean(
    video.canPlayType('application/vnd.apple.mpegurl') ||
    video.canPlayType('audio/mpegurl')
  );
}

function isSmartTV(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('tizen') || ua.includes('webos') || ua.includes('hbbtv') || 
         ua.includes('smart-tv') || ua.includes('netcast') || ua.includes('viera') ||
         ua.includes('firetv') || ua.includes('roku');
}

export function useVideoJs({
  src,
  options = {},
  hlsConfig: customHlsConfig,
  onEvent,
}: UseVideoJsOptions): UseVideoJsReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const pendingSourceRef = useRef<string | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PlayerMetrics>({
    bufferLength: 0,
    droppedFrames: 0,
    currentBitrate: 0,
    latency: 0,
    loadTime: 0,
    cdnSwitches: 0,
    errors: 0,
  });

  const loadStartTime = useRef<number>(0);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (mpegtsRef.current) {
      mpegtsRef.current.destroy();
      mpegtsRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }
  }, []);

  // Initialize player
  useEffect(() => {
    if (!videoRef.current) return;
    
    // Defer initialization to ensure element is in DOM (fixes Video.js warning)
    const initTimeout = setTimeout(() => {
      if (!videoRef.current || !document.body.contains(videoRef.current)) return;

      loadStartTime.current = Date.now();

    // Video.js options
    const vjsOptions: any = {
      controls: false, // We use custom controls
      autoplay: options.autoplay ?? true,
      muted: options.muted ?? true,
      preload: 'auto',
      fluid: true,
      responsive: true,
      playsinline: true,
      poster: options.poster,
      html5: {
        vhs: {
          overrideNative: !supportsNativeHls(),
          enableLowInitialPlaylist: options.preferLowLatency ?? true,
          smoothQualityChange: true,
          bandwidth: 4194304, // Start with 4Mbps estimate
        },
        nativeAudioTracks: supportsNativeHls(),
        nativeVideoTracks: supportsNativeHls(),
      },
      liveui: true,
      liveTracker: {
        trackingThreshold: 0,
        liveTolerance: 15,
      },
    };

    const player = videojs(videoRef.current, vjsOptions);
    playerRef.current = player;

    // Event handlers
    player.on('ready', () => {
      console.log('[Video.js] Ready');
      setIsReady(true);
      setMetrics(prev => ({
        ...prev,
        loadTime: Date.now() - loadStartTime.current,
      }));
      onEvent?.('ready');
    });

    player.on('play', () => {
      setIsPlaying(true);
      setIsBuffering(false);
      onEvent?.('play');
    });

    player.on('pause', () => {
      setIsPlaying(false);
      onEvent?.('pause');
    });

    player.on('waiting', () => {
      setIsBuffering(true);
      onEvent?.('buffering');
    });

    player.on('playing', () => {
      setIsBuffering(false);
    });

    player.on('ended', () => {
      setIsPlaying(false);
      onEvent?.('ended');
    });

    player.on('error', () => {
      const err = player.error();
      console.error('[Video.js] Error:', err);
      setError(err?.message || 'Playback error');
      setMetrics(prev => ({ ...prev, errors: prev.errors + 1 }));
      onEvent?.('error', { code: err?.code, message: err?.message });
    });

    player.on('timeupdate', () => {
      onEvent?.('timeupdate', {
        currentTime: player.currentTime(),
        duration: player.duration(),
      });
    });

    // Update metrics periodically
    const metricsInterval = setInterval(() => {
      if (!player.paused()) {
        const tech = player.tech({ IWillNotUseThisInPlugins: true }) as any;
        const videoEl = player.el()?.querySelector('video');
        
        setMetrics(prev => ({
          ...prev,
          bufferLength: player.bufferedEnd() - player.currentTime(),
          droppedFrames: (videoEl as any)?.webkitDroppedFrameCount || 0,
          currentBitrate: tech?.vhs?.playlists?.media()?.attributes?.BANDWIDTH || 0,
        }));
      }
    }, 2000);

    // Store interval ref for cleanup
    (window as any).__videoMetricsInterval = metricsInterval;
    }, 0); // Close setTimeout - deferred initialization

    return () => {
      clearTimeout(initTimeout);
      if ((window as any).__videoMetricsInterval) {
        clearInterval((window as any).__videoMetricsInterval);
        delete (window as any).__videoMetricsInterval;
      }
      cleanup();
    };
  }, [options.autoplay, options.muted, options.poster, options.preferLowLatency, onEvent, cleanup]);

  // Set source with protocol detection and HTTP proxy support
  const setSource = useCallback((url: string, fallbackUrl?: string) => {
    // If player not ready, store for later
    if (!playerRef.current) {
      console.log('[useVideoJs] Player not ready, queueing source:', url.substring(0, 60));
      pendingSourceRef.current = url;
      return;
    }
    
    setError(null);
    setIsBuffering(true);
    loadStartTime.current = Date.now();

    // Optimize URL (handle HTTP→HTTPS proxy)
    const optimized = streamOptimizer.optimize(url);
    const finalUrl = optimized.url;
    const protocol = optimized.protocol;
    // Store fallback for error recovery
    const actualFallback = fallbackUrl || optimized.fallbackUrl;
    
    console.log('[useVideoJs] Loading stream:', {
      protocol,
      source: optimized.source,
      requiresProxy: optimized.requiresProxy,
      originalUrl: url,
      finalUrl,
      hasFallback: !!actualFallback,
    });

    const videoEl = playerRef.current.el()?.querySelector('video') as HTMLVideoElement;
    if (!videoEl) return;

    // Cleanup previous instances
    if (mpegtsRef.current) {
      mpegtsRef.current.destroy();
      mpegtsRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // TS streams ONLY - use mpegts.js (ONLY if URL explicitly ends in .ts)
    // Double-check URL to avoid mpegts.js failures on non-TS content
    const isExplicitTs = finalUrl.toLowerCase().endsWith('.ts') || 
                         (finalUrl.toLowerCase().includes('stream-proxy') && url.toLowerCase().endsWith('.ts'));
    
    if (protocol === 'ts' && isExplicitTs && mpegts.isSupported()) {
      console.log('[useVideoJs] Using mpegts.js for explicit .ts URL:', finalUrl.substring(0, 80));
      
      const player = mpegts.createPlayer({
        type: 'mpegts',
        url: finalUrl,
        isLive: true,
      }, streamOptimizer.getMpegtsConfig());
      
      mpegtsRef.current = player;
      player.attachMediaElement(videoEl);
      player.load();
      
      player.on(mpegts.Events.MEDIA_INFO, () => {
        console.log('[mpegts] Media info received');
        setIsBuffering(false);
        setMetrics(prev => ({
          ...prev,
          loadTime: Date.now() - loadStartTime.current,
        }));
        onEvent?.('ready');
        
        if (options.autoplay !== false) {
          videoEl.play().catch(() => {
            videoEl.muted = true;
            videoEl.play().catch(() => {});
          });
        }
      });
      
      player.on(mpegts.Events.ERROR, (errType: string, errDetail: string) => {
        console.error('[mpegts] Error:', errType, errDetail);
        setError(`${errType}: ${errDetail}`);
        setMetrics(prev => ({ ...prev, errors: prev.errors + 1 }));
        onEvent?.('error', { type: errType, details: errDetail });
      });
      
      return;
    }

    // HLS streams - use HLS.js with optimized config (ONLY for explicit HLS URLs)
    // Don't use HLS.js for 'unknown' protocol - let native video handle it
    if (protocol === 'hls' && Hls.isSupported() && !supportsNativeHls()) {
      console.log('[useVideoJs] Using HLS.js for explicit HLS URL', customHlsConfig ? '(TV config)' : '');
      
      // Base config from optimizer
      const baseConfig = streamOptimizer.getHlsConfig(
        options.preferLowLatency ?? true,
        true // assume live
      );
      
      // Merge with platform-specific config (Smart TV, etc)
      const hlsConfig = {
        ...baseConfig,
        ...customHlsConfig, // Override with platform-specific settings
        fragLoadingMaxRetry: options.maxRetries ?? 3,
        manifestLoadingMaxRetry: options.maxRetries ?? 3,
      };
      
      const hls = new Hls(hlsConfig);

      hlsRef.current = hls;
      hls.loadSource(finalUrl);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[HLS.js] Manifest parsed, TTFF:', Date.now() - loadStartTime.current, 'ms');
        setIsBuffering(false);
        setMetrics(prev => ({
          ...prev,
          loadTime: Date.now() - loadStartTime.current,
        }));
        onEvent?.('ready');
        
        if (options.autoplay !== false) {
          videoEl.play().catch(() => {
            videoEl.muted = true;
            videoEl.play().catch(() => {});
          });
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        onEvent?.('qualitychange', { level: data.level });
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        // First fragment loaded - video should start soon
        if (isBuffering) {
          setIsBuffering(false);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('[HLS.js] Fatal error:', data.type, data.details);
          setError(data.details);
          setMetrics(prev => ({ ...prev, errors: prev.errors + 1 }));
          onEvent?.('error', { type: data.type, details: data.details });

          // Attempt recovery
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            console.log('[HLS.js] Network error, attempting recovery...');
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            console.log('[HLS.js] Media error, attempting recovery...');
            hls.recoverMediaError();
          }
        }
      });
      
      return;
    }

    // Native playback (Safari, MP4, unknown formats, etc)
    console.log('[useVideoJs] Using native playback for protocol:', protocol, 'URL:', finalUrl.substring(0, 80));
    
    // Determine correct MIME type - let browser detect for unknown
    let mimeType: string | undefined;
    if (protocol === 'hls') {
      mimeType = 'application/x-mpegURL';
    } else if (protocol === 'dash') {
      mimeType = 'application/dash+xml';
    } else if (protocol === 'mp4') {
      mimeType = 'video/mp4';
    }
    // For 'unknown', don't specify MIME type - let browser auto-detect
    
    const sourceConfig: any = { src: finalUrl };
    if (mimeType) {
      sourceConfig.type = mimeType;
    }
    
    playerRef.current.src(sourceConfig);
    
    // For native, track ready state
    videoEl.addEventListener('canplay', () => {
      setIsBuffering(false);
      setMetrics(prev => ({
        ...prev,
        loadTime: Date.now() - loadStartTime.current,
      }));
      onEvent?.('ready');
    }, { once: true });
    
    // Handle errors with fallback for HTTPS upgrade failures
    if (actualFallback) {
      const errorHandler = () => {
        console.log('[useVideoJs] Primary URL failed, trying fallback:', actualFallback.substring(0, 60));
        videoEl.removeEventListener('error', errorHandler);
        
        // Try fallback URL (proxy for VOD)
        playerRef.current?.src({
          src: actualFallback,
          type: mimeType,
        });
      };
      videoEl.addEventListener('error', errorHandler, { once: true });
    }
    
  }, [options.autoplay, options.maxRetries, options.preferLowLatency, customHlsConfig, onEvent, isBuffering]);

  // Update source when src changes
  useEffect(() => {
    if (src && playerRef.current) {
      setSource(src);
    }
  }, [src, setSource]);

  // Apply pending source when player becomes ready
  useEffect(() => {
    if (isReady && pendingSourceRef.current && playerRef.current) {
      console.log('[Video.js] Applying pending source:', pendingSourceRef.current.substring(0, 60));
      const pendingUrl = pendingSourceRef.current;
      pendingSourceRef.current = null;
      setSource(pendingUrl);
    }
  }, [isReady, setSource]);

  // Control methods
  const play = useCallback(() => {
    playerRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, []);

  const seek = useCallback((time: number) => {
    playerRef.current?.currentTime(time);
  }, []);

  const setVolume = useCallback((volume: number) => {
    playerRef.current?.volume(Math.max(0, Math.min(1, volume)));
  }, []);

  const toggleMute = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.muted(!playerRef.current.muted());
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (playerRef.current) {
      if (playerRef.current.isFullscreen()) {
        playerRef.current.exitFullscreen();
      } else {
        playerRef.current.requestFullscreen();
      }
    }
  }, []);

  return {
    videoRef,
    player: playerRef.current,
    isReady,
    isPlaying,
    isBuffering,
    error,
    metrics,
    play,
    pause,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen,
    setSource,
  };
}
