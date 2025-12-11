/**
 * IPTV Player - Full-featured video player with HLS support
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { iptvService, IPTVChannel, PlaybackInfo } from '@/services/iptvService';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Settings, Loader2, RefreshCw, Info,
  Heart, List, ChevronUp, ChevronDown, AlertCircle, Tv
} from 'lucide-react';
import Hls from 'hls.js';

interface PlayerState {
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
  isControlsVisible: boolean;
  errorMessage: string | null;
  currentCdnIndex: number;
}

export default function IPTVPlayer() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    isMuted: false,
    isFullscreen: false,
    volume: 1,
    currentTime: 0,
    duration: 0,
    isBuffering: true,
    isControlsVisible: true,
    errorMessage: null,
    currentCdnIndex: 0,
  });

  const [showChannelList, setShowChannelList] = useState(false);

  // Fetch channel info
  const { data: channel, isLoading: isLoadingChannel } = useQuery({
    queryKey: ['iptv-channel', channelId],
    queryFn: () => iptvService.getChannel(Number(channelId)),
    enabled: !!channelId,
  });

  // Fetch playback URL
  const { data: playbackInfo, isLoading: isLoadingPlayback, refetch: refetchPlayback } = useQuery({
    queryKey: ['iptv-playback', channelId],
    queryFn: () => iptvService.getPlaybackUrl(Number(channelId)),
    enabled: !!channelId,
    staleTime: 30 * 60 * 1000, // 30 min
  });

  // Fetch all channels for navigation
  const { data: allChannels } = useQuery({
    queryKey: ['iptv-channels-nav'],
    queryFn: async () => {
      const { channels } = await iptvService.getChannels({ limit: 100 });
      return channels;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Initialize HLS player
  const initPlayer = useCallback((url: string) => {
    const video = videoRef.current;
    if (!video) return;

    // Cleanup existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setState(prev => ({ ...prev, isBuffering: true, errorMessage: null }));

    // Check if HLS.js is supported
    if (Hls.isSupported() && (url.includes('.m3u8') || url.includes('m3u'))) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        enableWorker: true,
        lowLatencyMode: false,
        startLevel: -1, // Auto quality
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(console.error);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('[HLS] Network error');
              handleCdnFallback();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('[HLS] Media error, attempting recovery');
              hls.recoverMediaError();
              break;
            default:
              setState(prev => ({ ...prev, errorMessage: 'Erro ao reproduzir' }));
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = url;
      video.play().catch(console.error);
    } else {
      // Direct video URL
      video.src = url;
      video.play().catch(console.error);
    }
  }, []);

  // CDN Fallback
  const handleCdnFallback = useCallback(() => {
    if (!playbackInfo?.cdnList) return;
    
    const nextIndex = state.currentCdnIndex + 1;
    if (nextIndex < playbackInfo.cdnList.length) {
      setState(prev => ({ ...prev, currentCdnIndex: nextIndex }));
      const nextUrl = playbackInfo.cdnList[nextIndex].url;
      toast.info('Tentando servidor alternativo...');
      initPlayer(nextUrl);
    } else {
      setState(prev => ({ ...prev, errorMessage: 'Não foi possível reproduzir o canal' }));
    }
  }, [playbackInfo, state.currentCdnIndex, initPlayer]);

  // Initialize player when playback URL changes
  useEffect(() => {
    if (playbackInfo?.url) {
      initPlayer(playbackInfo.url);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playbackInfo?.url, initPlayer]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setState(prev => ({ ...prev, isPlaying: true }));
    const handlePause = () => setState(prev => ({ ...prev, isPlaying: false }));
    const handleWaiting = () => setState(prev => ({ ...prev, isBuffering: true }));
    const handlePlaying = () => setState(prev => ({ ...prev, isBuffering: false }));
    const handleTimeUpdate = () => {
      setState(prev => ({ 
        ...prev, 
        currentTime: video.currentTime,
        duration: video.duration || 0,
      }));
    };
    const handleError = () => {
      setState(prev => ({ ...prev, errorMessage: 'Erro ao reproduzir' }));
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
    };
  }, []);

  // Controls visibility
  const showControls = useCallback(() => {
    setState(prev => ({ ...prev, isControlsVisible: true }));
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (state.isPlaying) {
        setState(prev => ({ ...prev, isControlsVisible: false }));
      }
    }, 3000);
  }, [state.isPlaying]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      showControls();
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          toggleMute();
          break;
        case 'ArrowLeft':
          seek(-10);
          break;
        case 'ArrowRight':
          seek(10);
          break;
        case 'ArrowUp':
          adjustVolume(0.1);
          break;
        case 'ArrowDown':
          adjustVolume(-0.1);
          break;
        case 'Escape':
          if (state.isFullscreen) toggleFullscreen();
          else navigate(-1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showControls, state.isFullscreen]);

  // Player controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (state.isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !state.isMuted;
      setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setState(prev => ({ ...prev, isFullscreen: true }));
      } else {
        await document.exitFullscreen();
        setState(prev => ({ ...prev, isFullscreen: false }));
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const seek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  const adjustVolume = (delta: number) => {
    if (videoRef.current) {
      const newVolume = Math.max(0, Math.min(1, state.volume + delta));
      videoRef.current.volume = newVolume;
      setState(prev => ({ ...prev, volume: newVolume }));
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setState(prev => ({ ...prev, volume: newVolume, isMuted: newVolume === 0 }));
    }
  };

  // Navigate channels
  const navigateChannel = (direction: 'prev' | 'next') => {
    if (!allChannels || !channelId) return;
    const currentIndex = allChannels.findIndex(c => c.id === Number(channelId));
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'next' 
      ? (currentIndex + 1) % allChannels.length
      : (currentIndex - 1 + allChannels.length) % allChannels.length;
    
    navigate(`/app/player/${allChannels[newIndex].id}`, { replace: true });
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoadingChannel || isLoadingPlayback) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-white">Conectando ao canal...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative min-h-screen bg-black select-none"
      onMouseMove={showControls}
      onClick={() => showControls()}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain"
        playsInline
        autoPlay
        onClick={togglePlay}
      />

      {/* Buffering Indicator */}
      {state.isBuffering && !state.errorMessage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      )}

      {/* Error Message */}
      {state.errorMessage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center space-y-4">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
            <p className="text-white text-lg">{state.errorMessage}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => refetchPlayback()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)}>
                Voltar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div className={cn(
        "absolute inset-0 transition-opacity duration-300",
        state.isControlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/20">
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <div>
                <h1 className="text-white text-lg font-semibold">{channel?.name || 'Carregando...'}</h1>
                {channel?.category && (
                  <p className="text-white/60 text-sm">{channel.category}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                <Heart className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/20"
                onClick={() => setShowChannelList(!showChannelList)}
              >
                <List className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Center Controls */}
        <div className="absolute inset-0 flex items-center justify-center gap-8">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-14 w-14 text-white hover:bg-white/20"
            onClick={() => navigateChannel('prev')}
          >
            <SkipBack className="h-8 w-8" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-20 w-20 text-white hover:bg-white/20 bg-white/10 rounded-full"
            onClick={togglePlay}
          >
            {state.isPlaying ? (
              <Pause className="h-10 w-10" />
            ) : (
              <Play className="h-10 w-10 ml-1" />
            )}
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-14 w-14 text-white hover:bg-white/20"
            onClick={() => navigateChannel('next')}
          >
            <SkipForward className="h-8 w-8" />
          </Button>
        </div>

        {/* Bottom Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          {/* Progress Bar (for VOD) */}
          {state.duration > 0 && !isNaN(state.duration) && (
            <div className="mb-4">
              <Slider
                value={[state.currentTime]}
                max={state.duration}
                step={1}
                onValueChange={(value) => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = value[0];
                  }
                }}
                className="w-full"
              />
              <div className="flex justify-between text-white/60 text-sm mt-1">
                <span>{formatTime(state.currentTime)}</span>
                <span>{formatTime(state.duration)}</span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white hover:bg-white/20">
                {state.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              
              <div className="flex items-center gap-2 group">
                <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/20">
                  {state.isMuted || state.volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
                <div className="w-0 group-hover:w-24 overflow-hidden transition-all duration-200">
                  <Slider
                    value={[state.isMuted ? 0 : state.volume]}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                  />
                </div>
              </div>

              {channel?.content_type === 'live' && (
                <div className="flex items-center gap-1 text-red-500">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-medium">AO VIVO</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                <Settings className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/20">
                {state.isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Channel List Sidebar */}
      {showChannelList && (
        <div className="absolute top-0 right-0 bottom-0 w-80 bg-background/95 backdrop-blur-sm border-l overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">Canais</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowChannelList(false)}>
              <ChevronDown className="h-5 w-5" />
            </Button>
          </div>
          <div className="h-full overflow-y-auto pb-20">
            {allChannels?.map((ch) => (
              <button
                key={ch.id}
                className={cn(
                  "w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left",
                  ch.id === Number(channelId) && "bg-primary/10 border-l-2 border-primary"
                )}
                onClick={() => navigate(`/app/player/${ch.id}`, { replace: true })}
              >
                {ch.logo_url ? (
                  <img src={ch.logo_url} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                    <Tv className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{ch.name}</p>
                  {ch.category && (
                    <p className="text-sm text-muted-foreground truncate">{ch.category}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
