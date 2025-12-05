/**
 * Video.js + HLS.js React Hook
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import Hls from 'hls.js';
import type { IptvPlayerEvent, IptvPlayerOptions, PlayerMetrics } from '../types';

import 'video.js/dist/video-js.css';

interface UseVideoJsOptions {
  src?: string;
  options?: IptvPlayerOptions;
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
         ua.includes('smart-tv') || ua.includes('netcast') || ua.includes('viera');
}

export function useVideoJs({
  src,
  options = {},
  onEvent,
}: UseVideoJsOptions): UseVideoJsReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  
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

    return () => {
      clearInterval(metricsInterval);
      cleanup();
    };
  }, [options.autoplay, options.muted, options.poster, options.preferLowLatency, onEvent, cleanup]);

  // Set source
  const setSource = useCallback((url: string) => {
    if (!playerRef.current) return;
    
    setError(null);
    setIsBuffering(true);
    loadStartTime.current = Date.now();

    const isHls = url.includes('.m3u8') || url.includes('.m3u');

    // Use HLS.js for better control if available
    if (isHls && Hls.isSupported() && !supportsNativeHls()) {
      // Cleanup existing HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const videoEl = playerRef.current.el()?.querySelector('video');
      if (!videoEl) return;

      const hls = new Hls({
        enableWorker: !isSmartTV(),
        lowLatencyMode: options.preferLowLatency ?? true,
        maxBufferLength: 15,
        maxMaxBufferLength: 30,
        maxBufferSize: 30 * 1000 * 1000,
        startLevel: 0,
        startFragPrefetch: true,
        testBandwidth: false,
        fragLoadingTimeOut: 10000,
        manifestLoadingTimeOut: 8000,
        fragLoadingMaxRetry: options.maxRetries ?? 3,
        manifestLoadingMaxRetry: options.maxRetries ?? 3,
        progressive: true,
        backBufferLength: 10,
      });

      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(videoEl as HTMLMediaElement);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[HLS.js] Manifest parsed');
        setIsBuffering(false);
        setMetrics(prev => ({
          ...prev,
          loadTime: Date.now() - loadStartTime.current,
        }));
        
        if (options.autoplay !== false) {
          videoEl.play().catch(() => {
            (videoEl as HTMLVideoElement).muted = true;
            videoEl.play().catch(() => {});
          });
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        onEvent?.('qualitychange', { level: data.level });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('[HLS.js] Fatal error:', data.type, data.details);
          setError(data.details);
          setMetrics(prev => ({ ...prev, errors: prev.errors + 1 }));
          onEvent?.('error', { type: data.type, details: data.details });

          // Attempt recovery
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        }
      });
    } else {
      // Use native playback
      playerRef.current.src({
        src: url,
        type: isHls ? 'application/x-mpegURL' : undefined,
      });
    }
  }, [options.autoplay, options.maxRetries, options.preferLowLatency, onEvent]);

  // Update source when src changes
  useEffect(() => {
    if (src && playerRef.current) {
      setSource(src);
    }
  }, [src, setSource]);

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
