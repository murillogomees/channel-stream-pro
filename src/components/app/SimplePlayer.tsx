/**
 * SimplePlayer - Player Simplificado de Streaming
 * 
 * Carrega conteúdo DIRETO sem proxy, CDN routing ou service workers.
 * Usa HLS.js básico para streams HLS e playback nativo para VOD.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  ArrowLeft, RefreshCw, Loader2, AlertCircle, Wifi
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimplePlayerProps {
  url: string;
  title?: string;
  logo?: string;
  category?: string;
  autoplay?: boolean;
  onBack?: () => void;
  onError?: (error: string) => void;
  onReady?: () => void;
  className?: string;
}

// Detecta tipo de conteúdo
function getContentType(url: string): 'hls' | 'vod' | 'direct' {
  const lower = url.toLowerCase();
  
  if (lower.includes('.m3u8') || lower.includes('.m3u')) {
    return 'hls';
  }
  
  if (lower.includes('.mp4') || lower.includes('.mkv') || 
      lower.includes('.avi') || lower.includes('.webm') ||
      lower.includes('/movie/') || lower.includes('/series/')) {
    return 'vod';
  }
  
  return 'direct';
}

// Verifica se é Mixed Content (HTTP em página HTTPS)
function isMixedContent(url: string): boolean {
  if (typeof window === 'undefined') return false;
  const pageIsHttps = window.location.protocol === 'https:';
  const urlIsHttp = url.toLowerCase().startsWith('http://');
  return pageIsHttps && urlIsHttp;
}

// Configuração HLS básica e otimizada
const HLS_CONFIG: Partial<Hls['config']> = {
  enableWorker: true,
  lowLatencyMode: false,
  backBufferLength: 30,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  maxBufferSize: 60 * 1000 * 1000,
  maxBufferHole: 0.5,
  startFragPrefetch: true,
  testBandwidth: true,
  progressive: true,
  fragLoadingTimeOut: 20000,
  fragLoadingMaxRetry: 4,
  manifestLoadingTimeOut: 15000,
  manifestLoadingMaxRetry: 3,
};

export default function SimplePlayer({
  url,
  title = 'Canal',
  logo,
  category,
  autoplay = true,
  onBack,
  onError,
  onReady,
  className,
}: SimplePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout>>();
  const retryCount = useRef(0);
  const maxRetries = 3;

  // Cleanup HLS
  const cleanupHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  // Initialize player
  const initPlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video || !url) {
      setError('URL não fornecida');
      setIsLoading(false);
      return;
    }

    console.log('[SimplePlayer] Iniciando:', url.substring(0, 80));
    
    // Verifica Mixed Content ANTES de tentar carregar
    if (isMixedContent(url)) {
      console.error('[SimplePlayer] Mixed Content bloqueado:', url);
      setError('Conteúdo HTTP bloqueado pelo navegador. O servidor de origem não suporta HTTPS.');
      setIsLoading(false);
      onError?.('Mixed Content blocked');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    cleanupHls();

    const contentType = getContentType(url);
    console.log('[SimplePlayer] Tipo de conteúdo:', contentType);

    // VOD ou conteúdo direto - usa playback nativo
    if (contentType === 'vod' || contentType === 'direct') {
      console.log('[SimplePlayer] Usando playback nativo');
      video.src = url;
      
      const handleLoaded = () => {
        console.log('[SimplePlayer] Carregado com sucesso');
        setIsLoading(false);
        retryCount.current = 0;
        onReady?.();
        
        if (autoplay) {
          video.play().catch(() => {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
          });
        }
      };
      
      const handleError = () => {
        const err = video.error;
        console.error('[SimplePlayer] Erro:', err?.code, err?.message);
        
        if (retryCount.current < maxRetries) {
          retryCount.current++;
          console.log(`[SimplePlayer] Tentativa ${retryCount.current}/${maxRetries}`);
          setTimeout(() => {
            video.src = '';
            video.src = url;
            video.load();
          }, 1500 * retryCount.current);
        } else {
          setError('Não foi possível carregar o conteúdo');
          setIsLoading(false);
          onError?.('Playback error');
        }
      };
      
      video.addEventListener('loadeddata', handleLoaded, { once: true });
      video.addEventListener('canplay', () => setIsLoading(false));
      video.addEventListener('error', handleError, { once: true });
      video.load();
      return;
    }

    // HLS - usa HLS.js se suportado
    if (Hls.isSupported()) {
      console.log('[SimplePlayer] Usando HLS.js');
      const hls = new Hls(HLS_CONFIG);
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[SimplePlayer] Manifest carregado');
        setIsLoading(false);
        retryCount.current = 0;
        onReady?.();
        
        if (autoplay) {
          video.play().catch(() => {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('[SimplePlayer] HLS Error:', data.type, data.details);
        
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            console.log('[SimplePlayer] Tentando recuperar erro de rede');
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            console.log('[SimplePlayer] Tentando recuperar erro de mídia');
            hls.recoverMediaError();
          } else {
            setError('Erro ao carregar stream');
            setIsLoading(false);
            onError?.('HLS fatal error');
          }
        }
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        setIsLoading(false);
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari/iOS - HLS nativo
      console.log('[SimplePlayer] Usando HLS nativo');
      video.src = url;
      
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        onReady?.();
        if (autoplay) video.play().catch(() => {});
      });

      video.addEventListener('error', () => {
        setError('Erro ao carregar stream');
        setIsLoading(false);
        onError?.('Native HLS error');
      });
    } else {
      setError('Navegador não suporta este formato');
      setIsLoading(false);
    }
  }, [url, autoplay, onError, onReady, cleanupHls]);

  // Inicializa player
  useEffect(() => {
    initPlayer();
    return () => cleanupHls();
  }, [initPlayer, cleanupHls]);

  // Event listeners do video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPaused(false);
    const handlePause = () => setIsPaused(true);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration || 0);
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => setIsLoading(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, []);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  // Controles
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.warn('[SimplePlayer] Fullscreen error:', e);
    }
  };

  const handleRetry = () => {
    retryCount.current = 0;
    initPlayer();
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full bg-black overflow-hidden',
        className
      )}
      onClick={resetControlsTimer}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        muted={isMuted}
        onClick={togglePlay}
      />

      {/* Loading Overlay */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
          {logo && (
            <img src={logo} alt="" className="w-20 h-20 object-contain mb-4 rounded-lg" />
          )}
          <div className="flex items-center gap-3 text-white">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span>Conectando...</span>
          </div>
          <Wifi className="w-6 h-6 text-white/50 mt-4 animate-pulse" />
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <p className="text-lg mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <RefreshCw className="w-5 h-5" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* Controls Overlay */}
      {showControls && !error && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
                >
                  <ArrowLeft className="w-6 h-6 text-white" />
                </button>
              )}
              <div className="flex-1">
                <h2 className="text-white font-semibold text-lg truncate">{title}</h2>
                {category && (
                  <p className="text-white/60 text-sm">{category}</p>
                )}
              </div>
            </div>
          </div>

          {/* Center Play Button */}
          {isPaused && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
              <button
                onClick={togglePlay}
                className="p-6 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur transition"
              >
                <Play className="w-12 h-12 text-white" fill="white" />
              </button>
            </div>
          )}

          {/* Bottom Bar */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">
            {/* Progress Bar (VOD only) */}
            {duration > 0 && isFinite(duration) && (
              <div className="flex items-center gap-3 mb-3">
                <span className="text-white/80 text-sm min-w-[50px]">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1 bg-white/30 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 
                    [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full 
                    [&::-webkit-slider-thumb]:bg-white"
                />
                <span className="text-white/80 text-sm min-w-[50px] text-right">
                  {formatTime(duration)}
                </span>
              </div>
            )}

            {/* Controls Row */}
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="p-2 rounded-full hover:bg-white/20 transition"
              >
                {isPaused ? (
                  <Play className="w-6 h-6 text-white" fill="white" />
                ) : (
                  <Pause className="w-6 h-6 text-white" fill="white" />
                )}
              </button>

              <button
                onClick={toggleMute}
                className="p-2 rounded-full hover:bg-white/20 transition"
              >
                {isMuted ? (
                  <VolumeX className="w-6 h-6 text-white" />
                ) : (
                  <Volume2 className="w-6 h-6 text-white" />
                )}
              </button>

              <div className="flex-1" />

              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-full hover:bg-white/20 transition"
              >
                {isFullscreen ? (
                  <Minimize className="w-6 h-6 text-white" />
                ) : (
                  <Maximize className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
