/**
 * ============================================================================
 * Universal IPTV Player - Production Grade
 * ============================================================================
 * 
 * Player universal compatível com:
 * - Web browsers (Chrome, Firefox, Safari, Edge)
 * - Smart TVs (Samsung Tizen, LG webOS)
 * - Android TV / Fire Stick
 * - Mobile WebView (Android/iOS)
 * 
 * Features:
 * - HLS nativo (Safari, TVs) + fallback hls.js
 * - MPEG-TS direto via mpegts.js (Xtream Codes live)
 * - Controle remoto completo (setas, OK, Back)
 * - Autoplay seguro
 * - Recovery automático de erros
 * - Zero memory leaks
 * 
 * @version 3.0.0
 * @author IPTV Link
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import mpegts from "mpegts.js";

// =============================================================================
// TYPES
// =============================================================================
interface UniversalPlayerProps {
  /** URL do stream HLS (já com proxy se necessário) */
  url: string;
  /** Título do canal/conteúdo */
  title?: string;
  /** Logo do canal */
  logo?: string;
  /** Autoplay ao carregar */
  autoplay?: boolean;
  /** Iniciar mutado */
  muted?: boolean;
  /** Callback de erro fatal */
  onError?: (error: PlayerError) => void;
  /** Callback quando player está pronto */
  onReady?: () => void;
  /** Callback para voltar/fechar */
  onBack?: () => void;
}

interface PlayerError {
  type: string;
  details: string;
  fatal: boolean;
}

// =============================================================================
// MPEGTS.JS CONFIGURATION - OPTIMIZED FOR ZERO BUFFERING
// =============================================================================
const MPEGTS_CONFIG: mpegts.Config = {
  enableWorker: true,
  enableStashBuffer: true,
  stashInitialSize: 128 * 1024, // Reduzido para início mais rápido
  liveBufferLatencyChasing: true,
  liveBufferLatencyMaxLatency: 1.5, // Max 1.5s de latência
  liveBufferLatencyMinRemain: 0.3, // Min 0.3s no buffer
  liveSync: true,
  autoCleanupSourceBuffer: true,
  autoCleanupMaxBackwardDuration: 20, // Reduzido
  autoCleanupMinBackwardDuration: 5, // Reduzido
  fixAudioTimestampGap: true, // Corrigir gaps de áudio
  accurateSeek: false, // Desabilitar para performance
  seekType: 'range',
  lazyLoad: false, // Carregar imediatamente
  lazyLoadMaxDuration: 0,
  deferLoadAfterSourceOpen: false, // Não adiar carregamento
};

// =============================================================================
// HLS.JS CONFIGURATION - OPTIMIZED FOR ZERO BUFFERING
// =============================================================================
const HLS_CONFIG: Partial<Hls['config']> = {
  // Worker e performance
  enableWorker: true,
  lowLatencyMode: false, // Desabilitado para estabilidade
  
  // Buffer settings - ZERO BUFFERING: mínimo necessário
  maxBufferLength: 15, // Reduzido para início instantâneo
  maxMaxBufferLength: 45, // Limite máximo menor
  maxBufferSize: 20 * 1000 * 1000, // 20MB
  maxBufferHole: 0.5, // Mais tolerante a holes
  backBufferLength: 10, // Buffer traseiro mínimo
  
  // ABR (Adaptive Bitrate) - ULTRA FAST START
  startLevel: 0, // Começar com qualidade mais baixa
  abrEwmaDefaultEstimate: 2000000, // 2Mbps - estimativa otimista
  abrBandWidthFactor: 0.9, // Muito agressivo no ABR
  abrBandWidthUpFactor: 0.7, // Subir qualidade bem rápido
  abrMaxWithRealBitrate: true, // Usar bitrate real para ABR
  
  // Timeouts - ULTRA FAST: menores para falhar/retry rápido
  manifestLoadingTimeOut: 8000,
  levelLoadingTimeOut: 8000,
  fragLoadingTimeOut: 15000,
  
  // Retries - agressivo para IPTV instável
  manifestLoadingMaxRetry: 6,
  levelLoadingMaxRetry: 6,
  fragLoadingMaxRetry: 8,
  
  // Retry delays - mínimos para recuperação instantânea
  manifestLoadingRetryDelay: 200,
  levelLoadingRetryDelay: 200,
  fragLoadingRetryDelay: 200,
  
  // FAST START: Progressive loading
  progressive: true,
  
  // FAST START: Prefetch
  startFragPrefetch: true,
  
  // Smooth switching
  testBandwidth: true,
  
  // Caputo para evitar stalls
  capLevelToPlayerSize: true,
  capLevelOnFPSDrop: true,
  fpsDroppedMonitoringPeriod: 3000,
  fpsDroppedMonitoringThreshold: 0.1,
};

// =============================================================================
// COMPONENT
// =============================================================================
export default function UniversalPlayer({
  url,
  title,
  logo,
  autoplay = true,
  muted = false,
  onError,
  onReady,
  onBack,
}: UniversalPlayerProps) {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryAttempts = useRef(0);

  // State
  const [showUI, setShowUI] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // ===========================================================================
  // UI AUTO-HIDE
  // ===========================================================================
  const resetUITimer = useCallback(() => {
    setShowUI(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => setShowUI(false), 4000);
  }, []);

  // ===========================================================================
  // PLAYBACK CONTROLS
  // ===========================================================================
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(console.warn);
    } else {
      video.pause();
    }
    resetUITimer();
  }, [resetUITimer]);

  const seek = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;
    
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    resetUITimer();
  }, [resetUITimer]);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  }, [onBack]);

  // ===========================================================================
  // KEYBOARD / REMOTE CONTROL
  // ===========================================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Previne scroll da página
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        // Seek
        case 'ArrowLeft':
          seek(-10);
          break;
        case 'ArrowRight':
          seek(10);
          break;
        
        // Volume (future) - por enquanto só mostra UI
        case 'ArrowUp':
        case 'ArrowDown':
          resetUITimer();
          break;
        
        // Play/Pause
        case 'Enter':
        case ' ':
          togglePlayPause();
          break;
        
        // Back/Exit
        case 'Escape':
        case 'Backspace':
          handleBack();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [seek, togglePlayPause, handleBack, resetUITimer]);

  // ===========================================================================
  // VIDEO EVENT LISTENERS
  // ===========================================================================
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlers = {
      play: () => setIsPlaying(true),
      pause: () => setIsPlaying(false),
      waiting: () => setIsLoading(true),
      canplay: () => setIsLoading(false),
      playing: () => {
        setIsLoading(false);
        setIsPlaying(true);
        setHasError(false);
        recoveryAttempts.current = 0;
      },
      error: () => {
        console.error('[Player] Video element error');
        setIsLoading(false);
      },
    };

    // Attach handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      video.addEventListener(event, handler);
    });

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        video.removeEventListener(event, handler);
      });
    };
  }, []);

  // ===========================================================================
  // PLAYBACK INITIALIZATION
  // ===========================================================================
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) {
      console.warn('[Player] Missing video element or URL');
      return;
    }

    // Extract original URL from proxy if needed
    const getOriginalUrl = (proxyUrl: string): string => {
      try {
        const urlObj = new URL(proxyUrl);
        const encodedUrl = urlObj.searchParams.get('url');
        if (encodedUrl) {
          return decodeURIComponent(encodedUrl);
        }
      } catch {
        // Not a valid URL or no proxy param
      }
      return proxyUrl;
    };

    const originalUrl = getOriginalUrl(url);
    const originalLower = originalUrl.toLowerCase();
    
    // Detect content type from ORIGINAL URL (not proxy URL)
    // ONLY actual video files with extensions are native playable
    // Xtream Codes live streams (no extension) need HLS processing
    const hasVideoExtension = /\.(mp4|mkv|avi|webm|mov|m4v)(\?|$)/i.test(originalUrl);
    const isMovieOrSeries = (originalLower.includes('/movie/') || originalLower.includes('/series/')) && hasVideoExtension;
    const isNativePlayable = hasVideoExtension || isMovieOrSeries;
    
    // Check if it's an HLS stream
    const isHlsStream = originalLower.includes('.m3u8') || originalLower.includes('.m3u');
    
    // Xtream Codes live pattern (no extension) - these output MPEG-TS directly
    const isXtreamLive = /\/(?:live\/)?[^\/]+\/[^\/]+\/\d+$/.test(originalUrl) && !isHlsStream && !hasVideoExtension;

    console.log('[Player] ==========================================');
    console.log('[Player] Initializing playback');
    console.log('[Player] Proxy URL:', url.substring(0, 60) + '...');
    console.log('[Player] Original URL:', originalUrl.substring(0, 60) + '...');
    console.log('[Player] Has video extension:', hasVideoExtension);
    console.log('[Player] Is Xtream live (MPEG-TS):', isXtreamLive);
    console.log('[Player] Is HLS stream:', isHlsStream);
    console.log('[Player] Native playable:', isNativePlayable);
    console.log('[Player] HLS.js supported:', Hls.isSupported());
    console.log('[Player] MPEGTS.js supported:', mpegts.isSupported());
    
    // Reset state
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    recoveryAttempts.current = 0;

    // Cleanup previous instances
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      mpegtsRef.current.pause();
      mpegtsRef.current.unload();
      mpegtsRef.current.detachMediaElement();
      mpegtsRef.current.destroy();
      mpegtsRef.current = null;
    }

    // ==== NATIVE VIDEO (MP4, WebM, MKV) ====
    if (isNativePlayable) {
      console.log('[Player] Using native video playback');
      
      video.src = url;
      video.load();
      
      const onLoadedMetadata = () => {
        console.log('[Player] Native video ready');
        setIsLoading(false);
        onReady?.();
        
        if (autoplay) {
          video.play().catch(err => {
            console.warn('[Player] Autoplay blocked:', err.message);
          });
        }
      };

      const onVideoError = () => {
        console.error('[Player] Native video error');
        setIsLoading(false);
        setHasError(true);
        setErrorMessage('Erro ao carregar vídeo');
      };
      
      const onCanPlay = () => {
        setIsLoading(false);
      };

      video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      video.addEventListener('error', onVideoError, { once: true });
      video.addEventListener('canplay', onCanPlay, { once: true });

      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('error', onVideoError);
        video.removeEventListener('canplay', onCanPlay);
        video.src = '';
      };
    }

    // ==== XTREAM CODES LIVE (MPEG-TS via mpegts.js) ====
    if (isXtreamLive && mpegts.isSupported()) {
      console.log('[Player] Using mpegts.js for Xtream live stream');
      
      const player = mpegts.createPlayer({
        type: 'mpegts',
        isLive: true,
        url: url, // Use proxy URL directly
      }, MPEGTS_CONFIG);
      
      mpegtsRef.current = player;
      
      player.attachMediaElement(video);
      player.load();
      
      player.on(mpegts.Events.ERROR, (errorType, errorDetail, errorInfo) => {
        console.error('[Player] MPEGTS error:', errorType, errorDetail, errorInfo);
        
        recoveryAttempts.current++;
        if (recoveryAttempts.current > 3) {
          setHasError(true);
          setErrorMessage('Falha ao carregar stream ao vivo');
          onError?.({ type: String(errorType), details: String(errorDetail), fatal: true });
        } else {
          console.log('[Player] Attempting MPEGTS recovery...');
          player.unload();
          setTimeout(() => {
            player.load();
            if (autoplay) player.play();
          }, 1000);
        }
      });
      
      player.on(mpegts.Events.LOADING_COMPLETE, () => {
        console.log('[Player] MPEGTS loading complete');
      });
      
      player.on(mpegts.Events.METADATA_ARRIVED, () => {
        console.log('[Player] MPEGTS metadata arrived');
        setIsLoading(false);
        onReady?.();
        
        if (autoplay) {
          video.play().catch(err => {
            console.warn('[Player] Autoplay blocked:', err.message);
          });
        }
      });
      
      return () => {
        if (mpegtsRef.current) {
          mpegtsRef.current.pause();
          mpegtsRef.current.unload();
          mpegtsRef.current.detachMediaElement();
          mpegtsRef.current.destroy();
          mpegtsRef.current = null;
        }
      };
    }

    // ==== NATIVE HLS (Safari, iOS, Smart TVs) ====
    const supportsNativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== '';
    
    if (supportsNativeHls && !Hls.isSupported()) {
      console.log('[Player] Using native HLS (Safari/iOS/TV)');
      
      video.src = url;
      
      const onLoadedMetadata = () => {
        console.log('[Player] Native HLS ready');
        setIsLoading(false);
        onReady?.();
        
        if (autoplay) {
          video.play().catch(err => {
            console.warn('[Player] Autoplay blocked:', err.message);
          });
        }
      };

      const onError = () => {
        console.error('[Player] Native HLS error');
        setIsLoading(false);
        setHasError(true);
        setErrorMessage('Erro ao carregar stream');
      };

      video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      video.addEventListener('error', onError, { once: true });

      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('error', onError);
        video.src = '';
      };
    }

    // ==== HLS.JS (Chrome, Firefox, Edge, Android) ====
    if (!Hls.isSupported()) {
      // Fallback to native if HLS.js not supported but native is
      if (supportsNativeHls) {
        console.log('[Player] Falling back to native HLS');
        video.src = url;
        video.load();
        if (autoplay) video.play().catch(console.warn);
        return;
      }
      
      console.error('[Player] HLS not supported on this browser');
      setIsLoading(false);
      setHasError(true);
      setErrorMessage('Navegador não suporta HLS');
      return;
    }

    console.log('[Player] Using hls.js engine');
    
    const hls = new Hls({
      ...HLS_CONFIG,
      debug: false,
      xhrSetup: (xhr: XMLHttpRequest, loadingUrl: string) => {
        console.log('[Player] Loading:', loadingUrl.substring(0, 60) + '...');
      },
    });
    hlsRef.current = hls;

    // Load source
    hls.loadSource(url);
    hls.attachMedia(video);
    
    console.log('[Player] HLS source attached');

    // Manifest parsed = ready to play
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log('[Player] Manifest parsed');
      setIsLoading(false);
      onReady?.();

      if (autoplay) {
        video.play().catch(err => {
          console.warn('[Player] Autoplay blocked:', err.message);
        });
      }
    });

    // Fragment loading - track progress
    hls.on(Hls.Events.FRAG_LOADED, () => {
      // Reset loading state when fragments are coming in
      if (isLoading) {
        setIsLoading(false);
      }
    });

    // Level switching for quality adaptation
    hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
      console.log('[Player] Quality switched to level:', data.level);
    });

    // Error handling with aggressive recovery
    hls.on(Hls.Events.ERROR, (_, data) => {
      console.error('[Player] HLS error:', data.type, data.details, 'fatal:', data.fatal);

      // Handle buffer stall specifically
      if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
        console.warn('[Player] Buffer stall detected, recovering...');
        if (hls.liveSyncPosition) {
          video.currentTime = hls.liveSyncPosition;
        }
        hls.startLoad();
        return;
      }

      if (!data.fatal) {
        // Non-fatal: hls.js handles internally, but help with buffer issues
        if (data.details === Hls.ErrorDetails.BUFFER_APPEND_ERROR) {
          console.warn('[Player] Buffer append error, flushing...');
          hls.recoverMediaError();
        }
        return;
      }

      // Fatal error: attempt recovery
      recoveryAttempts.current++;
      
      if (recoveryAttempts.current > 5) { // Increased from 3 to 5
        console.error('[Player] Max recovery attempts reached');
        setHasError(true);
        setErrorMessage('Falha ao carregar stream');
        onError?.(data);
        return;
      }

      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          console.log('[Player] Network error, attempting recovery...');
          setTimeout(() => hls.startLoad(), 500); // Small delay before retry
          break;
          
        case Hls.ErrorTypes.MEDIA_ERROR:
          console.log('[Player] Media error, attempting recovery...');
          hls.recoverMediaError();
          // If still issues, try swap audio codec
          setTimeout(() => {
            if (recoveryAttempts.current > 2) {
              hls.swapAudioCodec();
              hls.recoverMediaError();
            }
          }, 1000);
          break;
          
        default:
          console.error('[Player] Unrecoverable error');
          setHasError(true);
          setErrorMessage('Erro no stream');
          onError?.(data);
          break;
      }
    });

    // Cleanup
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [url, autoplay, onReady, onError]);

  // Cleanup timer on unmount
  useEffect(() => {
    resetUITimer();
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [resetUITimer]);

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-black z-50 overflow-hidden select-none"
      onMouseMove={resetUITimer}
      onClick={togglePlayPause}
      onTouchStart={resetUITimer}
    >
      {/* VIDEO */}
      <video
        ref={videoRef}
        muted={muted}
        playsInline
        controls={false}
        className="w-full h-full object-contain bg-black"
      />

      {/* LOADING */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white/70 text-sm">Carregando...</span>
          </div>
        </div>
      )}

      {/* ERROR */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-4 text-center p-6">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-white text-lg">{errorMessage || 'Erro ao carregar'}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleBack();
              }}
              className="px-6 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div
        className={`absolute top-0 left-0 right-0 transition-opacity duration-300 ${
          showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center gap-4">
          {/* Back button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleBack();
            }}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Logo */}
          {logo && (
            <img 
              src={logo} 
              alt="" 
              className="w-8 h-8 rounded object-contain bg-white/10"
              onError={(e) => e.currentTarget.style.display = 'none'}
            />
          )}

          {/* Title */}
          {title && (
            <h1 className="text-white text-lg font-medium truncate flex-1">
              {title}
            </h1>
          )}
        </div>
      </div>

      {/* BOTTOM CONTROLS */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${
          showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-16 pb-6 px-6">
          <div className="flex items-center justify-between">
            {/* Play/Pause */}
            <div className="flex items-center gap-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
                className="w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <span className="text-white/60 text-sm hidden sm:block">
                {isPlaying ? 'Reproduzindo' : 'Pausado'}
              </span>
            </div>

            {/* Seek hints */}
            <div className="flex items-center gap-6 text-white/50 text-sm hidden md:flex">
              <span>◀ -10s</span>
              <span>+10s ▶</span>
            </div>

            {/* Exit hint */}
            <span className="text-white/40 text-xs hidden lg:block">
              ESC para sair
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
