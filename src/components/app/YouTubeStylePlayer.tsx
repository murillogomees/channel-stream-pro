/**
 * YouTube-Style IPTV Player
 * Player com layout estilo YouTube: vídeo no topo + detalhes embaixo
 * 
 * OTIMIZAÇÕES DE PERFORMANCE:
 * - Web Worker Preloading para canais adjacentes
 * - Service Worker Cache para manifests e segments
 * - Buffer Adaptativo baseado em conexão
 * - Fast Startup com codec detection
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, 
  SkipBack, SkipForward, X, Radio, Film, Clock, Calendar,
  Signal, Wifi, WifiOff, RefreshCw, ChevronDown, ChevronUp,
  Heart, Share2, Info, AlertCircle, CheckCircle2, Star, Users, Loader2,
  Tv, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import { useMovieMetadata } from "@/features/player/hooks/useMovieMetadata";
import { usePlayerPerformance } from "@/hooks/usePlayerPerformance";
import { getOptimizedHlsConfig, getMpegtsConfig, detectConnectionQuality } from "@/config/playerBufferConfig";

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

interface SeriesEpisode {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo?: string;
  category_name?: string;
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
  // Series episodes
  seriesEpisodes?: SeriesEpisode[];
  onPlayEpisode?: (episode: SeriesEpisode) => void;
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
  seriesEpisodes = [],
  onPlayEpisode,
}: YouTubeStylePlayerProps) {
  // Unified Performance Hook
  const streamInfo = detectStreamType(url);
  const performance = usePlayerPerformance({ isLive: !streamInfo.isVod, enablePreload: true });
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [startupTime, setStartupTime] = useState<number>(0);
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
    if (!video || !video.src) return;
    if (video.paused) {
      if (video.readyState >= 2) {
        video.play().catch(() => {});
      }
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
        // Track playback start and record first frame for metrics
        if (!hasStartedPlayingRef.current) {
          hasStartedPlayingRef.current = true;
          performance.recordFirstFrame();
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

  // HLS Player initialization function - PERFORMANCE OPTIMIZED
  const initHlsPlayer = useCallback((streamUrl: string, video: HTMLVideoElement) => {
    // Start performance timing
    performance.startTiming();
    
    // Detect connection quality for adaptive config
    const connectionQuality = detectConnectionQuality();
    console.log(`[Player] Connection quality: ${connectionQuality}`);
    
    // Get optimized config based on connection quality
    const bufferConfig = getOptimizedHlsConfig(connectionQuality, streamInfo.isLive ? 'live' : 'vod');
    
    const hls = new Hls({
      ...bufferConfig,
      
      // Enable worker for better performance
      enableWorker: true,
      
      // Live stream infinity
      liveDurationInfinity: streamInfo.isLive,
    });
    hlsRef.current = hls;

    // Attach to adaptive buffer for monitoring
    performance.attachHls(hls, video);

    hls.loadSource(streamUrl);
    hls.attachMedia(video);
    
    // Track recovery attempts
    let networkRecoveryAttempts = 0;
    let mediaRecoveryAttempts = 0;
    const MAX_RECOVERY_ATTEMPTS = 8;
    
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      performance.recordManifestLoaded();
      setIsLoading(false);
      hasConnectedOnceRef.current = true;
      setConnectionStatus('connected');
      onReady?.();
      // Simple autoplay - let browser handle
      video.autoplay = autoplay;
      if (autoplay) {
        video.play().catch(() => { video.muted = true; });
      }
    });

    hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
      // Reset recovery counters on successful load
      networkRecoveryAttempts = 0;
      mediaRecoveryAttempts = 0;
      setStreamStats(prev => ({
        ...prev,
        bitrate: Math.round((data.details.totalduration * 8) / 1000),
      }));
    });
    
    // Buffer health monitoring
    hls.on(Hls.Events.FRAG_BUFFERED, () => {
      // Fragment buffered successfully - clear any error states
      if (hasConnectedOnceRef.current) {
        setIsBuffering(false);
      }
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      console.warn('[Player] HLS error:', data.type, data.details, data.fatal);
      
      // Non-fatal errors - let HLS handle automatically
      if (!data.fatal) {
        return;
      }
      
      // Fatal error handling with smart recovery
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          networkRecoveryAttempts++;
          if (networkRecoveryAttempts <= MAX_RECOVERY_ATTEMPTS) {
            console.log(`[Player] HLS network recovery attempt ${networkRecoveryAttempts}/${MAX_RECOVERY_ATTEMPTS}`);
            // Exponential backoff
            setTimeout(() => {
              hls.startLoad();
            }, Math.min(1000 * Math.pow(2, networkRecoveryAttempts - 1), 8000));
          } else {
            setHasError(true);
            setErrorMessage('Erro de rede - verifique sua conexão');
            setConnectionStatus('error');
            onError?.(data);
          }
          break;
          
        case Hls.ErrorTypes.MEDIA_ERROR:
          mediaRecoveryAttempts++;
          if (mediaRecoveryAttempts <= MAX_RECOVERY_ATTEMPTS) {
            console.log(`[Player] HLS media recovery attempt ${mediaRecoveryAttempts}/${MAX_RECOVERY_ATTEMPTS}`);
            if (mediaRecoveryAttempts === 1) {
              hls.recoverMediaError();
            } else {
              // Swap audio codec on subsequent attempts
              hls.swapAudioCodec();
              hls.recoverMediaError();
            }
          } else {
            setHasError(true);
            setErrorMessage('Erro de mídia - tente outro canal');
            setConnectionStatus('error');
            onError?.(data);
          }
          break;
          
        default:
          setHasError(true);
          setErrorMessage('Erro ao carregar stream');
          setConnectionStatus('error');
          onError?.(data);
          break;
      }
    });

    return () => {
      performance.detach();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [autoplay, onReady, onError, performance]);

  // Initialize player
  useEffect(() => {
    const video = videoRef.current;
    
    // Debug log
    console.log('[YouTubeStylePlayer] Initializing with URL:', url ? url.substring(0, 100) + '...' : 'EMPTY');
    
    if (!video || !url) {
      console.error('[YouTubeStylePlayer] Missing video element or URL', { hasVideo: !!video, hasUrl: !!url });
      setHasError(true);
      setErrorMessage('URL do stream não fornecida');
      setConnectionStatus('error');
      setIsLoading(false);
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      console.error('[YouTubeStylePlayer] Invalid URL:', url);
      setHasError(true);
      setErrorMessage('URL inválida');
      setConnectionStatus('error');
      setIsLoading(false);
      return;
    }

    // Reset connection state for new URL
    hasConnectedOnceRef.current = false;
    hasStartedPlayingRef.current = false;
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
      try {
        mpegtsRef.current.pause();
        mpegtsRef.current.unload();
        mpegtsRef.current.detachMediaElement();
        mpegtsRef.current.destroy();
      } catch (e) {
        console.warn('[Player] MPEGTS cleanup error:', e);
      }
      mpegtsRef.current = null;
    }

    const originalUrl = getOriginalUrl(url);
    const info = detectStreamType(originalUrl);
    
    // Global error handler for video element
    const handleVideoError = () => {
      const errorCode = video.error?.code || 0;
      const errorMessages: Record<number, string> = {
        1: 'Carregamento interrompido',
        2: 'Erro de rede - verifique sua conexão',
        3: 'Erro de decodificação - formato não suportado',
        4: 'Stream não encontrado ou inacessível',
      };
      console.error('[Player] Video error:', video.error, 'URL:', url.substring(0, 100));
      setHasError(true);
      setErrorMessage(errorMessages[errorCode] || 'Erro ao carregar stream');
      setConnectionStatus('error');
      setIsLoading(false);
    };
    video.addEventListener('error', handleVideoError);
    
    // Connection timeout - show error after 10 seconds if not connected
    const connectionTimeout = setTimeout(() => {
      if (!hasConnectedOnceRef.current) {
        console.warn('[Player] Connection timeout - still not connected after 10s');
        setHasError(true);
        setErrorMessage('Tempo limite de conexão excedido');
        setConnectionStatus('error');
        setIsLoading(false);
      }
    }, 10000);

    // VOD playback - Simplified for reliability
    if (info.isVod) {
      video.preload = 'auto';
      video.src = url;
      video.load();
      
      // Let autoplay attribute handle playback
      if (autoplay) {
        video.autoplay = true;
        video.muted = true; // Required for autoplay in most browsers
      }
      
      return () => {
        clearTimeout(connectionTimeout);
        video.removeEventListener('error', handleVideoError);
      };
    }

    // MPEG-TS live - PERFORMANCE OPTIMIZED
    if (info.type === 'MPEG-TS' && mpegts.isSupported()) {
      const connectionQuality = detectConnectionQuality();
      const mpegtsConfig = getMpegtsConfig(connectionQuality);
      
      const player = mpegts.createPlayer({
        type: 'mpegts',
        isLive: true,
        url: url,
      }, mpegtsConfig);
      
      mpegtsRef.current = player;
      player.attachMediaElement(video);
      player.load();
      
      // Connection timeout - 8 seconds before HLS fallback
      const connectionTimeout = setTimeout(() => {
        if (!hasConnectedOnceRef.current && mpegtsRef.current) {
          console.log('[Player] MPEGTS timeout (8s), trying HLS fallback...');
          try {
            player.pause();
            player.unload();
            player.detachMediaElement();
            player.destroy();
          } catch (e) {
            console.warn('[Player] MPEGTS cleanup error:', e);
          }
          mpegtsRef.current = null;
          
          // Fallback to HLS
          if (Hls.isSupported()) {
            initHlsPlayer(url, video);
          } else {
            video.src = url;
            video.autoplay = autoplay;
            video.muted = true;
            video.load();
          }
        }
      }, 8000);
      
      // Track network errors with exponential backoff
      let networkErrorCount = 0;
      let lastErrorTime = 0;
      const MAX_NETWORK_ERRORS = 8;        // More tolerance
      const ERROR_RESET_INTERVAL = 30000;  // Reset counter after 30s of success
      
      player.on(mpegts.Events.ERROR, (errorType, errorDetail) => {
        console.warn('[Player] MPEGTS error:', errorType, errorDetail);
        
        const now = Date.now();
        
        // Reset error count if sufficient time passed since last error
        if (now - lastErrorTime > ERROR_RESET_INTERVAL) {
          networkErrorCount = 0;
        }
        lastErrorTime = now;
        
        // NetworkError - intelligent recovery
        if (errorType === 'NetworkError' && mpegtsRef.current) {
          networkErrorCount++;
          
          // If we're already playing and connected, just let it buffer naturally
          if (hasConnectedOnceRef.current && !video.paused && video.readyState >= 2) {
            console.log(`[Player] Network hiccup ${networkErrorCount}, buffering... (readyState: ${video.readyState})`);
            setIsBuffering(true);
            return; // Don't restart - let mpegts.js recover
          }
          
          // Too many errors in quick succession - show error
          if (networkErrorCount >= MAX_NETWORK_ERRORS) {
            console.log('[Player] Too many network errors, showing retry option');
            clearTimeout(connectionTimeout);
            setHasError(true);
            setErrorMessage('Conexão instável - clique para tentar novamente');
            setConnectionStatus('error');
            return;
          }
          
          return; // Let mpegts handle recovery
        }
        
        // Other errors - only fatal if not yet connected
        if (!hasConnectedOnceRef.current) {
          clearTimeout(connectionTimeout);
          setHasError(true);
          setErrorMessage('Falha ao conectar - verifique o stream');
          setConnectionStatus('error');
          onError?.({ type: errorType, details: errorDetail });
        }
      });
      
      player.on(mpegts.Events.METADATA_ARRIVED, () => {
        clearTimeout(connectionTimeout);
        setIsLoading(false);
        setIsBuffering(false);
        hasConnectedOnceRef.current = true;
        setConnectionStatus('connected');
        networkErrorCount = 0; // Reset on successful metadata
        onReady?.();
        // Let video autoplay attribute handle playback
        video.autoplay = autoplay;
        if (autoplay) {
          video.play().catch(() => { video.muted = true; });
        }
      });
      
      // Additional event for tracking playback stability
      player.on(mpegts.Events.STATISTICS_INFO, () => {
        // Reset error counter on continuous successful playback
        if (hasConnectedOnceRef.current && !video.paused) {
          networkErrorCount = Math.max(0, networkErrorCount - 1);
        }
      });
      
      return () => {
        clearTimeout(connectionTimeout);
        if (mpegtsRef.current) {
          try {
            mpegtsRef.current.pause();
            mpegtsRef.current.unload();
            mpegtsRef.current.detachMediaElement();
            mpegtsRef.current.destroy();
          } catch (e) {
            console.warn('[Player] MPEGTS cleanup error:', e);
          }
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
    video.autoplay = autoplay;
    video.muted = true;
    video.load();
    
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
          {/* Video Container - Fixed aspect ratio, pillarbox for vertical content */}
          <div 
            ref={containerRef}
            className="relative bg-black aspect-video w-full max-w-full mx-auto lg:flex-1 lg:max-h-[calc(100vh-10rem)]"
            onMouseMove={resetUITimer}
            onClick={togglePlay}
          >
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-contain"
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
            <ScrollArea className="lg:hidden flex-1 min-h-0">
              <div className="p-4">
              <StreamDetailsPanel 
                  title={title}
                  category={category}
                  streamInfo={streamInfo}
                  connectionStatus={connectionStatus}
                  metadata={displayMetadata}
                  isLoadingMetadata={isLoadingMetadata}
                  seriesEpisodes={seriesEpisodes}
                  onPlayEpisode={onPlayEpisode}
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
                seriesEpisodes={seriesEpisodes}
                onPlayEpisode={onPlayEpisode}
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
  seriesEpisodes?: SeriesEpisode[];
  onPlayEpisode?: (episode: SeriesEpisode) => void;
}

// Helper to parse season/episode from name
function parseEpisodeInfo(name: string): { season: number; episode: number } | null {
  const match = name.match(/S(\d{1,2})[\s]*E(\d{1,3})/i) ||
               name.match(/(\d{1,2})x(\d{1,3})/i) ||
               name.match(/Temporada\s*(\d+).*?Ep[is]*[óo]*d?i?o?\s*(\d+)/i);
  if (match) {
    return { season: parseInt(match[1]), episode: parseInt(match[2]) };
  }
  return null;
}

function StreamDetailsPanel({ 
  title, 
  category, 
  logo,
  streamInfo, 
  connectionStatus,
  metadata,
  isLoadingMetadata,
  seriesEpisodes = [],
  onPlayEpisode,
}: StreamDetailsPanelProps) {
  const [selectedSeason, setSelectedSeason] = useState(1);
  const rating = metadata?.tmdb_rating || metadata?.imdb_rating;

  // Parse all episodes and extract seasons
  const { availableSeasons, episodesBySeason } = useMemo(() => {
    const episodeMap = new Map<number, Array<SeriesEpisode & { episodeNum: number }>>();
    const seasons = new Set<number>();

    seriesEpisodes.forEach(ep => {
      const info = parseEpisodeInfo(ep.name);
      if (info) {
        seasons.add(info.season);
        const existing = episodeMap.get(info.season) || [];
        existing.push({ ...ep, episodeNum: info.episode });
        episodeMap.set(info.season, existing);
      }
    });

    // Sort episodes within each season
    episodeMap.forEach((eps, season) => {
      episodeMap.set(season, eps.sort((a, b) => a.episodeNum - b.episodeNum));
    });

    return {
      availableSeasons: Array.from(seasons).sort((a, b) => a - b),
      episodesBySeason: episodeMap,
    };
  }, [seriesEpisodes]);

  // Auto-select first available season
  useEffect(() => {
    if (availableSeasons.length > 0 && !availableSeasons.includes(selectedSeason)) {
      setSelectedSeason(availableSeasons[0]);
    }
  }, [availableSeasons, selectedSeason]);

  const currentSeasonEpisodes = episodesBySeason.get(selectedSeason) || [];

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

      {/* Series Episodes */}
      {seriesEpisodes.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="p-3 pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Tv className="w-4 h-4 flex-shrink-0" />
                Episódios
              </CardTitle>
              {availableSeasons.length > 1 && (
                <Select 
                  value={String(selectedSeason)} 
                  onValueChange={(v) => setSelectedSeason(parseInt(v))}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Temporada" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSeasons.map((season) => (
                      <SelectItem key={season} value={String(season)}>
                        Temporada {season}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {availableSeasons.length === 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                Temporada {availableSeasons[0]} • {currentSeasonEpisodes.length} episódios
              </p>
            )}
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {currentSeasonEpisodes.length > 0 ? (
                currentSeasonEpisodes.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => onPlayEpisode?.(ep)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
                      <Play className="w-3 h-3 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">
                        Episódio {ep.episodeNum}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {ep.name}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhum episódio encontrado para esta temporada
                </p>
              )}
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
