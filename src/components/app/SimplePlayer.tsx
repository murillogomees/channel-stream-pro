/**
 * SimplePlayer - Player Otimizado de Streaming
 * 
 * FAST STARTUP: Inicia reprodução imediatamente, verifica R2 em background.
 * Usa HLS.js agressivo para streams HLS e playback nativo para VOD.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  ArrowLeft, RefreshCw, Loader2, AlertCircle, Clock, Wifi, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { unlockForFullscreen, lockToPortrait } from '@/hooks/useGlobalOrientationLock';

interface SimplePlayerProps {
  url: string;
  title?: string;
  logo?: string;
  category?: string;
  channelId?: string;
  autoplay?: boolean;
  onBack?: () => void;
  onError?: (error: string) => void;
  onReady?: () => void;
  onRequestDownload?: () => void;
  className?: string;
}

// Detecta tipo de conteúdo
function getContentType(url: string): 'hls' | 'vod' | 'direct' {
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8') || lower.includes('.m3u')) return 'hls';
  if (lower.includes('.mp4') || lower.includes('.mkv') || 
      lower.includes('.avi') || lower.includes('.webm') ||
      lower.includes('/movie/') || lower.includes('/series/')) return 'vod';
  return 'direct';
}

function isHttpUrl(url: string): boolean {
  return url.toLowerCase().startsWith('http://');
}

function isSecurePage(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

const SUPABASE_URL = 'https://sdvyxdghxqmntyoweqbd.supabase.co';
const R2_CDN_URL = 'https://pub-iptvlink.r2.dev';

// Verifica R2 - PRIORITÁRIO para VOD (timeout curto)
async function checkR2Availability(channelId: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
    
    const { data } = await (supabase as any)
      .from('r2_storage_objects')
      .select('r2_key, status')
      .eq('channel_id', channelId)
      .eq('status', 'completed')
      .abortSignal(controller.signal)
      .maybeSingle();
    
    clearTimeout(timeoutId);
    if (!data) return null;
    return `${R2_CDN_URL}/${data.r2_key}`;
  } catch {
    return null;
  }
}

// Verifica m3u_channels para r2_url (fallback)
async function checkChannelR2Url(channelId: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const { data } = await (supabase as any)
      .from('m3u_channels')
      .select('r2_url, r2_uploaded')
      .eq('id', channelId)
      .eq('r2_uploaded', true)
      .abortSignal(controller.signal)
      .maybeSingle();
    
    clearTimeout(timeoutId);
    return data?.r2_url || null;
  } catch {
    return null;
  }
}

function getProxiedUrl(url: string): string {
  if (isSecurePage() && isHttpUrl(url)) {
    return `${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function isSamsungTV(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('tizen') || ua.includes('samsung') || ua.includes('smart-tv');
}

function isSmartTV(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('tizen') || ua.includes('webos') || ua.includes('hbbtv') || 
         ua.includes('smart-tv') || ua.includes('netcast') || ua.includes('viera');
}

// Configuração HLS AGRESSIVA para startup rápido
function getHlsConfig(): Partial<Hls['config']> {
  const isTv = isSmartTV();
  const isSamsung = isSamsungTV();
  const enableWorker = !isSamsung && !isTv;
  
  return {
    enableWorker,
    lowLatencyMode: true, // Ativado para startup rápido
    // Buffer mínimo para iniciar rápido
    maxBufferLength: 10,
    maxMaxBufferLength: 30,
    maxBufferSize: 30 * 1000 * 1000,
    maxBufferHole: 0.5,
    // Startup agressivo
    startLevel: 0, // Começa na qualidade mais baixa
    startFragPrefetch: true,
    testBandwidth: false, // Não testa - começa direto
    // Timeouts curtos
    fragLoadingTimeOut: 10000,
    manifestLoadingTimeOut: 8000,
    levelLoadingTimeOut: 8000,
    // Retries rápidos
    fragLoadingMaxRetry: 2,
    manifestLoadingMaxRetry: 2,
    levelLoadingMaxRetry: 2,
    fragLoadingRetryDelay: 500,
    manifestLoadingRetryDelay: 500,
    // Progressive para início imediato
    progressive: true,
    backBufferLength: 10,
  };
}

export default function SimplePlayer({
  url,
  title = 'Canal',
  logo,
  category,
  channelId,
  autoplay = true,
  onBack,
  onError,
  onReady,
  onRequestDownload,
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
  const [errorType, setErrorType] = useState<'network' | 'timeout' | 'format' | 'generic'>('generic');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Conectando...');
  
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout>>();
  const retryCount = useRef(0);
  const maxRetries = 2;
  const hasNetworkError = useRef(false);
  const loadStartTime = useRef<number>(0);
  const isHttpVod = useRef(false);

  // Cleanup HLS
  const cleanupHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  // Initialize player - R2 PRIORITY para VOD
  const initPlayer = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !url) {
      setError('URL não fornecida');
      setIsLoading(false);
      return;
    }

    if (hasNetworkError.current) return;

    setIsLoading(true);
    setError(null);
    setErrorType('generic');
    cleanupHls();

    const contentType = getContentType(url);
    const isHttpContent = isHttpUrl(url);
    isHttpVod.current = (contentType === 'vod' || contentType === 'direct') && isHttpContent;
    loadStartTime.current = Date.now();

    let finalUrl = url;
    
    // PRIORIDADE R2: Para VOD HTTP, verifica R2 PRIMEIRO (bloqueante, mas com timeout curto)
    if (isHttpVod.current && channelId) {
      setLoadingMessage('Verificando CDN...');
      console.log('[SimplePlayer] Verificando R2 para VOD...');
      
      // Verifica R2 em paralelo (r2_storage_objects + m3u_channels)
      const [r2StorageUrl, channelR2Url] = await Promise.all([
        checkR2Availability(channelId),
        checkChannelR2Url(channelId)
      ]);
      
      const r2Url = r2StorageUrl || channelR2Url;
      
      if (r2Url) {
        console.log('[SimplePlayer] R2 disponível! Usando CDN direto');
        finalUrl = r2Url;
        isHttpVod.current = false; // Não é mais HTTP problemático
        setLoadingMessage('Conectando ao CDN...');
      } else {
        console.log('[SimplePlayer] R2 não disponível, usando proxy');
        finalUrl = getProxiedUrl(url);
        setLoadingMessage('Streaming via proxy (pode demorar)...');
      }
    } else if (isHttpContent && contentType === 'hls') {
      // HLS HTTP: usa proxy
      finalUrl = getProxiedUrl(url);
      setLoadingMessage('Conectando ao stream...');
    } else {
      // HTTPS ou Live: usa direto
      finalUrl = url;
      setLoadingMessage('Conectando...');
    }
    
    console.log('[SimplePlayer] Iniciando:', finalUrl.substring(0, 80));

    // VOD ou conteúdo direto - usa playback nativo
    if (contentType === 'vod' || contentType === 'direct') {
      console.log('[SimplePlayer] Usando playback nativo');
      setLoadingMessage('Carregando vídeo...');
      video.src = finalUrl;
      
      const handleLoaded = () => {
        console.log('[SimplePlayer] Carregado com sucesso');
        setIsLoading(false);
        setLoadingMessage('Conectando...');
        retryCount.current = 0;
        hasNetworkError.current = false;
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
        const loadTime = Date.now() - loadStartTime.current;
        console.error('[SimplePlayer] Erro:', err?.code, err?.message, `após ${loadTime}ms`);
        
        // Detecta timeout (se demorou mais de 2 minutos e é HTTP VOD via proxy)
        const isTimeout = loadTime > 120000 && isHttpVod.current;
        
        if (isTimeout) {
          hasNetworkError.current = true;
          setErrorType('timeout');
          setError('Arquivo muito grande para streaming direto');
          setIsLoading(false);
          onError?.('Timeout - arquivo grande');
          return;
        }
        
        // MEDIA_ERR_NETWORK (2) ou MEDIA_ERR_SRC_NOT_SUPPORTED (4)
        if (err?.code === 2 || err?.code === 4) {
          hasNetworkError.current = true;
          
          // Se é HTTP VOD, provavelmente é timeout do proxy
          if (isHttpVod.current && loadTime > 30000) {
            setErrorType('timeout');
            setError('Servidor demorou muito para responder');
          } else {
            setErrorType(err.code === 2 ? 'network' : 'format');
            setError(err.code === 2 
              ? 'Servidor de stream indisponível'
              : 'Formato não suportado');
          }
          setIsLoading(false);
          onError?.(err.code === 2 ? 'Network error' : 'Format error');
          return;
        }
        
        if (retryCount.current < maxRetries && !hasNetworkError.current) {
          retryCount.current++;
          setLoadingMessage(`Tentativa ${retryCount.current + 1}...`);
          console.log(`[SimplePlayer] Tentativa ${retryCount.current}/${maxRetries}`);
          setTimeout(() => {
            video.src = '';
            video.src = finalUrl;
            video.load();
          }, 2000 * retryCount.current);
        } else {
          hasNetworkError.current = true;
          setErrorType('network');
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
      const hls = new Hls(getHlsConfig());
      hlsRef.current = hls;

      hls.loadSource(finalUrl);
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
      video.src = finalUrl;
      
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
  }, [url, channelId, autoplay, onError, onReady, cleanupHls]);

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

    // Handle fullscreen change (including ESC key or system back)
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (!isFs) {
        lockToPortrait(); // Return to portrait when exiting fullscreen
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
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
        await unlockForFullscreen(); // Landscape no fullscreen
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        await lockToPortrait(); // Volta para portrait
        setIsFullscreen(false);
      }
    } catch (e) {
      console.warn('[SimplePlayer] Fullscreen error:', e);
    }
  };

  const handleRetry = () => {
    retryCount.current = 0;
    hasNetworkError.current = false; // Reseta flag de erro
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
            <span>{loadingMessage}</span>
          </div>
          <Wifi className="w-6 h-6 text-white/50 mt-4 animate-pulse" />
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white px-6">
          {errorType === 'timeout' ? (
            <Clock className="w-16 h-16 text-yellow-500 mb-4" />
          ) : (
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          )}
          
          <p className="text-lg mb-2 text-center">{error}</p>
          
          {/* Mensagem adicional para timeout de VOD HTTP */}
          {errorType === 'timeout' && (
            <p className="text-sm text-white/70 mb-4 text-center max-w-xs">
              Este arquivo é muito grande para streaming via proxy.
              Solicite o download para assistir em qualidade total.
            </p>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <button
              onClick={handleRetry}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
            >
              <RefreshCw className="w-5 h-5" />
              Tentar novamente
            </button>
            
            {/* Botão de solicitar download para erros de timeout */}
            {errorType === 'timeout' && onRequestDownload && (
              <button
                onClick={onRequestDownload}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
              >
                <Download className="w-5 h-5" />
                Solicitar Download
              </button>
            )}
          </div>
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
