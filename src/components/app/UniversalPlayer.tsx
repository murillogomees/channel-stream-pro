import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";

interface UniversalPlayerProps {
  url: string;
  autoplay?: boolean;
  muted?: boolean;
  title?: string;
  onError?: (data: any) => void;
  onReady?: () => void;
  onBack?: () => void;
}

/**
 * Universal IPTV Player
 * - Suporte total HLS (.m3u8)
 * - Web, Smart TVs (Samsung Tizen, LG webOS), WebView, Fire Stick
 * - Controles remotos (setas, OK, Back)
 * - Overlay clean
 * - Autoplay seguro
 * - Zero memory leaks
 */
export default function UniversalPlayer({
  url,
  autoplay = true,
  muted = false,
  title,
  onError,
  onReady,
  onBack,
}: UniversalPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [showUI, setShowUI] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- OCULTAR UI DEPOIS DE 3s ---
  const resetUITimer = useCallback(() => {
    setShowUI(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => setShowUI(false), 3000);
  }, []);

  // --- TOGGLE PLAY/PAUSE ---
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    resetUITimer();
  }, [resetUITimer]);

  // --- SEEK ---
  const seek = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime + seconds);
    resetUITimer();
  }, [resetUITimer]);

  // --- HANDLE BACK ---
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  }, [onBack]);

  // --- CONTROLES DO REMOTO E TECLADO ---
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          seek(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(10);
          break;
        case "Enter":
        case " ": // Space
          e.preventDefault();
          togglePlayPause();
          break;
        case "Backspace":
        case "Escape":
          e.preventDefault();
          handleBack();
          break;
        case "ArrowUp":
        case "ArrowDown":
          e.preventDefault();
          resetUITimer();
          break;
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [seek, togglePlayPause, handleBack, resetUITimer]);

  // --- VIDEO EVENT LISTENERS ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onPlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onPlaying);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onPlaying);
    };
  }, []);

  // --- INICIALIZAÇÃO DO HLS ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    setIsLoading(true);

    // Cleanup anterior
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const setupNative = () => {
      console.log("[UniversalPlayer] Using native HLS support");
      video.src = url;
      
      const onLoadedMetadata = () => {
        setIsLoading(false);
        onReady?.();
        if (autoplay) {
          video.play().catch((err) => {
            console.warn("[UniversalPlayer] Autoplay blocked:", err);
          });
        }
      };

      const onError = (e: Event) => {
        console.error("[UniversalPlayer] Native error:", e);
        setIsLoading(false);
      };

      video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
      video.addEventListener("error", onError, { once: true });
    };

    const setupHlsJs = () => {
      console.log("[UniversalPlayer] Using hls.js");
      
      const hls = new Hls({
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        startLevel: -1,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 6,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log("[UniversalPlayer] Manifest parsed");
        setIsLoading(false);
        onReady?.();
        if (autoplay) {
          video.play().catch((err) => {
            console.warn("[UniversalPlayer] Autoplay blocked:", err);
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error("[UniversalPlayer] HLS error:", data);
        
        if (data.fatal) {
          setIsLoading(false);
          
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("[UniversalPlayer] Attempting recovery...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("[UniversalPlayer] Attempting media recovery...");
              hls.recoverMediaError();
              break;
            default:
              onError?.(data);
              break;
          }
        }
      });

      hlsRef.current = hls;
    };

    // HLS NATIVO (Safari, LG webOS, Samsung Tizen)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      setupNative();
    } else if (Hls.isSupported()) {
      setupHlsJs();
    } else {
      console.error("[UniversalPlayer] HLS not supported");
      setIsLoading(false);
    }

    resetUITimer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [url, autoplay, onReady, onError, resetUITimer]);

  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-black z-50 overflow-hidden"
      onMouseMove={resetUITimer}
      onClick={togglePlayPause}
      onTouchStart={resetUITimer}
    >
      {/* VIDEO ELEMENT */}
      <video
        ref={videoRef}
        muted={muted}
        playsInline
        controls={false}
        className="w-full h-full object-contain bg-black"
      />

      {/* LOADING SPINNER */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* OVERLAY DE CONTROLES */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${
          showUI ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Gradient Background */}
        <div className="bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-20 pb-6 px-6">
          {/* Title */}
          {title && (
            <h2 className="text-white text-xl font-semibold mb-4 truncate">
              {title}
            </h2>
          )}

          {/* Controls Row */}
          <div className="flex items-center justify-between text-white">
            {/* Play State */}
            <div className="flex items-center gap-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
                className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <span className="text-sm text-white/70">
                {isPlaying ? "Reproduzindo" : "Pausado"}
              </span>
            </div>

            {/* Seek Instructions */}
            <div className="flex items-center gap-6 text-sm text-white/70">
              <span>◀ -10s</span>
              <span>+10s ▶</span>
            </div>

            {/* Back Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleBack();
              }}
              className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm transition-colors"
            >
              Voltar (ESC)
            </button>
          </div>
        </div>
      </div>

      {/* TOP BAR - Back button always visible briefly */}
      <div
        className={`absolute top-0 left-0 right-0 transition-opacity duration-300 ${
          showUI ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-gradient-to-b from-black/80 to-transparent p-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleBack();
            }}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
