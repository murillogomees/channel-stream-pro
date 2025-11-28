/**
 * YouTube-Style IPTV Player
 * Player com layout estilo YouTube: vídeo no topo + detalhes embaixo
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, 
  SkipBack, SkipForward, Settings, X, Tv, Radio, Film,
  Clock, Signal, Wifi, WifiOff, RefreshCw, ChevronDown, ChevronUp,
  Heart, Share2, Info, AlertCircle, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import Hls from "hls.js";
import mpegts from "mpegts.js";

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

  // Detect stream info
  const streamInfo = detectStreamType(url);

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

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlers = {
      play: () => setIsPlaying(true),
      pause: () => setIsPlaying(false),
      waiting: () => setIsLoading(true),
      canplay: () => {
        setIsLoading(false);
        setConnectionStatus('connected');
      },
      playing: () => {
        setIsLoading(false);
        setIsPlaying(true);
        setHasError(false);
        setConnectionStatus('connected');
      },
      timeupdate: () => {
        setCurrentTime(video.currentTime);
        if (video.buffered.length > 0) {
          setBuffered(video.buffered.end(video.buffered.length - 1));
        }
      },
      durationchange: () => setDuration(video.duration),
      loadedmetadata: () => {
        setDuration(video.duration);
        setStreamStats(prev => ({
          ...prev,
          resolution: `${video.videoWidth}x${video.videoHeight}`,
        }));
      },
      error: () => {
        setIsLoading(false);
        setConnectionStatus('error');
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      video.addEventListener(event, handler);
    });

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        video.removeEventListener(event, handler);
      });
    };
  }, []);

  // Initialize player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    setIsLoading(true);
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

    // VOD playback
    if (info.isVod) {
      video.src = url;
      video.load();
      if (autoplay) video.play().catch(console.warn);
      return;
    }

    // MPEG-TS live
    if (info.type === 'MPEG-TS' && mpegts.isSupported()) {
      const player = mpegts.createPlayer({
        type: 'mpegts',
        isLive: true,
        url: url,
      }, {
        enableWorker: true,
        liveBufferLatencyChasing: true,
        liveSync: true,
      });
      
      mpegtsRef.current = player;
      player.attachMediaElement(video);
      player.load();
      
      player.on(mpegts.Events.ERROR, (errorType, errorDetail) => {
        console.error('[Player] MPEGTS error:', errorType, errorDetail);
        setHasError(true);
        setErrorMessage('Falha na conexão com o stream');
        setConnectionStatus('error');
        onError?.({ type: errorType, details: errorDetail });
      });
      
      player.on(mpegts.Events.METADATA_ARRIVED, () => {
        setIsLoading(false);
        setConnectionStatus('connected');
        onReady?.();
        if (autoplay) video.play().catch(console.warn);
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

    // HLS playback
    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
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
        if (data.fatal) {
          setHasError(true);
          setErrorMessage('Erro ao carregar stream');
          setConnectionStatus('error');
          onError?.(data);
        }
      });

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }

    // Native HLS fallback
    video.src = url;
    video.load();
    if (autoplay) video.play().catch(console.warn);
  }, [url, autoplay, onReady, onError]);

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

            {/* Loading Overlay */}
            {isLoading && !hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span className="text-white/70 text-sm">Conectando...</span>
                </div>
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
            <ScrollArea className="lg:hidden flex-1 p-4">
              <StreamDetailsPanel 
                title={title}
                category={category}
                streamInfo={streamInfo}
                streamStats={streamStats}
                connectionStatus={connectionStatus}
                url={originalUrl}
              />
            </ScrollArea>
          )}
        </div>

        {/* Details Sidebar - Desktop */}
        <aside className="hidden lg:flex w-[380px] border-l border-border flex-col bg-muted/30">
          <ScrollArea className="flex-1">
            <div className="p-4">
              <StreamDetailsPanel 
                title={title}
                category={category}
                logo={logo}
                streamInfo={streamInfo}
                streamStats={streamStats}
                connectionStatus={connectionStatus}
                url={originalUrl}
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
  streamStats: { bitrate: number; resolution: string; codec: string; fps: number };
  connectionStatus: 'connected' | 'connecting' | 'error';
  url: string;
}

function StreamDetailsPanel({ 
  title, 
  category, 
  logo,
  streamInfo, 
  streamStats, 
  connectionStatus,
  url 
}: StreamDetailsPanelProps) {
  const [showFullUrl, setShowFullUrl] = useState(false);

  return (
    <div className="space-y-4">
      {/* Channel Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            {logo && (
              <img 
                src={logo} 
                alt="" 
                className="w-16 h-16 rounded-lg object-contain bg-muted"
                onError={(e) => e.currentTarget.style.display = 'none'}
              />
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-2">{title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{category}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Signal className="w-4 h-4" />
            Status da Conexão
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' && (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-green-600 dark:text-green-400 font-medium">Conectado</span>
              </>
            )}
            {connectionStatus === 'connecting' && (
              <>
                <Wifi className="w-5 h-5 text-yellow-500 animate-pulse" />
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">Conectando...</span>
              </>
            )}
            {connectionStatus === 'error' && (
              <>
                <WifiOff className="w-5 h-5 text-red-500" />
                <span className="text-red-600 dark:text-red-400 font-medium">Desconectado</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stream Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Tv className="w-4 h-4" />
            Informações do Stream
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">Tipo</p>
              <Badge variant="outline">{streamInfo.type}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Modo</p>
              <Badge variant={streamInfo.isLive ? "destructive" : "secondary"}>
                {streamInfo.isLive ? "Ao Vivo" : "VOD"}
              </Badge>
            </div>
            {streamStats.resolution && (
              <div className="space-y-1">
                <p className="text-muted-foreground">Resolução</p>
                <p className="font-medium">{streamStats.resolution}</p>
              </div>
            )}
            {streamStats.bitrate > 0 && (
              <div className="space-y-1">
                <p className="text-muted-foreground">Bitrate</p>
                <p className="font-medium">{streamStats.bitrate} kbps</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Detalhes Técnicos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Protocolo</span>
              <span className="font-medium">{streamInfo.isHls ? 'HLS' : streamInfo.isLive ? 'MPEG-TS' : 'HTTP Progressive'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Player</span>
              <span className="font-medium">
                {streamInfo.isLive ? 'mpegts.js' : streamInfo.isHls ? 'hls.js' : 'Native'}
              </span>
            </div>
            <Separator />
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">URL do Stream</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowFullUrl(!showFullUrl)}
                >
                  {showFullUrl ? 'Ocultar' : 'Mostrar'}
                </Button>
              </div>
              {showFullUrl && (
                <code className="block text-xs bg-muted p-2 rounded-md break-all text-muted-foreground">
                  {url}
                </code>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Atalhos de Teclado
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Espaço</kbd>
              <span className="text-muted-foreground">Play/Pause</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F</kbd>
              <span className="text-muted-foreground">Tela cheia</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">M</kbd>
              <span className="text-muted-foreground">Mudo</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">ESC</kbd>
              <span className="text-muted-foreground">Sair</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">← →</kbd>
              <span className="text-muted-foreground">±10s</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
