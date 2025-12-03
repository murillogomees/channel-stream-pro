import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Volume2, VolumeX, Maximize, Minimize, AlertCircle, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Hls from 'hls.js';

interface VideoPlayerProps {
  url: string;
  title: string;
  logo?: string;
  onError?: (error: string) => void;
  onReady?: () => void;
  className?: string;
}

export function VideoPlayer({ 
  url, 
  title, 
  logo, 
  onError, 
  onReady,
  className = '',
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [needsManualPlay, setNeedsManualPlay] = useState(false);

  const cleanup = useCallback(() => {
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
      setIsLoading(false);
    } catch {
      setNeedsManualPlay(true);
      setIsLoading(false);
    }
  }, []);

  const handleManualPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      setNeedsManualPlay(false);
    } catch {
      setHasError(true);
      setErrorMessage('Não foi possível iniciar');
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    const isHls = url.toLowerCase().includes('.m3u8') || url.toLowerCase().includes('.m3u');
    
    setIsLoading(true);
    setHasError(false);
    setNeedsManualPlay(false);
    cleanup();

    // HLS Stream
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        lowLatencyMode: false,
        startLevel: -1,
        capLevelToPlayerSize: true,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        maxBufferSize: 10 * 1024 * 1024,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 2,
        levelLoadingTimeOut: 10000,
        fragLoadingTimeOut: 15000,
      });

      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        attemptPlay();
        onReady?.();
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setHasError(true);
            setErrorMessage('Erro ao carregar stream');
            setIsLoading(false);
            onError?.('HLS Error');
          }
        }
      });

      return cleanup;
    }

    // Safari native HLS or direct video
    video.src = url;

    const handleCanPlay = () => {
      setIsLoading(false);
      attemptPlay();
      onReady?.();
    };

    const handleError = () => {
      setHasError(true);
      setErrorMessage('Erro ao carregar vídeo');
      setIsLoading(false);
      onError?.('Video Error');
    };

    const handlePlaying = () => {
      setIsLoading(false);
      setNeedsManualPlay(false);
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('playing', handlePlaying);
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
    const video = videoRef.current;
    if (video) {
      setIsLoading(true);
      setHasError(false);
      video.load();
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black aspect-video overflow-hidden ${className}`}
    >
      {/* Channel Info */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center gap-3">
          {logo && (
            <img 
              src={logo} 
              alt={title}
              className="w-12 h-12 object-contain rounded bg-white/10"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <h2 className="text-white font-semibold text-lg line-clamp-1">{title}</h2>
        </div>
      </div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="w-full h-full object-contain"
      />

      {/* Loading */}
      {isLoading && !hasError && !needsManualPlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-white text-sm">Carregando...</p>
        </div>
      )}

      {/* Manual Play */}
      {needsManualPlay && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-4">
          <Button onClick={handleManualPlay} size="lg" className="gap-2 rounded-full w-20 h-20">
            <Play className="w-10 h-10" />
          </Button>
          <p className="text-white text-sm">Toque para reproduzir</p>
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-4 p-4">
          <AlertCircle className="w-16 h-16 text-destructive" />
          <p className="text-xl text-center">{errorMessage}</p>
          <Button onClick={handleRetry} variant="secondary" className="mt-4 gap-2">
            <RefreshCw className="w-4 h-4" />
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Controls */}
      {!hasError && !needsManualPlay && (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4">
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
}
