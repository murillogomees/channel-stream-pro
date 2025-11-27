import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Volume2, VolumeX, Maximize, Minimize, AlertCircle, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Hls from 'hls.js';
import { supabase } from '@/integrations/supabase/client';

interface VideoPlayerProps {
  url: string;
  title: string;
  logo?: string;
  onError?: (error: string) => void;
  className?: string;
}

export function VideoPlayer({ url, title, logo, onError, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [needsManualPlay, setNeedsManualPlay] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Detect stream type from URL
  const getStreamType = useCallback((streamUrl: string): 'hls' | 'direct' => {
    try {
      const parsed = new URL(streamUrl);
      const originalUrl = parsed.searchParams.get('url');
      const urlToCheck = originalUrl ? decodeURIComponent(originalUrl) : streamUrl;
      
      if (urlToCheck.includes('.m3u8') || urlToCheck.includes('application/x-mpegURL')) {
        return 'hls';
      }
    } catch {
      // Fallback check
      if (url.includes('.m3u8')) {
        return 'hls';
      }
    }
    return 'hls'; // Default to HLS as most IPTV streams are HLS
  }, [url]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (hlsRef.current) {
      console.log('[VideoPlayer] Destroying HLS instance');
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
  }, []);

  // Try to play with fallbacks
  const attemptPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      // First try muted autoplay (most compatible)
      video.muted = true;
      setIsMuted(true);
      await video.play();
      console.log('[VideoPlayer] Muted autoplay succeeded');
      setNeedsManualPlay(false);
    } catch (err) {
      console.log('[VideoPlayer] Autoplay failed, waiting for user interaction:', err);
      setNeedsManualPlay(true);
      setIsLoading(false);
    }
  }, []);

  // Manual play handler
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
    } catch (err) {
      console.error('[VideoPlayer] Manual play failed:', err);
      // Try muted as last resort
      try {
        video.muted = true;
        setIsMuted(true);
        await video.play();
        setIsLoading(false);
      } catch (err2) {
        console.error('[VideoPlayer] Even muted play failed:', err2);
        setHasError(true);
        setErrorMessage('Não foi possível iniciar a reprodução');
        setIsLoading(false);
      }
    }
  }, []);

  // Initialize player
  const initPlayer = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !url) return;

    console.log('[VideoPlayer] Initializing with URL:', url);
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    setNeedsManualPlay(false);

    cleanup();

    const streamType = getStreamType(url);
    console.log('[VideoPlayer] Stream type:', streamType, 'HLS.js supported:', Hls.isSupported());

    // Get auth token
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    if (streamType === 'hls') {
      if (Hls.isSupported()) {
        // Use HLS.js for browsers that support it
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startLevel: -1, // Auto quality
          capLevelToPlayerSize: true,
          debug: false,
          xhrSetup: (xhr, xhrUrl) => {
            if (token) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
          },
        });

        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('[VideoPlayer] HLS manifest parsed');
          setIsLoading(false);
          attemptPlay();
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('[VideoPlayer] HLS error:', data);
          
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('[VideoPlayer] Network error, trying to recover...');
                if (retryCount < 3) {
                  hls.startLoad();
                  setRetryCount(prev => prev + 1);
                } else {
                  setHasError(true);
                  setErrorMessage('Erro de rede. Verifique sua conexão.');
                  setIsLoading(false);
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('[VideoPlayer] Media error, trying to recover...');
                hls.recoverMediaError();
                break;
              default:
                setHasError(true);
                setErrorMessage('Formato não suportado ou canal indisponível.');
                setIsLoading(false);
                onError?.('Formato não suportado');
                break;
            }
          }
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          // Reset retry count on successful load
          if (retryCount > 0) {
            setRetryCount(0);
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari, iOS)
        console.log('[VideoPlayer] Using native HLS support');
        video.src = url;
        
        video.addEventListener('loadedmetadata', () => {
          console.log('[VideoPlayer] Native HLS metadata loaded');
          setIsLoading(false);
          attemptPlay();
        }, { once: true });

        video.addEventListener('error', (e) => {
          console.error('[VideoPlayer] Native HLS error:', video.error);
          setHasError(true);
          setErrorMessage('Erro ao carregar stream');
          setIsLoading(false);
        }, { once: true });

        video.load();
      } else {
        // Fallback: try direct load anyway
        console.log('[VideoPlayer] No HLS support, trying direct load');
        video.src = url;
        video.load();
      }
    } else {
      // Direct video source
      console.log('[VideoPlayer] Loading direct video source');
      video.src = url;
      video.load();
    }
  }, [url, cleanup, getStreamType, attemptPlay, onError, retryCount]);

  // Initialize on URL change
  useEffect(() => {
    initPlayer();
    return cleanup;
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      console.log('[VideoPlayer] Can play');
      if (!hlsRef.current) {
        // Only handle for non-HLS (HLS handles this via MANIFEST_PARSED)
        setIsLoading(false);
        attemptPlay();
      }
    };

    const handleWaiting = () => {
      console.log('[VideoPlayer] Waiting/buffering');
    };

    const handlePlaying = () => {
      console.log('[VideoPlayer] Playing');
      setIsLoading(false);
      setNeedsManualPlay(false);
    };

    const handleError = () => {
      if (hlsRef.current) return; // HLS.js handles its own errors
      
      console.error('[VideoPlayer] Video error:', video.error);
      setIsLoading(false);
      setHasError(true);
      
      let errorMsg = 'Erro ao carregar o canal';
      if (video.error) {
        switch (video.error.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            errorMsg = 'Erro de conexão';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMsg = 'Erro ao decodificar';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMsg = 'Formato não suportado';
            break;
          case MediaError.MEDIA_ERR_ABORTED:
            errorMsg = 'Reprodução cancelada';
            break;
        }
      }
      
      setErrorMessage(errorMsg);
      onError?.(errorMsg);
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);
    };
  }, [attemptPlay, onError]);

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
    setRetryCount(0);
    initPlayer();
  };

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black aspect-video overflow-hidden ${className}`}
    >
      {/* Channel Info Overlay */}
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

      {/* Video Element - no src attribute, set programmatically */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="w-full h-full object-contain"
        crossOrigin="anonymous"
      />

      {/* Loading State */}
      {isLoading && !hasError && !needsManualPlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-white text-sm">Carregando stream...</p>
        </div>
      )}

      {/* Manual Play Required State */}
      {needsManualPlay && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-4">
          <Button
            onClick={handleManualPlay}
            size="lg"
            className="gap-2 rounded-full w-20 h-20"
          >
            <Play className="w-10 h-10" />
          </Button>
          <p className="text-white text-sm">Toque para reproduzir</p>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-4 p-4">
          <AlertCircle className="w-16 h-16 text-destructive" />
          <p className="text-xl text-center">{errorMessage}</p>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Alguns canais podem não ser compatíveis com reprodução via navegador. 
            Para melhor experiência, use o app SmartOne.
          </p>
          <Button
            onClick={handleRetry}
            variant="secondary"
            className="mt-4 gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Controls */}
      {!hasError && !needsManualPlay && (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="text-white hover:bg-white/20"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
