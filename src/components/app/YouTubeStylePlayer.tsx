/**
 * YouTube-Style IPTV Player
 * Player com layout estilo YouTube: vídeo no topo + detalhes embaixo
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, 
  SkipBack, SkipForward, X, Radio, Film, Clock, Calendar,
  Signal, Wifi, WifiOff, RefreshCw, ChevronDown, ChevronUp,
  Heart, Share2, Info, AlertCircle, CheckCircle2, Star, Users, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import { useMovieMetadata } from "@/features/player/hooks/useMovieMetadata";

interface ContentMetadata {
  title?: string;
  description?: string;
  tmdb_rating?: number;
  imdb_rating?: number;
  cast_members?: Array<{ name: string; character?: string; profile_url?: string }>;
  genres?: string[];
  year?: number;
  director?: string;
  duration_minutes?: number;
  poster_url?: string;
  backdrop_url?: string;
}

interface YouTubeStylePlayerProps {
  url: string;
  title?: string;
  logo?: string;
  category?: string;
  autoplay?: boolean;
  muted?: boolean;
  onBack?: () => void;
  onError?: (error: any) => void;
  onReady?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  // Progress tracking
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlaybackStart?: () => void;
  onPlaybackComplete?: () => void;
  initialTime?: number;
  // Content metadata
  metadata?: ContentMetadata;
}

// Stream type detection
const detectStreamType = (url: string) => {
  const lower = url.toLowerCase();
  const hasVideoExtension = /\.(mp4|mkv|avi|webm|mov|m4v)(\?|$)/i.test(url);
  const isHls = lower.includes('.m3u8') || lower.includes('.m3u');
  const isXtreamLive = /\/(?:live\/)?[^\/]+\/[^\/]+\/\d+$/.test(url) && !isHls && !hasVideoExtension;
  const isMovie = lower.includes('/movie/') && hasVideoExtension;
  const isSeries = lower.includes('/series/') && hasVideoExtension;
  
  return {
    type: isHls ? 'HLS' : isXtreamLive ? 'MPEG-TS' : 'MP4/VOD',
    isLive: isXtreamLive,
    isHls,
    isVod: isMovie || isSeries || hasVideoExtension,
  };
};

export default function YouTubeStylePlayer({
  url,
  title = "Canal sem nome",
  logo,
  category = "Geral",
  autoplay = true,
  muted = false,
  onBack,
  onError,
  onReady,
  isFavorite = false,
  onToggleFavorite,
  onTimeUpdate,
  onPlaybackStart,
  onPlaybackComplete,
  initialTime = 0,
  metadata,
}: YouTubeStylePlayerProps) {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [volume, setVolume] = useState(muted ? 0 : 100);
  const [isMuted, setIsMuted] = useState(muted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showDetails, setShowDetails] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'error'>('connecting');
  const [streamStats, setStreamStats] = useState({
    bitrate: 0,
    resolution: '',
    codec: '',
    fps: 0,
  });
  
  // Refs for debouncing
  const hasConnectedOnceRef = useRef(false);
  const bufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect stream info
  const streamInfo = detectStreamType(url);

  // Auto-fetch metadata if not provided
  const { 
    metadata: fetchedMetadata, 
    isLoading: isLoadingMetadata, 
    fetchMetadata 
  } = useMovieMetadata();
  
  // Use provided metadata or fetched metadata
  const displayMetadata = metadata || fetchedMetadata;

  // Fetch metadata automatically for VOD content
  useEffect(() => {
    if (!metadata && title && title !== "Canal sem nome" && (streamInfo.isVod || !streamInfo.isLive)) {
      // Generate a content ID based on title and URL
      const contentId = btoa(title.slice(0, 20) + url.slice(-20)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
      fetchMetadata(contentId, title);
    }
  }, [metadata, title, url, streamInfo.isVod, streamInfo.isLive, fetchMetadata]);

  // Extract original URL from proxy
  const getOriginalUrl = (proxyUrl: string): string => {
    try {
      const urlObj = new URL(proxyUrl);
      const encodedUrl = urlObj.searchParams.get('url');
      return encodedUrl ? decodeURIComponent(encodedUrl) : proxyUrl;
    } catch {
      return proxyUrl;
    }
  };

  const originalUrl = getOriginalUrl(url);

  // Reset UI timer
  const resetUITimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  // Playback controls
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(console.warn);
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const handleVolumeChange = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    const vol = value[0];
    video.volume = vol / 100;
    setVolume(vol);
    setIsMuted(vol === 0);
    video.muted = vol === 0;
  }, []);

  const seek = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  }, []);

  const seekTo = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value[0];
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const retry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    setConnectionStatus('connecting');
    // Force re-mount by changing URL temporarily
    const video = videoRef.current;
    if (video) {
      video.load();
    }
  }, []);

  // Format time
  const formatTime = (time: number) => {
    if (!isFinite(time)) return '--:--';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Track if playback has started
  const hasStartedPlayingRef = useRef(false);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlers = {
      play: () => setIsPlaying(true),
      pause: () => setIsPlaying(false),
      waiting: () => {
        // Only show loading if we haven't connected yet
        // After first connection, show subtle buffering indicator instead
        if (!hasConnectedOnceRef.current) {
          setIsLoading(true);
        } else {
          // Debounce buffer indicator - only show if waiting > 500ms
          if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
          bufferTimeoutRef.current = setTimeout(() => {
            setIsBuffering(true);
          }, 500);
        }
      },
      canplay: () => {
        // Clear buffer timeout
        if (bufferTimeoutRef.current) {
          clearTimeout(bufferTimeoutRef.current);
          bufferTimeoutRef.current = null;
        }
        setIsLoading(false);
        setIsBuffering(false);
        if (!hasConnectedOnceRef.current) {
          hasConnectedOnceRef.current = true;
          setConnectionStatus('connected');
        }
      },
      playing: () => {
        // Clear buffer timeout
        if (bufferTimeoutRef.current) {
          clearTimeout(bufferTimeoutRef.current);
          bufferTimeoutRef.current = null;
        }
        setIsLoading(false);
        setIsBuffering(false);
        setIsPlaying(true);
        setHasError(false);
        if (!hasConnectedOnceRef.current) {
          hasConnectedOnceRef.current = true;
          setConnectionStatus('connected');
        }
        // Track playback start
        if (!hasStartedPlayingRef.current) {
          hasStartedPlayingRef.current = true;
          onPlaybackStart?.();
        }
      },
      timeupdate: () => {
        setCurrentTime(video.currentTime);
        if (video.buffered.length > 0) {
          setBuffered(video.buffered.end(video.buffered.length - 1));
        }
        // Call progress callback
        if (video.currentTime > 0 && video.duration > 0) {
          onTimeUpdate?.(video.currentTime, video.duration);
        }
      },
      durationchange: () => setDuration(video.duration),
      loadedmetadata: () => {
        setDuration(video.duration);
        setStreamStats(prev => ({
          ...prev,
          resolution: `${video.videoWidth}x${video.videoHeight}`,
        }));
        // Seek to initial time if provided
        if (initialTime > 0 && video.duration > initialTime) {
          video.currentTime = initialTime;
        }
      },
      ended: () => {
        // Track playback complete
        onPlaybackComplete?.();
      },
      error: () => {
        setIsLoading(false);
        setIsBuffering(false);
        setConnectionStatus('error');
      },
      stalled: () => {
        // Stream stalled - only show indicator after delay
        if (hasConnectedOnceRef.current) {
          if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
          bufferTimeoutRef.current = setTimeout(() => {
            setIsBuffering(true);
          }, 1000);
        }
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      video.addEventListener(event, handler);
    });

    return () => {
      if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
      Object.entries(handlers).forEach(([event, handler]) => {
        video.removeEventListener(event, handler);
      });
    };
  }, []);

  // HLS Player initialization function
  const initHlsPlayer = useCallback((streamUrl: string, video: HTMLVideoElement) => {
    const hls = new Hls({
      // OPTIMIZED for fast startup
      maxBufferLength: 10, // Start playing faster with smaller buffer
      maxMaxBufferLength: 30,
      maxBufferHole: 0.5,
      startFragPrefetch: true,
      startLevel: -1, // Auto quality selection
      abrEwmaDefaultEstimate: 500000, // 500kbps initial estimate
      abrEwmaFastLive: 3,
      abrEwmaSlowLive: 9,
      // Faster loading timeouts
      fragLoadingTimeOut: 10000,
      fragLoadingMaxRetry: 3,
      fragLoadingRetryDelay: 500,
      manifestLoadingTimeOut: 8000,
      manifestLoadingMaxRetry: 2,
      levelLoadingTimeOut: 8000,
      levelLoadingMaxRetry: 2,
      // Low latency mode
      lowLatencyMode: false,
      backBufferLength: 30,
    });
    hlsRef.current = hls;

    hls.loadSource(streamUrl);
    hls.attachMedia(video);
    
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setIsLoading(false);
      hasConnectedOnceRef.current = true;
      setConnectionStatus('connected');
      onReady?.();
      if (autoplay) video.play().catch(console.warn);
    });

    hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
      setStreamStats(prev => ({
        ...prev,
        bitrate: Math.round((data.details.totalduration * 8) / 1000),
      }));
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      console.warn('[Player] HLS error:', data.type, data.details, data.fatal);
      
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log('[Player] HLS network recovery...');
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('[Player] HLS media recovery...');
            hls.recoverMediaError();
            break;
          default:
            setHasError(true);
            setErrorMessage('Erro ao carregar stream');
            setConnectionStatus('error');
            onError?.(data);
            break;
        }
      }
    });

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [autoplay, onReady, onError]);

  // Initialize player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    // Reset connection state for new URL
    hasConnectedOnceRef.current = false;
    setIsLoading(true);
    setIsBuffering(false);
    setHasError(false);
    setErrorMessage('');
    setConnectionStatus('connecting');

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

    const originalUrl = getOriginalUrl(url);
    const info = detectStreamType(originalUrl);

    // VOD playback - Priority: Fast start
    if (info.isVod) {
      video.preload = 'auto';
      video.src = url;
      video.load();
      if (autoplay) {
        // Try to play immediately
        video.play().catch(() => {
          // Fallback: try with muted first
          video.muted = true;
          video.play().catch(console.warn);
        });
      }
      return;
    }

    // MPEG-TS live - OPTIMIZED for fast startup
    if (info.type === 'MPEG-TS' && mpegts.isSupported()) {
      const player = mpegts.createPlayer({
        type: 'mpegts',
        isLive: true,
        url: url,
      }, {
        enableWorker: true,
        liveBufferLatencyChasing: true,
        liveSync: true,
        lazyLoad: false,
        lazyLoadMaxDuration: 0,
        lazyLoadRecoverDuration: 0,
        deferLoadAfterSourceOpen: false,
        stashInitialSize: 128 * 1024, // 128KB - smaller for faster start
        enableStashBuffer: true,
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 30,
        autoCleanupMinBackwardDuration: 15,
        fixAudioTimestampGap: true,
      });
      
      mpegtsRef.current = player;
      player.attachMediaElement(video);
      player.load();
      
      // Timeout for connection - don't wait forever
      const connectionTimeout = setTimeout(() => {
        if (!hasConnectedOnceRef.current && mpegtsRef.current) {
          console.log('[Player] MPEGTS timeout, trying HLS fallback...');
          // Try HLS as fallback
          player.pause();
          player.unload();
          player.detachMediaElement();
          player.destroy();
          mpegtsRef.current = null;
          
          // Fallback to HLS
          if (Hls.isSupported()) {
            initHlsPlayer(url, video);
          } else {
            video.src = url;
            video.load();
            if (autoplay) video.play().catch(console.warn);
          }
        }
      }, 8000);
      
      // Track network error count to avoid infinite restarts
      let networkErrorCount = 0;
      const MAX_NETWORK_ERRORS = 3;
      
      player.on(mpegts.Events.ERROR, (errorType, errorDetail) => {
        console.warn('[Player] MPEGTS error:', errorType, errorDetail);
        
        // NetworkError - try to recover without restarting from beginning
        if (errorType === 'NetworkError' && mpegtsRef.current) {
          networkErrorCount++;
          
          // Only restart if we had too many errors
          if (networkErrorCount >= MAX_NETWORK_ERRORS) {
            console.log('[Player] Too many network errors, showing error state');
            clearTimeout(connectionTimeout);
            setHasError(true);
            setErrorMessage('Conexão instável - tente novamente');
            setConnectionStatus('error');
            return;
          }
          
          // Don't restart if already playing - just let it buffer
          if (hasConnectedOnceRef.current && !video.paused) {
            console.log('[Player] Network hiccup, buffering...');
            return; // Let mpegts.js handle recovery automatically
          }
          return;
        }
        
        // Fatal errors - show error state
        clearTimeout(connectionTimeout);
        setHasError(true);
        setErrorMessage('Falha na conexão com o stream');
        setConnectionStatus('error');
        onError?.({ type: errorType, details: errorDetail });
      });
      
      player.on(mpegts.Events.METADATA_ARRIVED, () => {
        clearTimeout(connectionTimeout);
        setIsLoading(false);
        hasConnectedOnceRef.current = true;
        setConnectionStatus('connected');
        onReady?.();
        if (autoplay) video.play().catch(console.warn);
      });
      
      return () => {
        clearTimeout(connectionTimeout);
        if (mpegtsRef.current) {
          mpegtsRef.current.pause();
          mpegtsRef.current.unload();
          mpegtsRef.current.detachMediaElement();
          mpegtsRef.current.destroy();
          mpegtsRef.current = null;
        }
      };
    }

    // HLS playback - use init function
    if (Hls.isSupported()) {
      return initHlsPlayer(url, video);
    }

    // Native HLS fallback
    video.src = url;
    video.load();
    if (autoplay) video.play().catch(console.warn);
    
    // Global connection timeout - prevent infinite "Conectando"
    const globalTimeout = setTimeout(() => {
      if (!hasConnectedOnceRef.current) {
        console.log('[Player] Global timeout reached');
        setIsLoading(false);
        setConnectionStatus('error');
        setHasError(true);
        setErrorMessage('Tempo limite de conexão excedido');
      }
    }, 15000);
    
    return () => clearTimeout(globalTimeout);
  }, [url, autoplay, onReady, onError, initHlsPlayer]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', ' ', 'f', 'm'].includes(e.key)) {
        e.preventDefault();
      }
      switch (e.key) {
        case 'ArrowLeft': seek(-10); break;
        case 'ArrowRight': seek(10); break;
        case ' ': togglePlay(); break;
        case 'f': toggleFullscreen(); break;
        case 'm': toggleMute(); break;
        case 'Escape': if (isFullscreen) toggleFullscreen(); else onBack?.(); break;
      }
      resetUITimer();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [seek, togglePlay, toggleFullscreen, toggleMute, isFullscreen, onBack, resetUITimer]);

  // Cleanup timer
  useEffect(() => {
    resetUITimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetUITimer]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* Header - YouTube style */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-background/95 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <X className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            {streamInfo.isLive ? (
              <Badge variant="destructive" className="gap-1">
                <Radio className="w-3 h-3" />
                AO VIVO
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <Film className="w-3 h-3" />
                VOD
              </Badge>
            )}
            <span className="text-sm text-muted-foreground hidden sm:inline">{category}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onToggleFavorite && (
            <Button variant="ghost" size="icon" onClick={onToggleFavorite}>
              <Heart className={cn("w-5 h-5", isFavorite && "fill-red-500 text-red-500")} />
            </Button>
          )}
          <Button variant="ghost" size="icon">
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Player Section */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Video Container */}
          <div 
            ref={containerRef}
            className="relative bg-black aspect-video lg:aspect-auto lg:flex-1 w-full"
            onMouseMove={resetUITimer}
            onClick={togglePlay}
          >
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              controls={false}
            />

            {/* Loading Overlay - Only for initial connection */}
            {isLoading && !hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span className="text-white/70 text-sm">Conectando...</span>
                </div>
              </div>
            )}

            {/* Buffering Indicator - Subtle, after connection */}
            {isBuffering && !isLoading && !hasError && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}

            {/* Error Overlay */}
            {hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="flex flex-col items-center gap-4 text-center p-6">
                  <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                  </div>
                  <p className="text-white text-lg">{errorMessage || 'Erro ao carregar'}</p>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={retry}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Tentar novamente
                    </Button>
                    <Button variant="ghost" onClick={onBack}>
                      Voltar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Controls Overlay */}
            <div 
              className={cn(
                "absolute inset-0 transition-opacity duration-300",
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              {/* Top gradient */}
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/80 to-transparent" />
              
              {/* Channel info */}
              <div className="absolute top-4 left-4 flex items-center gap-3">
                {logo && (
                  <img 
                    src={logo} 
                    alt="" 
                    className="w-10 h-10 rounded-lg object-contain bg-white/10"
                    onError={(e) => e.currentTarget.style.display = 'none'}
                  />
                )}
                <div>
                  <h2 className="text-white font-medium text-lg line-clamp-1">{title}</h2>
                  <p className="text-white/60 text-sm">{category}</p>
                </div>
              </div>

              {/* Center play button */}
              {!isPlaying && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button 
                    onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    className="w-20 h-20 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center transition-transform hover:scale-105"
                  >
                    <Play className="w-10 h-10 text-primary-foreground ml-1" fill="currentColor" />
                  </button>
                </div>
              )}

              {/* Bottom controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-16 pb-4 px-4">
                {/* Progress bar */}
                {!streamInfo.isLive && duration > 0 && (
                  <div className="mb-4">
                    <Slider
                      value={[currentTime]}
                      max={duration}
                      step={1}
                      onValueChange={seekTo}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-white/60 mt-1">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                )}

                {/* Controls row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-white hover:bg-white/20"
                      onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    >
                      {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                    </Button>
                    
                    {!streamInfo.isLive && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-white hover:bg-white/20 hidden sm:flex"
                          onClick={(e) => { e.stopPropagation(); seek(-10); }}
                        >
                          <SkipBack className="w-5 h-5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-white hover:bg-white/20 hidden sm:flex"
                          onClick={(e) => { e.stopPropagation(); seek(10); }}
                        >
                          <SkipForward className="w-5 h-5" />
                        </Button>
                      </>
                    )}

                    <div className="flex items-center gap-2 ml-2" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-white hover:bg-white/20"
                        onClick={toggleMute}
                      >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </Button>
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={100}
                        step={1}
                        onValueChange={handleVolumeChange}
                        className="w-20 hidden sm:flex"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {streamInfo.isLive && (
                      <Badge variant="destructive" className="gap-1 mr-2">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        AO VIVO
                      </Badge>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-white hover:bg-white/20"
                      onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                    >
                      {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Details Toggle - Mobile */}
          <button 
            className="lg:hidden flex items-center justify-center gap-2 py-3 border-t border-border bg-muted/50 text-sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            <Info className="w-4 h-4" />
            Detalhes do stream
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Details Panel - Mobile */}
          {showDetails && (
            <ScrollArea className="lg:hidden flex-1 min-h-0 max-h-[40vh]">
              <div className="p-4">
                <StreamDetailsPanel 
                  title={title}
                  category={category}
                  streamInfo={streamInfo}
                  connectionStatus={connectionStatus}
                  metadata={displayMetadata}
                  isLoadingMetadata={isLoadingMetadata}
                />
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Details Sidebar - Desktop */}
        <aside className="hidden lg:flex w-[320px] xl:w-[380px] border-l border-border flex-col bg-muted/30 min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 h-full">
            <div className="p-3 xl:p-4">
              <StreamDetailsPanel 
                title={title}
                category={category}
                logo={logo}
                streamInfo={streamInfo}
                connectionStatus={connectionStatus}
                metadata={displayMetadata}
                isLoadingMetadata={isLoadingMetadata}
              />
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}

// Stream Details Panel Component
interface StreamDetailsPanelProps {
  title: string;
  category: string;
  logo?: string;
  streamInfo: ReturnType<typeof detectStreamType>;
  connectionStatus: 'connected' | 'connecting' | 'error';
  metadata?: ContentMetadata;
  isLoadingMetadata?: boolean;
}

function StreamDetailsPanel({ 
  title, 
  category, 
  logo,
  streamInfo, 
  connectionStatus,
  metadata,
  isLoadingMetadata,
}: StreamDetailsPanelProps) {
  const rating = metadata?.tmdb_rating || metadata?.imdb_rating;

  return (
    <div className="space-y-3">
      {/* Channel Info Card */}
      <Card className="overflow-hidden">
        <CardHeader className="p-3 xl:pb-3">
          <div className="flex items-start gap-2 xl:gap-3">
            {logo && (
              <img 
                src={logo} 
                alt="" 
                className="w-12 h-12 xl:w-16 xl:h-16 rounded-lg object-contain bg-muted flex-shrink-0"
                onError={(e) => e.currentTarget.style.display = 'none'}
              />
            )}
            <div className="flex-1 min-w-0 overflow-hidden">
              <CardTitle className="text-base xl:text-lg line-clamp-2 break-words">{metadata?.title || title}</CardTitle>
              <div className="flex flex-wrap items-center gap-1.5 xl:gap-2 mt-1 text-xs xl:text-sm text-muted-foreground">
                <span className="truncate max-w-[100px]">{category}</span>
                {metadata?.year && (
                  <span className="flex items-center gap-1 flex-shrink-0">
                    <Calendar className="w-3 h-3" />
                    {metadata.year}
                  </span>
                )}
                {metadata?.duration_minutes && (
                  <span className="flex items-center gap-1 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    {Math.floor(metadata.duration_minutes / 60)}h {metadata.duration_minutes % 60}min
                  </span>
                )}
              </div>
              {metadata?.genres && metadata.genres.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {metadata.genres.slice(0, 3).map((genre) => (
                    <Badge key={genre} variant="secondary" className="text-xs px-1.5 py-0">
                      {genre}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Connection Status */}
      <Card className="overflow-hidden">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Signal className="w-4 h-4 flex-shrink-0" />
            Status da Conexão
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' && (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-green-600 dark:text-green-400 font-medium text-sm">Conectado</span>
              </>
            )}
            {connectionStatus === 'connecting' && (
              <>
                <Wifi className="w-4 h-4 text-yellow-500 animate-pulse flex-shrink-0" />
                <span className="text-yellow-600 dark:text-yellow-400 font-medium text-sm">Conectando...</span>
              </>
            )}
            {connectionStatus === 'error' && (
              <>
                <WifiOff className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-red-600 dark:text-red-400 font-medium text-sm">Desconectado</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rating */}
      {rating && rating > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4 flex-shrink-0" />
              Avaliação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex items-center gap-2 xl:gap-3">
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "w-4 h-4 xl:w-5 xl:h-5",
                      i < Math.round(rating / 2)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
              <span className="text-base xl:text-lg font-bold">{rating.toFixed(1)}</span>
              <span className="text-xs xl:text-sm text-muted-foreground">/10</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Synopsis */}
      {metadata?.description && (
        <Card className="overflow-hidden">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0" />
              Sinopse
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-xs xl:text-sm text-muted-foreground leading-relaxed line-clamp-6 xl:line-clamp-none">
              {metadata.description}
            </p>
            {metadata.director && (
              <p className="text-xs xl:text-sm mt-2">
                <span className="text-muted-foreground">Diretor: </span>
                <span className="font-medium truncate">{metadata.director}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cast */}
      {metadata?.cast_members && metadata.cast_members.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 flex-shrink-0" />
              Elenco
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {metadata.cast_members.slice(0, 4).map((actor, index) => (
                <div key={index} className="flex items-center gap-2">
                  {actor.profile_url ? (
                    <img
                      src={actor.profile_url}
                      alt={actor.name}
                      className="w-8 h-8 rounded-full object-cover bg-muted flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div 
                    className={cn(
                      "w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0",
                      actor.profile_url && "hidden"
                    )}
                  >
                    {actor.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-xs xl:text-sm font-medium truncate">{actor.name}</p>
                    {actor.character && (
                      <p className="text-[10px] xl:text-xs text-muted-foreground truncate">
                        {actor.character}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading metadata */}
      {isLoadingMetadata && (
        <Card className="overflow-hidden">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              Carregando informações
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2 mt-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* No metadata fallback */}
      {!isLoadingMetadata && !metadata?.description && !rating && (!metadata?.cast_members || metadata.cast_members.length === 0) && (
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="text-center text-muted-foreground">
              <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs xl:text-sm">Informações do conteúdo não disponíveis</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">{streamInfo.type}</Badge>
                <Badge variant={streamInfo.isLive ? "destructive" : "secondary"} className="text-xs">
                  {streamInfo.isLive ? "Ao Vivo" : "VOD"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
