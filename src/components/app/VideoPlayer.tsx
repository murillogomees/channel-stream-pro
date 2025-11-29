import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Volume2, VolumeX, Maximize, Minimize, AlertCircle, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Hls from 'hls.js';
import { onPlayerOpen, onPlayerClose } from '@/services/downloadPriorityService';

interface VideoPlayerProps {
  url: string;
  title: string;
  logo?: string;
  onError?: (error: string) => void;
  className?: string;
}

// =============================================================================
// STREAM TYPE DETECTION
// =============================================================================

function extractOriginalUrl(url: string): string {
  // If it's a proxy URL, extract the original URL from the query param
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
  
  // Direct video files
  if (checkUrl.includes('.mp4') || checkUrl.includes('.mkv') || 
      checkUrl.includes('.avi') || checkUrl.includes('.ts') ||
      checkUrl.includes('.webm')) {
    return true;
  }
  
  // Proxy URL without HLS extension = direct stream
  if (url.includes('stream-proxy')) {
    return !isHlsUrl(url);
  }
  
  // Xtream Codes patterns (direct streams without extension)
  // /live/user/pass/123 or /movie/user/pass/123 or /user/pass/123
  const xtreamPattern = /\/(?:live\/)?[^\/]+\/[^\/]+\/\d+$/;
  if (xtreamPattern.test(checkUrl)) {
    return true;
  }
  
  // URLs ending in numeric ID without extension
  if (/\/\d+$/.test(checkUrl) && !checkUrl.includes('.m3u')) {
    return true;
  }
  
  return false;
}

export function VideoPlayer({ url, title, logo, onError, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [needsManualPlay, setNeedsManualPlay] = useState(false);
  const retryCount = useRef(0);
  const maxRetries = 3;

  const cleanup = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
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
    } catch {
      setNeedsManualPlay(true);
      setIsLoading(false);
    }
  }, []);

  const handleManualPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      setIsLoading(true);
      setNeedsManualPlay(false);
      video.muted = false;
      setIsMuted(false);
      await video.play();
      setIsLoading(false);
    } catch {
      try {
        video.muted = true;
        setIsMuted(true);
        await video.play();
        setIsLoading(false);
      } catch {
        setHasError(true);
        setErrorMessage('Não foi possível iniciar a reprodução');
        setIsLoading(false);
      }
    }
  }, []);

  // Download Priority Management - Pause downloads when player opens
  useEffect(() => {
    onPlayerOpen();
    return () => {
      onPlayerClose();
    };
  }, []);

  const initPlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    const isHls = isHlsUrl(url);
    const isDirect = isDirectVideoUrl(url);
    
    console.log(`[VideoPlayer] Init: ${url.substring(0, 60)}... isHLS: ${isHls}, isDirect: ${isDirect}`);
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    setNeedsManualPlay(false);

    cleanup();

    // DIRECT VIDEO STREAM (MP4, TS, Xtream live/movie)
    if (isDirect && !isHls) {
      console.log('[VideoPlayer] Using direct video playback');
      video.src = url;
      
      const onLoadedData = () => {
        console.log('[VideoPlayer] Direct stream loaded');
        setIsLoading(false);
        retryCount.current = 0;
        attemptPlay();
      };
      
      const onVideoError = () => {
        const mediaError = video.error;
        console.error('[VideoPlayer] Direct stream error:', mediaError?.code, mediaError?.message);
        
        if (retryCount.current < maxRetries) {
          retryCount.current++;
          console.log(`[VideoPlayer] Retry ${retryCount.current}/${maxRetries}`);
          setTimeout(() => {
            video.src = '';
            video.src = url;
            video.load();
          }, 1000 * retryCount.current);
        } else {
          setHasError(true);
          setErrorMessage('Stream indisponível. Tente outro canal.');
          setIsLoading(false);
          onError?.('Direct stream error');
        }
      };
      
      const onCanPlay = () => {
        setIsLoading(false);
      };
      
      video.addEventListener('loadeddata', onLoadedData, { once: true });
      video.addEventListener('error', onVideoError, { once: true });
      video.addEventListener('canplay', onCanPlay);
      
      video.load();
      return;
    }

    // HLS.js for HLS streams
    if (Hls.isSupported() && isHls) {
      console.log('[VideoPlayer] Using HLS.js');
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 100 * 1000 * 1000,
        maxBufferHole: 2,
        startLevel: -1,
        abrEwmaDefaultEstimate: 500000,
        abrBandWidthFactor: 0.7,
        abrBandWidthUpFactor: 0.5,
        capLevelToPlayerSize: true,
        fragLoadingTimeOut: 60000,
        manifestLoadingTimeOut: 30000,
        levelLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 10,
        manifestLoadingMaxRetry: 6,
        levelLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 500,
        manifestLoadingRetryDelay: 500,
        levelLoadingRetryDelay: 500,
        fragLoadingMaxRetryTimeout: 30000,
        manifestLoadingMaxRetryTimeout: 30000,
        levelLoadingMaxRetryTimeout: 30000,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        liveDurationInfinity: true,
        appendErrorMaxRetry: 5,
        debug: false,
      });

      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[VideoPlayer] Manifest loaded');
        setIsLoading(false);
        attemptPlay();
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        if (isLoading) setIsLoading(false);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) {
          console.log('[VideoPlayer] Non-fatal error, auto-recovering:', data.details);
          return;
        }

        console.error('[VideoPlayer] Fatal error:', data.type, data.details);
        
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log('[VideoPlayer] Attempting network recovery...');
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('[VideoPlayer] Attempting media recovery...');
            hls.recoverMediaError();
            break;
          default:
            setHasError(true);
            setErrorMessage('Stream indisponível.');
            setIsLoading(false);
            onError?.('Stream indisponível');
            break;
        }
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari/iOS)
      console.log('[VideoPlayer] Using native HLS');
      video.src = url;
      
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        attemptPlay();
      }, { once: true });

      video.addEventListener('error', () => {
        setHasError(true);
        setErrorMessage('Erro ao carregar stream');
        setIsLoading(false);
      }, { once: true });

      video.load();
    } else {
      // Fallback: try direct playback
      console.log('[VideoPlayer] Fallback: direct playback');
      video.src = url;
      
      video.addEventListener('loadeddata', () => {
        setIsLoading(false);
        attemptPlay();
      }, { once: true });
      
      video.addEventListener('error', () => {
        setHasError(true);
        setErrorMessage('Formato não suportado');
        setIsLoading(false);
        onError?.('Format not supported');
      }, { once: true });
      
      video.load();
    }
  }, [url, cleanup, attemptPlay, onError, isLoading]);

  useEffect(() => {
    initPlayer();
    return cleanup;
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlaying = () => {
      setIsLoading(false);
      setNeedsManualPlay(false);
    };

    const handleCanPlay = () => {
      if (!hlsRef.current) {
        setIsLoading(false);
        attemptPlay();
      }
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [attemptPlay]);

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
      console.error('[VideoPlayer] Fullscreen error:', err);
    }
  };

  const handleRetry = () => {
    initPlayer();
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
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
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
        crossOrigin="anonymous"
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
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Para melhor experiência com IPTV, use o aplicativo SmartOne.
          </p>
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
