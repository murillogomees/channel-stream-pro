/**
 * VideoPlayer - Simplificado para Confiabilidade
 * Prioriza startup rápido sobre otimizações complexas
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, RefreshCw, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  url: string;
  title?: string;
  logo?: string;
  autoPlay?: boolean;
  className?: string;
  onError?: (msg: string) => void;
  onBack?: () => void;
  onReady?: () => void;
}

// HLS Config MÍNIMO para startup rápido
const HLS_CONFIG: Partial<Hls['config']> = {
  enableWorker: true,
  lowLatencyMode: false,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  maxBufferSize: 30 * 1000 * 1000,
  fragLoadingTimeOut: 20000,
  fragLoadingMaxRetry: 3,
  manifestLoadingTimeOut: 10000,
  manifestLoadingMaxRetry: 3,
  levelLoadingTimeOut: 10000,
  levelLoadingMaxRetry: 3,
};

function isHlsUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('.m3u8') || lower.includes('.m3u');
}

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

  // Mostrar overlay
  const showOverlay = useCallback(() => {
    setOverlayVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOverlayVisible(false), 4000);
  }, []);

  // Inicializar player
  const initPlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    console.log('[VideoPlayer] Iniciando:', url.substring(0, 80));
    setLoading(true);
    setError(null);

    // Limpar instância anterior
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const tryPlay = () => {
      if (autoPlay) {
        video.play().catch(() => {
          video.muted = true;
          setMuted(true);
          video.play().catch(() => {});
        });
      }
    };

    // HLS via HLS.js
    if (Hls.isSupported() && isHlsUrl(url)) {
      console.log('[VideoPlayer] Usando HLS.js');
      const hls = new Hls(HLS_CONFIG);
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[VideoPlayer] Manifest parsed');
        setLoading(false);
        retryCount.current = 0;
        onReady?.();
        tryPlay();
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('[VideoPlayer] HLS Error:', data.type, data.details, data.fatal);
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (retryCount.current < 3) {
                retryCount.current++;
                console.log(`[VideoPlayer] Retry ${retryCount.current}/3`);
                hls.startLoad();
              } else {
                setError('Erro de conexão. Tente novamente.');
                setLoading(false);
                onError?.('Network error');
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('[VideoPlayer] Recuperando erro de mídia');
              hls.recoverMediaError();
              break;
            default:
              setError('Erro ao carregar stream');
              setLoading(false);
              onError?.('Fatal error');
          }
        }
      });

      hls.on(Hls.Events.FRAG_LOADED, () => setLoading(false));
      
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && isHlsUrl(url)) {
      // Safari nativo
      console.log('[VideoPlayer] HLS nativo (Safari)');
      video.src = url;
      
      video.addEventListener('loadedmetadata', () => {
        setLoading(false);
        onReady?.();
        tryPlay();
      }, { once: true });

      video.addEventListener('error', () => {
        setError('Erro ao carregar stream');
        setLoading(false);
        onError?.('Native HLS error');
      }, { once: true });
      
    } else {
      // Playback direto (MP4, TS, etc)
      console.log('[VideoPlayer] Playback direto');
      video.src = url;
      
      video.addEventListener('loadeddata', () => {
        console.log('[VideoPlayer] Video carregado');
        setLoading(false);
        onReady?.();
        tryPlay();
      }, { once: true });

      video.addEventListener('canplay', () => setLoading(false), { once: true });

      video.addEventListener('error', () => {
        if (retryCount.current < 2) {
          retryCount.current++;
          setTimeout(() => {
            video.src = url;
            video.load();
          }, 1000);
        } else {
          setError('Vídeo indisponível');
          setLoading(false);
          onError?.('Direct playback error');
        }
      }, { once: true });

      video.load();
    }
  }, [url, autoPlay, onError, onReady]);

  // Inicializar
  useEffect(() => {
    initPlayer();
    showOverlay();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [initPlayer, showOverlay]);

  // Event handlers do vídeo
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
    };
  }, []);

  // Controles
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    showOverlay();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    showOverlay();
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreen(false);
      } else {
        await container.requestFullscreen();
        setFullscreen(true);
      }
    } catch (e) {
      console.warn('[VideoPlayer] Fullscreen error:', e);
    }
    showOverlay();
  };

  const handleRetry = () => {
    retryCount.current = 0;
    initPlayer();
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full bg-black overflow-hidden",
        className
      )}
      onMouseMove={showOverlay}
      onTouchStart={showOverlay}
      onClick={togglePlay}
    >
      {/* Video */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        muted={muted}
        autoPlay={autoPlay}
      />

      {/* Loading */}
      {loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white/80 text-sm">Carregando...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
          <p className="text-white mb-4">{error}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRetry();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* Overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity duration-300 z-10",
          overlayVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {logo && (
            <img src={logo} alt="" className="w-10 h-10 rounded object-contain bg-black/50" />
          )}
          {title && (
            <h2 className="text-white font-medium text-lg truncate">{title}</h2>
          )}
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-center gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="p-3 rounded-full bg-white/20 hover:bg-white/30 text-white"
          >
            {paused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className="p-3 rounded-full bg-white/20 hover:bg-white/30 text-white"
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="p-3 rounded-full bg-white/20 hover:bg-white/30 text-white"
          >
            {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
