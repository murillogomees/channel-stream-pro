import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Volume2, VolumeX, Maximize, Minimize, AlertCircle, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Hls from 'hls.js';
import { onPlayerOpen, onPlayerClose } from '@/services/downloadPriorityService';
import { useConnectionAwarePlayer } from '@/hooks/useConnectionAwarePlayer';
import { resolveStreamUrl, getFallbackUrl } from '@/services/smartStreamResolver';

interface VideoPlayerProps {
  url: string;
  title: string;
  logo?: string;
  onError?: (error: string) => void;
  onReady?: () => void;
  className?: string;
  source?: 'cdn_worker' | 'stream_proxy' | 'r2_direct' | 'cloudflare_stream' | 'origin';
  fallbackUrl?: string;
}

// =============================================================================
// STREAM TYPE DETECTION
// =============================================================================

function isHlsUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  return urlLower.includes('.m3u8') || urlLower.includes('.m3u');
}

function isDirectVideoUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  
  // Direct video files
  if (urlLower.includes('.mp4') || urlLower.includes('.mkv') || 
      urlLower.includes('.avi') || urlLower.includes('.ts') ||
      urlLower.includes('.webm')) {
    return true;
  }
  
  // Xtream Codes patterns (direct streams without extension)
  const xtreamPattern = /\/(?:live\/)?[^\/]+\/[^\/]+\/\d+$/;
  if (xtreamPattern.test(urlLower) && !isHlsUrl(urlLower)) {
    return true;
  }
  
  // URLs ending in numeric ID without extension
  if (/\/\d+$/.test(urlLower) && !urlLower.includes('.m3u')) {
    return true;
  }
  
  // VOD patterns
  if (urlLower.includes('/movie/') || urlLower.includes('/series/') || urlLower.includes('/vod/')) {
    return true;
  }
  
  return false;
}

export function VideoPlayer({ 
  url, 
  title, 
  logo, 
  onError, 
  onReady,
  className = '',
  source = 'origin',
  fallbackUrl,
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
  const [currentUrl, setCurrentUrl] = useState(url);
  const [hasFallback, setHasFallback] = useState(false);
  const retryCount = useRef(0);
  const maxRetries = 3;

  // Connection-aware configuration
  const { getOptimizedHlsConfig } = useConnectionAwarePlayer();

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

  // Smart stream resolution
  const streamResolution = useRef(resolveStreamUrl(url));
  
  // Try fallback URL if available
  const tryFallback = useCallback(() => {
    // First try smart fallback
    const smartFallback = getFallbackUrl(streamResolution.current);
    if (smartFallback && !hasFallback) {
      console.log('[VideoPlayer] Trying smart fallback:', smartFallback);
      setHasFallback(true);
      setCurrentUrl(smartFallback);
      retryCount.current = 0;
      return;
    }
    
    if (fallbackUrl && !hasFallback) {
      console.log('[VideoPlayer] Trying provided fallback URL:', fallbackUrl);
      setHasFallback(true);
      setCurrentUrl(fallbackUrl);
      retryCount.current = 0;
    } else {
      setHasError(true);
      setErrorMessage('Stream indisponível. Tente outro canal.');
      setIsLoading(false);
      onError?.('All sources failed');
    }
  }, [fallbackUrl, hasFallback, onError]);

  const initPlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video || !currentUrl) return;

    // Use smart resolver to determine optimal playback
    const resolved = resolveStreamUrl(currentUrl);
    streamResolution.current = resolved;
    
    const playUrl = resolved.url;
    const isHls = isHlsUrl(playUrl);
    // Force direct for VOD/live - never proxy video files
    const isDirect = resolved.type === 'direct' || resolved.contentType === 'vod' || resolved.contentType === 'live';
    
    console.log(`[VideoPlayer] Init: ${playUrl.substring(0, 80)}... type: ${resolved.type}, content: ${resolved.contentType}, isDirect: ${isDirect}`);
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    setNeedsManualPlay(false);

    cleanup();

    // DIRECT VIDEO STREAM - Always prefer direct for non-HLS content
    // Edge Functions timeout on video streaming
    if (isDirect || !isHls) {
      console.log('[VideoPlayer] DIRECT playback:', playUrl.substring(0, 80));
      video.src = playUrl;
      video.crossOrigin = 'anonymous';
      const onLoadedData = () => {
        console.log('[VideoPlayer] Direct stream loaded');
        setIsLoading(false);
        retryCount.current = 0;
        attemptPlay();
        onReady?.();
      };
      
      const onVideoError = () => {
        const mediaError = video.error;
        console.error('[VideoPlayer] Direct stream error:', mediaError?.code, mediaError?.message);
        
        if (retryCount.current < maxRetries) {
          retryCount.current++;
          console.log(`[VideoPlayer] Retry ${retryCount.current}/${maxRetries}`);
          setTimeout(() => {
            video.src = '';
            video.src = playUrl;
            video.load();
          }, 1000 * retryCount.current);
        } else {
          // Try fallback if available
          tryFallback();
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
      console.log('[VideoPlayer] Using HLS.js with connection-aware config');
      
      // Get optimized config based on connection and source
      const optimizedConfig = getOptimizedHlsConfig({ source });
      
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferSize: 100 * 1000 * 1000,
        maxBufferHole: 2,
        capLevelToPlayerSize: true,
        liveDurationInfinity: true,
        appendErrorMaxRetry: 5,
        debug: false,
        ...optimizedConfig, // Apply connection-aware settings
      });

      hlsRef.current = hls;
      hls.loadSource(playUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[VideoPlayer] Manifest loaded');
        setIsLoading(false);
        retryCount.current = 0;
        attemptPlay();
        onReady?.();
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        if (isLoading) setIsLoading(false);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) {
          console.log('[VideoPlayer] Non-fatal error, auto-recovering:', data.details);
          return;
        }

        console.error('[VideoPlayer] Fatal HLS error:', data.type, data.details, 'source:', source);
        
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log('[VideoPlayer] Attempting network recovery...');
            if (retryCount.current < maxRetries) {
              retryCount.current++;
              hls.startLoad();
            } else {
              // Network errors on CDN Worker - try fallback
              tryFallback();
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('[VideoPlayer] Attempting media recovery...');
            hls.recoverMediaError();
            break;
          default:
            // Fatal error - try fallback
            tryFallback();
            break;
        }
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari/iOS)
      console.log('[VideoPlayer] Using native HLS');
      video.src = playUrl;
      
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        retryCount.current = 0;
        attemptPlay();
        onReady?.();
      }, { once: true });

      video.addEventListener('error', () => {
        tryFallback();
      }, { once: true });

      video.load();
    } else {
      // Fallback: try direct playback
      console.log('[VideoPlayer] Fallback: direct playback');
      video.src = playUrl;
      
      video.addEventListener('loadeddata', () => {
        setIsLoading(false);
        retryCount.current = 0;
        attemptPlay();
        onReady?.();
      }, { once: true });
      
      video.addEventListener('error', () => {
        tryFallback();
      }, { once: true });
      
      video.load();
    }
  }, [currentUrl, cleanup, attemptPlay, onError, onReady, isLoading, source, getOptimizedHlsConfig, tryFallback]);

  // Update currentUrl when url prop changes
  useEffect(() => {
    setCurrentUrl(url);
    setHasFallback(false);
    retryCount.current = 0;
  }, [url]);

  useEffect(() => {
    initPlayer();
    return cleanup;
  }, [currentUrl]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setHasFallback(false);
    setCurrentUrl(url); // Reset to original URL
    retryCount.current = 0;
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
