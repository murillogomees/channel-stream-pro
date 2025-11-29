/**
 * ============================================================================
 * VideoPlayer - Player IPTV Universal (Netflix-Grade Performance)
 * ============================================================================
 * 
 * Player 100% funcional compatível com:
 * - TV (Samsung Tizen, LG webOS, Android TV)
 * - Mobile (iOS, Android)
 * - Desktop (Chrome, Firefox, Safari)
 * - WebView
 * 
 * Features:
 * - HLS.js + fallback nativo
 * - Navegação por controle remoto
 * - Auto-reconnect inteligente
 * - Overlay elegante com auto-hide
 * - Muted-on-start para autoplay seguro
 * - Analytics de performance
 * - Configuração otimizada por dispositivo
 * 
 * @version 3.0.0
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, RefreshCw, ArrowLeft 
} from "lucide-react";
import { useRemoteInput } from "@/modules/player/hooks/useRemoteInput";
import { cn } from "@/lib/utils";
import { useStreamAnalytics } from "@/hooks/useStreamAnalytics";
import { streamOptimizer, detectStreamType } from "@/services/streamOptimizer";
import { useABR } from "@/hooks/useABR";
import { QualitySelector } from "./QualitySelector";
import { QualityBadge } from "./QualityBadge";
import { useVisibilityOptimization } from "@/hooks/useVisibilityOptimization";
import { usePlayerErrorRecovery } from "@/hooks/usePlayerErrorRecovery";
import { useAdvancedHlsConfig } from "@/hooks/useAdvancedHlsConfig";
import { onPlayerOpen, onPlayerClose } from "@/services/downloadPriorityService";

// =============================================================================
// TYPES
// =============================================================================

interface VideoPlayerProps {
  /** URL do stream HLS */
  url: string;
  /** Título do canal/conteúdo */
  title?: string;
  /** Logo do canal */
  logo?: string;
  /** Channel ID for analytics */
  channelId?: string;
  /** User ID for analytics */
  userId?: string;
  /** Autoplay ao carregar */
  autoPlay?: boolean;
  /** Enable ABR quality selector */
  enableABR?: boolean;
  /** Show quality stats */
  showQualityStats?: boolean;
  /** Classes CSS adicionais */
  className?: string;
  /** Callback de erro */
  onError?: (msg: string) => void;
  /** Callback ao voltar */
  onBack?: () => void;
  /** Callback quando pronto */
  onReady?: () => void;
}

// =============================================================================
// HLS CONFIG - Device-optimized
// =============================================================================

function getHlsConfig(): Partial<Hls['config']> {
  const preset = streamOptimizer.getHlsPresetForDevice();
  
  return {
    enableWorker: true,
    lowLatencyMode: preset.config.lowLatencyMode,
    backBufferLength: preset.config.backBufferLength,
    maxBufferLength: preset.config.maxBufferLength,
    maxMaxBufferLength: preset.config.maxMaxBufferLength,
    maxBufferSize: preset.config.maxBufferSize,
    maxBufferHole: preset.config.maxBufferHole,
    startFragPrefetch: preset.config.startFragPrefetch,
    testBandwidth: true,
    progressive: true,
    fragLoadingTimeOut: 20000,
    fragLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 1000,
    manifestLoadingTimeOut: 15000,
    manifestLoadingMaxRetry: 4,
    levelLoadingTimeOut: 15000,
    levelLoadingMaxRetry: 4,
    // ABR config for smoother quality transitions
    abrEwmaFastLive: 3.0,
    abrEwmaSlowLive: 9.0,
    abrEwmaFastVoD: 3.0,
    abrEwmaSlowVoD: 9.0,
    abrBandWidthFactor: 0.95,
    abrBandWidthUpFactor: 0.7,
  };
}

// =============================================================================
// STREAM TYPE DETECTION
// =============================================================================

function extractOriginalUrl(url: string): string {
  if (url.includes('stream-proxy') && url.includes('url=')) {
    try {
      const urlObj = new URL(url);
      const originalUrl = urlObj.searchParams.get('url');
      if (originalUrl) return decodeURIComponent(originalUrl);
    } catch {
      // Fall through
    }
  }
  return url;
}

function isHlsUrl(url: string): boolean {
  const checkUrl = extractOriginalUrl(url).toLowerCase();
  return checkUrl.includes('.m3u8') || checkUrl.includes('.m3u');
}

function isDirectVideoUrl(url: string): boolean {
  const checkUrl = extractOriginalUrl(url).toLowerCase();
  
  if (checkUrl.includes('.mp4') || checkUrl.includes('.mkv') || 
      checkUrl.includes('.avi') || checkUrl.includes('.ts') ||
      checkUrl.includes('.webm')) {
    return true;
  }
  
  // Proxy URL without HLS extension = direct stream
  if (url.includes('stream-proxy')) {
    return !isHlsUrl(url);
  }
  
  const xtreamPattern = /\/(?:live\/)?[^\/]+\/[^\/]+\/\d+$/;
  if (xtreamPattern.test(checkUrl)) {
    return true;
  }
  
  if (/\/\d+$/.test(checkUrl) && !checkUrl.includes('.m3u')) {
    return true;
  }
  
  return false;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function VideoPlayer({
  url,
  title = "",
  logo,
  channelId,
  userId,
  autoPlay = true,
  enableABR = true,
  showQualityStats = false,
  className,
  onError,
  onBack,
  onReady,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 3;
  const startupTimeRef = useRef<number>(0);

  // Detect if VOD content (enables ABR UI)
  const isVOD = detectStreamType(url) === 'vod' || url.includes('/movie/') || url.includes('/series/');

  // Analytics tracking
  const analytics = useStreamAnalytics(channelId, userId);

  // Advanced HLS config based on device/network
  const { getConfig: getAdvancedHlsConfig, videoProps } = useAdvancedHlsConfig({
    streamType: isVOD ? 'vod' : 'live',
  });

  // Visibility optimization - reduces quality when tab hidden
  useVisibilityOptimization(videoRef, hlsRef, {
    pauseWhenHidden: isVOD, // Only pause VOD, not live
    reduceQualityWhenHidden: true,
    stopLoadWhenHidden: false,
  });

  // Advanced error recovery with exponential backoff
  const errorRecovery = usePlayerErrorRecovery({
    maxNetworkRetries: 6,
    maxMediaRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    onFatalError: (error) => {
      setError('Stream indisponível. Tente outro canal.');
      setLoading(false);
      analytics.recordError(error.details, error.type);
      onError?.(error.details);
    },
    onFallback: () => {
      // Could implement fallback URL logic here
      console.log('[VideoPlayer] Fallback triggered');
    },
  });

  // ABR Hook
  const abr = useABR({
    onQualityChange: (level) => {
      if (!level.isAuto) {
        analytics.recordQualityChange(level.bitrate);
      }
    },
  });

  // ---------------------------------------------------------------------------
  // Overlay Control
  // ---------------------------------------------------------------------------

  const showOverlay = useCallback(() => {
    setOverlayVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOverlayVisible(false), 3500);
  }, []);

  // ---------------------------------------------------------------------------
  // Player Initialization
  // ---------------------------------------------------------------------------

  const initPlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    setLoading(true);
    setError(null);
    startupTimeRef.current = Date.now();

    // Start analytics session
    analytics.startSession();

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = isHlsUrl(url);
    const isDirect = isDirectVideoUrl(url);
    
    console.log(`[VideoPlayer] URL: ${url.substring(0, 60)}... isHLS: ${isHls}, isDirect: ${isDirect}`);

    // DIRECT VIDEO STREAM (MP4, TS, MKV, Xtream live)
    if (isDirect && !isHls) {
      console.log('[VideoPlayer] Using direct video playback');
      video.src = url;
      
      const onLoadedData = () => {
        const startupMs = Date.now() - startupTimeRef.current;
        console.log('[VideoPlayer] Direct stream loaded in', startupMs, 'ms');
        setLoading(false);
        retryCount.current = 0;
        analytics.recordStartup(startupMs);
        onReady?.();
        
        if (autoPlay) {
          video.play().catch((e) => {
            console.warn('[VideoPlayer] Autoplay blocked:', e);
            video.muted = true;
            setMuted(true);
            video.play().catch(() => {});
          });
        }
      };
      
      const onVideoError = () => {
        const mediaError = video.error;
        console.error('[VideoPlayer] Direct stream error:', mediaError?.code, mediaError?.message);
        analytics.recordError(String(mediaError?.code || 'UNKNOWN'), mediaError?.message || 'Direct stream error');
        
        if (retryCount.current < maxRetries) {
          retryCount.current++;
          console.log(`[VideoPlayer] Retry ${retryCount.current}/${maxRetries}`);
          setTimeout(() => {
            video.src = '';
            video.src = url;
            video.load();
          }, 1000 * retryCount.current);
        } else {
          setError('Stream indisponível. Tente outro canal.');
          setLoading(false);
          onError?.('Direct stream error');
        }
      };
      
      const onCanPlay = () => {
        setLoading(false);
      };
      
      video.addEventListener('loadeddata', onLoadedData, { once: true });
      video.addEventListener('error', onVideoError, { once: true });
      video.addEventListener('canplay', onCanPlay);
      
      video.load();
      return;
    }

    // HLS.js for HLS streams
    if (Hls.isSupported() && isHls) {
      console.log('[VideoPlayer] Using HLS.js with advanced optimized config');
      const hlsConfig = getAdvancedHlsConfig();
      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      // Attach ABR service
      if (enableABR) {
        abr.attach(hls);
      }

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const startupMs = Date.now() - startupTimeRef.current;
        console.log('[VideoPlayer] Manifest parsed in', startupMs, 'ms, levels:', data.levels.length);
        setLoading(false);
        errorRecovery.resetStats(); // Reset error stats on successful load
        analytics.recordStartup(startupMs);
        onReady?.();
        
        if (autoPlay) {
          video.play().catch((e) => {
            console.warn('[VideoPlayer] Autoplay blocked:', e);
            video.muted = true;
            setMuted(true);
            video.play().catch(() => {});
          });
        }
      });

      // Track quality changes
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        const level = hls.levels[data.level];
        if (level) {
          analytics.recordQualityChange(level.bitrate);
          console.log('[VideoPlayer] Quality:', level.height + 'p', level.bitrate / 1000, 'kbps');
        }
      });

      // Advanced error handling with exponential backoff
      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('[VideoPlayer] HLS Error:', data.type, data.details, 'Fatal:', data.fatal);
        
        // Use advanced error recovery
        const recovered = errorRecovery.handleHlsError(hls, {
          type: data.type,
          details: data.details,
          fatal: data.fatal,
          response: data.response as { code: number } | undefined,
        });

        if (!recovered && data.fatal) {
          // Error recovery failed, already handled by onFatalError callback
          console.log('[VideoPlayer] Error recovery failed');
        }
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        setLoading(false);
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari, iOS, some Smart TVs)
      console.log('[VideoPlayer] Using native HLS');
      video.src = url;
      
      video.addEventListener('loadedmetadata', () => {
        setLoading(false);
        onReady?.();
        
        if (autoPlay) {
          video.play().catch(() => {
            video.muted = true;
            setMuted(true);
            video.play().catch(() => {});
          });
        }
      });

      video.addEventListener('error', () => {
        setError('Erro ao carregar stream');
        setLoading(false);
        onError?.('Native playback error');
      });
    } else {
      // Fallback: try direct playback
      console.log('[VideoPlayer] Fallback: direct playback');
      video.src = url;
      video.load();
      
      video.addEventListener('loadeddata', () => {
        setLoading(false);
        onReady?.();
        if (autoPlay) video.play().catch(() => {});
      }, { once: true });
      
      video.addEventListener('error', () => {
        setError('Formato não suportado');
        setLoading(false);
        onError?.('Format not supported');
      }, { once: true });
    }
  }, [url, autoPlay, onError, onReady]);

  // Initialize on mount and URL change
  useEffect(() => {
    initPlayer();
    showOverlay();

    return () => {
      // End analytics session
      analytics.endSession();
      
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, [initPlayer]);

  // ---------------------------------------------------------------------------
  // Download Priority Management - Pause downloads when player opens
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Pausar downloads quando player abre
    onPlayerOpen();
    
    return () => {
      // Retomar downloads quando player fecha
      onPlayerClose();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Video Event Handlers
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setPaused(false);
    const handlePause = () => setPaused(true);
    const handleWaiting = () => {
      setLoading(true);
      analytics.recordBufferStart();
    };
    const handlePlaying = () => {
      setLoading(false);
      analytics.recordBufferEnd();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [analytics]);

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    showOverlay();
  }, [showOverlay]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    showOverlay();
  }, [showOverlay]);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen?.();
        setFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setFullscreen(false);
      }
    } catch (e) {
      console.warn('[VideoPlayer] Fullscreen error:', e);
    }
    showOverlay();
  }, [showOverlay]);

  const reload = useCallback(() => {
    retryCount.current = 0;
    initPlayer();
    showOverlay();
  }, [initPlayer, showOverlay]);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  }, [onBack]);

  const seekRelative = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime + delta);
    showOverlay();
  }, [showOverlay]);

  // ---------------------------------------------------------------------------
  // Remote / TV Controls
  // ---------------------------------------------------------------------------

  useRemoteInput({
    onLeft: () => {
      seekRelative(-10);
      showOverlay();
    },
    onRight: () => {
      seekRelative(10);
      showOverlay();
    },
    onUp: showOverlay,
    onDown: showOverlay,
    onOk: togglePlay,
    onPlayPause: togglePlay,
    onBack: handleBack,
    onMute: toggleMute,
  });

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full bg-black overflow-hidden select-none",
        "focus:outline-none",
        className
      )}
      onMouseMove={showOverlay}
      onClick={showOverlay}
      tabIndex={0}
    >
      {/* Video element with optimized preload */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        muted={muted}
        onClick={togglePlay}
        {...videoProps}
      />

      {/* Loading spinner */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-12 h-12 text-primary animate-spin" />
            <span className="text-muted-foreground text-sm">Carregando...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-destructive" />
            </div>
            <p className="text-foreground font-medium">{error}</p>
            <button
              onClick={reload}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors tv-button"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* Overlay */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col justify-between transition-opacity duration-300",
          "bg-gradient-to-t from-black/80 via-transparent to-black/60",
          overlayVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4">
          {onBack && (
            <button
              onClick={handleBack}
              className="p-2 rounded-full bg-background/20 hover:bg-background/40 transition-colors tv-button"
            >
              <ArrowLeft className="w-6 h-6 text-foreground" />
            </button>
          )}
          
          {logo && (
            <img
              src={logo}
              alt=""
              className="w-10 h-10 rounded object-contain bg-background/20"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
          
          {title && (
            <span className="text-foreground text-xl font-medium line-clamp-1">
              {title}
            </span>
          )}
        </div>

        {/* Center play indicator */}
        {paused && !loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-background/30 flex items-center justify-center">
              <Play className="w-10 h-10 text-foreground ml-1" />
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="p-4">
          {/* Seek hints */}
          <div className="flex justify-center gap-8 mb-4 text-muted-foreground text-sm">
            <span>◀ -10s</span>
            <span>+10s ▶</span>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-center gap-6">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors tv-button"
            >
              {paused ? <Play className="w-8 h-8 ml-0.5" /> : <Pause className="w-8 h-8" />}
            </button>

            {/* Mute */}
            <button
              onClick={toggleMute}
              className="p-2 rounded-full bg-background/20 hover:bg-background/40 transition-colors tv-button"
            >
              {muted ? <VolumeX className="w-6 h-6 text-foreground" /> : <Volume2 className="w-6 h-6 text-foreground" />}
            </button>

            {/* Reload */}
            <button
              onClick={reload}
              className="p-2 rounded-full bg-background/20 hover:bg-background/40 transition-colors tv-button"
            >
              <RefreshCw className="w-6 h-6 text-foreground" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full bg-background/20 hover:bg-background/40 transition-colors tv-button"
            >
              {fullscreen ? (
                <Minimize className="w-6 h-6 text-foreground" />
              ) : (
                <Maximize className="w-6 h-6 text-foreground" />
              )}
            </button>
          </div>

          {/* Quality selector (VOD only) or Live indicator */}
          <div className="flex justify-center mt-4">
            {enableABR && abr.isAttached && abr.levels.length > 1 ? (
              <div className="flex items-center gap-3">
                <QualitySelector
                  levels={abr.levels}
                  currentLevel={abr.currentLevel}
                  mode={abr.mode}
                  stats={showQualityStats ? abr.stats : null}
                  onSelectLevel={abr.setQuality}
                  showStats={showQualityStats}
                />
                {abr.currentLevel && !abr.currentLevel.isAuto && (
                  <QualityBadge
                    height={abr.currentLevel.height}
                    isAuto={abr.mode === 'auto'}
                    size="md"
                  />
                )}
              </div>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                AO VIVO
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
