import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Volume2, VolumeX, Maximize, Minimize, AlertCircle, Play, RefreshCw, Radio, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Hls from 'hls.js';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  url: string;
  title: string;
  logo?: string;
  category?: string;
  onError?: (error: string) => void;
  onReady?: () => void;
  className?: string;
}

/**
 * VideoPlayer - Optimized for perceived instant startup
 * 
 * Features:
 * - Instant skeleton with channel branding
 * - Smooth fade transition to video
 * - Progressive loading states
 * - Aggressive HLS config for fast first frame
 */
export const VideoPlayer = memo(function VideoPlayer({ 
  url, 
  title, 
  logo, 
  category,
  onError, 
  onReady,
  className = '',
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  
  const [phase, setPhase] = useState<'skeleton' | 'buffering' | 'ready' | 'error'>('skeleton');
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [needsManualPlay, setNeedsManualPlay] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const attemptPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      video.muted = true;
      setIsMuted(true);
      await video.play();
      setNeedsManualPlay(false);
      setPhase('ready');
      console.log('[Player] Started in', Date.now() - startTimeRef.current, 'ms');
    } catch {
      setNeedsManualPlay(true);
      setPhase('ready');
    }
  }, []);

  const handleManualPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      setNeedsManualPlay(false);
    } catch {
      setPhase('error');
      setErrorMessage('Não foi possível iniciar');
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    const isHls = url.toLowerCase().includes('.m3u8') || url.toLowerCase().includes('.m3u');
    
    startTimeRef.current = Date.now();
    setPhase('skeleton');
    setLoadProgress(0);
    setNeedsManualPlay(false);
    cleanup();

    // Simula progresso visual enquanto carrega
    const progressInterval = setInterval(() => {
      setLoadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 150);

    // Transição rápida para buffering (200ms) - feedback instantâneo
    const skeletonTimer = setTimeout(() => {
      setPhase('buffering');
    }, 200);

    // Timeout de 8 segundos
    timeoutRef.current = setTimeout(() => {
      clearInterval(progressInterval);
      setPhase('error');
      setErrorMessage('Conexão lenta - tente novamente');
    }, 8000);

    // HLS Stream - config otimizado para TTFF (Time To First Frame)
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        // Fast startup config
        maxBufferLength: 10,              // Buffer menor = primeiro frame mais rápido
        maxMaxBufferLength: 30,
        maxBufferSize: 30 * 1000 * 1000,  // 30MB
        maxBufferHole: 0.5,
        
        // Aggressive loading
        manifestLoadingTimeOut: 5000,
        manifestLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 500,
        levelLoadingTimeOut: 5000,
        fragLoadingTimeOut: 8000,
        fragLoadingMaxRetry: 3,
        
        // Start with lowest quality for instant start
        startLevel: 0,                    // Começa no mais baixo
        abrEwmaDefaultEstimate: 500000,   // Assume 500kbps inicial
        abrBandWidthUpFactor: 0.7,        // Sobe qualidade gradualmente
        
        // Performance
        capLevelToPlayerSize: true,
        progressive: true,
        lowLatencyMode: false,
      });

      hlsRef.current = hls;
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        clearInterval(progressInterval);
        setLoadProgress(100);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        attemptPlay();
        onReady?.();
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        // Primeiro fragmento carregado - quase pronto
        setLoadProgress(prev => Math.max(prev, 80));
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('[Player] HLS Error:', data.type, data.details);
        
        if (data.fatal) {
          clearInterval(progressInterval);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setPhase('error');
            setErrorMessage('Stream indisponível');
            onError?.('HLS Error');
          }
        }
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      return () => {
        clearInterval(progressInterval);
        clearTimeout(skeletonTimer);
        cleanup();
      };
    }

    // Safari native HLS ou vídeo direto
    video.src = url;

    const handleCanPlay = () => {
      clearInterval(progressInterval);
      setLoadProgress(100);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      attemptPlay();
      onReady?.();
    };

    const handleError = () => {
      clearInterval(progressInterval);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setPhase('error');
      setErrorMessage('Erro ao carregar');
      onError?.('Video Error');
    };

    const handlePlaying = () => {
      setPhase('ready');
      setNeedsManualPlay(false);
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(0);
        const duration = video.duration || 10;
        setLoadProgress(Math.min(90, (buffered / duration) * 100));
      }
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('progress', handleProgress);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(skeletonTimer);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('progress', handleProgress);
      cleanup();
    };
  }, [url, cleanup, attemptPlay, onReady, onError]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
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
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const handleRetry = () => {
    setPhase('skeleton');
    setLoadProgress(0);
    cleanup();
    
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.load();
      }
    }, 100);
  };

  const isLoading = phase === 'skeleton' || phase === 'buffering';

  return (
    <div 
      ref={containerRef}
      className={cn("relative bg-black aspect-video overflow-hidden", className)}
    >
      {/* Skeleton/Loading State - Sempre visível durante carregamento */}
      <div className={cn(
        "absolute inset-0 z-20 transition-opacity duration-500",
        phase === 'ready' ? "opacity-0 pointer-events-none" : "opacity-100"
      )}>
        {/* Background gradient animado */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent animate-pulse" />
        
        {/* Channel info - aparece instantaneamente */}
        <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
          {logo ? (
            <img 
              src={logo} 
              alt="" 
              className="w-12 h-12 rounded-lg object-contain bg-white/10 backdrop-blur-sm"
              onError={(e) => e.currentTarget.style.display = 'none'}
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Tv className="w-6 h-6 text-white/60" />
            </div>
          )}
          <div>
            <h2 className="text-white font-semibold text-lg">{title}</h2>
            {category && <p className="text-white/60 text-sm">{category}</p>}
          </div>
        </div>

        {/* Live badge */}
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-1.5 bg-red-500/90 px-2.5 py-1 rounded text-xs text-white font-medium">
            <Radio className="w-3 h-3 animate-pulse" />
            AO VIVO
          </div>
        </div>

        {/* Center loading indicator */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
          {/* Animated rings */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-transparent border-t-primary animate-spin" />
            <div className="absolute inset-2 w-20 h-20 rounded-full border-2 border-transparent border-t-primary/50 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
            
            {/* Logo no centro se disponível */}
            {logo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <img 
                  src={logo} 
                  alt="" 
                  className="w-10 h-10 rounded object-contain opacity-80"
                  onError={(e) => e.currentTarget.style.display = 'none'}
                />
              </div>
            )}
          </div>
          
          <div className="text-center">
            <p className="text-white font-medium">
              {phase === 'skeleton' ? 'Conectando...' : 'Carregando stream...'}
            </p>
            <p className="text-white/50 text-sm mt-1">
              {title}
            </p>
          </div>
        </div>

        {/* Progress bar na parte inferior */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${loadProgress}%` }}
          />
        </div>
      </div>

      {/* Video element - renderizado imediatamente mas invisível até pronto */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className={cn(
          "w-full h-full object-contain transition-opacity duration-300",
          phase === 'ready' ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Channel Info overlay (quando vídeo está pronto) */}
      {phase === 'ready' && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 opacity-0 hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center gap-3">
            {logo && (
              <img 
                src={logo} 
                alt={title}
                className="w-10 h-10 object-contain rounded bg-white/10"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <h2 className="text-white font-semibold line-clamp-1">{title}</h2>
          </div>
        </div>
      )}

      {/* Manual Play overlay */}
      {needsManualPlay && phase === 'ready' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 gap-4">
          <Button 
            onClick={handleManualPlay} 
            size="lg" 
            className="gap-2 rounded-full w-20 h-20 bg-primary/90 hover:bg-primary hover:scale-105 transition-transform"
          >
            <Play className="w-10 h-10 ml-1" fill="currentColor" />
          </Button>
          <p className="text-white text-sm">Toque para reproduzir</p>
        </div>
      )}

      {/* Error state */}
      {phase === 'error' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95 text-white gap-4 p-4">
          <AlertCircle className="w-16 h-16 text-destructive" />
          <p className="text-xl text-center">{errorMessage}</p>
          <Button onClick={handleRetry} variant="secondary" className="mt-4 gap-2">
            <RefreshCw className="w-4 h-4" />
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Controls */}
      {phase === 'ready' && !needsManualPlay && (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/20">
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/20">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;
