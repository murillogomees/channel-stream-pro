/**
 * ============================================================================
 * VideoPlayer - Player IPTV Universal
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
 * 
 * @version 2.0.0
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, RefreshCw, ArrowLeft 
} from "lucide-react";
import { useRemoteInput } from "@/modules/player/hooks/useRemoteInput";
import { cn } from "@/lib/utils";

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
  /** Autoplay ao carregar */
  autoPlay?: boolean;
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
// HLS CONFIG
// =============================================================================

const HLS_CONFIG: Partial<Hls['config']> = {
  enableWorker: true,
  lowLatencyMode: false,
  backBufferLength: 60,
  maxBufferLength: 60,
  maxMaxBufferLength: 120,
  maxBufferSize: 60 * 1000 * 1000,
  maxBufferHole: 0.5,
  startFragPrefetch: true,
  testBandwidth: true,
  progressive: true,
  fragLoadingTimeOut: 20000,
  fragLoadingMaxRetry: 6,
  fragLoadingRetryDelay: 1000,
  manifestLoadingTimeOut: 15000,
  manifestLoadingMaxRetry: 4,
  levelLoadingTimeOut: 15000,
  levelLoadingMaxRetry: 4,
};

// =============================================================================
// COMPONENT
// =============================================================================

export function VideoPlayer({
  url,
  title = "",
  logo,
  autoPlay = true,
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

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // HLS.js for most browsers
    if (Hls.isSupported()) {
      const hls = new Hls(HLS_CONFIG);
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[VideoPlayer] Manifest parsed');
        setLoading(false);
        retryCount.current = 0;
        onReady?.();
        
        if (autoPlay) {
          video.play().catch((e) => {
            console.warn('[VideoPlayer] Autoplay blocked:', e);
            // Try muted autoplay
            video.muted = true;
            setMuted(true);
            video.play().catch(() => {});
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('[VideoPlayer] HLS Error:', data);
        
        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (retryCount.current < maxRetries) {
            retryCount.current++;
            console.log(`[VideoPlayer] Network error, retry ${retryCount.current}/${maxRetries}`);
            setTimeout(() => hls.startLoad(), 1000 * retryCount.current);
          } else {
            setError('Erro de conexão. Verifique sua internet.');
            onError?.('Network error');
          }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          console.log('[VideoPlayer] Media error, recovering...');
          hls.recoverMediaError();
        } else {
          setError('Stream indisponível');
          onError?.('Stream unavailable');
        }
      });

      // Additional events
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
        onError?.('Native playback error');
      });
    } else {
      setError('Navegador não suporta HLS');
      onError?.('HLS not supported');
    }
  }, [url, autoPlay, onError, onReady]);

  // Initialize on mount and URL change
  useEffect(() => {
    initPlayer();
    showOverlay();

    return () => {
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
  // Video Event Handlers
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setPaused(false);
    const handlePause = () => setPaused(true);
    const handleWaiting = () => setLoading(true);
    const handlePlaying = () => setLoading(false);

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
  }, []);

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
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        muted={muted}
        onClick={togglePlay}
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

          {/* Live indicator */}
          <div className="flex justify-center mt-4">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              AO VIVO
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
