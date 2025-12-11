/**
 * LL-HLS Player with Fallback Support
 * Low Latency HLS streaming with automatic quality adaptation and error recovery
 */

import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import Hls from 'hls.js';
import { useLowLatencyMode } from '@/hooks/useLowLatencyMode';
import { usePlayerErrorRecovery } from '@/hooks/usePlayerErrorRecovery';
import { useAdaptiveBuffer } from '@/hooks/useAdaptiveBuffer';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LLHLSPlayerProps {
  url: string;
  fallbackUrls?: string[];
  title?: string;
  logo?: string;
  autoPlay?: boolean;
  lowLatency?: boolean;
  onError?: (error: string) => void;
  onReady?: () => void;
  onQualityChange?: (quality: string) => void;
  className?: string;
}

const LL_HLS_CONFIG: Partial<Hls['config']> = {
  // LL-HLS specific settings
  lowLatencyMode: true,
  backBufferLength: 30,
  maxBufferLength: 10,
  maxMaxBufferLength: 20,
  maxBufferSize: 30 * 1000 * 1000,
  maxBufferHole: 0.3,
  
  // Fast startup
  startLevel: -1,
  autoStartLoad: true,
  
  // ABR tuning for low latency
  abrEwmaDefaultEstimate: 1000000,
  abrBandWidthFactor: 0.9,
  abrBandWidthUpFactor: 0.7,
  
  // Live sync for low latency
  liveSyncDurationCount: 2,
  liveMaxLatencyDurationCount: 4,
  liveDurationInfinity: true,
  
  // Error recovery
  fragLoadingMaxRetry: 4,
  manifestLoadingMaxRetry: 4,
  levelLoadingMaxRetry: 4,
  fragLoadingRetryDelay: 500,
  manifestLoadingRetryDelay: 500,
  
  // Timeouts
  fragLoadingTimeOut: 10000,
  manifestLoadingTimeOut: 8000,
  levelLoadingTimeOut: 8000,
};

const STANDARD_HLS_CONFIG: Partial<Hls['config']> = {
  lowLatencyMode: false,
  backBufferLength: 60,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  startLevel: -1,
  autoStartLoad: true,
  fragLoadingMaxRetry: 6,
  manifestLoadingMaxRetry: 6,
  fragLoadingRetryDelay: 1000,
};

export const LLHLSPlayer = memo(function LLHLSPlayer({
  url,
  fallbackUrls = [],
  title,
  logo,
  autoPlay = true,
  lowLatency = true,
  onError,
  onReady,
  onQualityChange,
  className,
}: LLHLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentUrlIndexRef = useRef(0);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuality, setCurrentQuality] = useState<string>('Auto');
  const [showControls, setShowControls] = useState(true);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isLLHLS, setIsLLHLS] = useState(lowLatency);
  
  const allUrls = [url, ...fallbackUrls];
  
  // Hooks
  const { 
    isEnabled: llEnabled, 
    stats: latencyStats, 
    attachHls, 
    attachVideo,
    getLowLatencyConfig,
    jumpToLive,
  } = useLowLatencyMode({ targetLatency: 2000 });
  
  const { 
    handleHlsError, 
    handleVideoError, 
    resetStats: resetErrorStats,
  } = usePlayerErrorRecovery({
    maxNetworkRetries: 3,
    maxMediaRetries: 2,
    onFatalError: () => {
      tryNextUrl();
    },
    onFallback: () => {
      // Switch to standard HLS mode
      setIsLLHLS(false);
      reinitializePlayer();
    },
  });
  
  const { 
    getHlsConfig: getAdaptiveConfig, 
    attachHls: attachAdaptiveBuffer,
    attachVideo: attachAdaptiveVideo,
  } = useAdaptiveBuffer({ isLive: true });
  
  const tryNextUrl = useCallback(() => {
    const nextIndex = currentUrlIndexRef.current + 1;
    if (nextIndex < allUrls.length) {
      console.log(`[LLHLSPlayer] Trying fallback URL ${nextIndex + 1}/${allUrls.length}`);
      currentUrlIndexRef.current = nextIndex;
      reinitializePlayer();
    } else {
      const errorMsg = 'All stream sources failed';
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [allUrls.length, onError]);
  
  const reinitializePlayer = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setError(null);
    setIsLoading(true);
    resetErrorStats();
    initializePlayer();
  }, []);
  
  const initializePlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const currentUrl = allUrls[currentUrlIndexRef.current];
    if (!currentUrl) return;
    
    console.log(`[LLHLSPlayer] Initializing with URL: ${currentUrl}, LL-HLS: ${isLLHLS}`);
    
    // Check if HLS is supported
    if (!Hls.isSupported()) {
      // Try native playback
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = currentUrl;
        video.load();
        if (autoPlay) {
          video.play().catch(() => setIsMuted(true));
        }
        return;
      }
      setError('HLS not supported in this browser');
      onError?.('HLS not supported');
      return;
    }
    
    // Create HLS config based on mode
    const baseConfig = isLLHLS ? LL_HLS_CONFIG : STANDARD_HLS_CONFIG;
    const adaptiveConfig = getAdaptiveConfig;
    const llConfig = isLLHLS ? getLowLatencyConfig() : {};
    
    const config: Partial<Hls['config']> = {
      ...baseConfig,
      ...adaptiveConfig,
      ...llConfig,
      debug: false,
    };
    
    const hls = new Hls(config);
    hlsRef.current = hls;
    
    // Attach to optimization hooks
    if (isLLHLS) {
      attachHls(hls);
    }
    attachAdaptiveBuffer(hls);
    
    // Event handlers
    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      console.log(`[LLHLSPlayer] Manifest parsed, ${data.levels.length} quality levels`);
      setIsLoading(false);
      onReady?.();
      
      if (autoPlay) {
        video.play().catch(() => {
          setIsMuted(true);
          video.muted = true;
          video.play();
        });
      }
    });
    
    hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
      const level = hls.levels[data.level];
      const quality = level ? `${level.height}p` : 'Auto';
      setCurrentQuality(quality);
      onQualityChange?.(quality);
    });
    
    hls.on(Hls.Events.ERROR, (_, data) => {
      console.error('[LLHLSPlayer] HLS Error:', data.type, data.details);
      handleHlsError(hls, {
        type: data.type,
        details: data.details,
        fatal: data.fatal,
        response: data.response ? { code: data.response.code ?? 0 } : undefined,
      });
      
      if (data.fatal) {
        setIsLoading(false);
      }
    });
    
    hls.on(Hls.Events.FRAG_LOADED, () => {
      // Update latency for LL-HLS
      if (isLLHLS && hls.latency !== undefined) {
        setLatencyMs(Math.round(hls.latency * 1000));
      }
    });
    
    // Load source
    hls.loadSource(currentUrl);
    hls.attachMedia(video);
    
    // Attach video to hooks
    if (isLLHLS) {
      attachVideo(video);
    }
    attachAdaptiveVideo(video);
    
  }, [allUrls, isLLHLS, autoPlay, getAdaptiveConfig, getLowLatencyConfig, attachHls, attachVideo, attachAdaptiveBuffer, attachAdaptiveVideo, handleHlsError, onError, onReady, onQualityChange]);
  
  // Initialize on mount or URL change
  useEffect(() => {
    currentUrlIndexRef.current = 0;
    initializePlayer();
    
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [url]);
  
  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);
    const onVideoError = () => handleVideoError(video, reinitializePlayer);
    
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onVideoError);
    
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onVideoError);
    };
  }, [handleVideoError, reinitializePlayer]);
  
  // Controls visibility
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('touchstart', handleMouseMove);
    }
    
    return () => {
      clearTimeout(timeout);
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('touchstart', handleMouseMove);
      }
    };
  }, []);
  
  // Control functions
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play();
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
  
  const toggleFullscreen = useCallback(async () => {
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
  }, []);
  
  const handleRetry = useCallback(() => {
    currentUrlIndexRef.current = 0;
    setIsLLHLS(lowLatency);
    reinitializePlayer();
  }, [lowLatency, reinitializePlayer]);
  
  const handleJumpToLive = useCallback(() => {
    if (isLLHLS) {
      jumpToLive();
    } else {
      const video = videoRef.current;
      if (video && video.duration) {
        video.currentTime = video.duration - 1;
      }
    }
  }, [isLLHLS, jumpToLive]);
  
  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full h-full bg-black overflow-hidden group",
        className
      )}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        muted={isMuted}
        autoPlay={autoPlay}
      />
      
      {/* Loading Overlay */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
          {logo && (
            <img src={logo} alt="" className="w-16 h-16 object-contain mb-4 animate-pulse" />
          )}
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          {title && (
            <p className="mt-4 text-white text-sm">{title}</p>
          )}
        </div>
      )}
      
      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
          <WifiOff className="w-12 h-12 text-destructive mb-4" />
          <p className="text-white text-lg mb-2">Stream Error</p>
          <p className="text-muted-foreground text-sm mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}
      
      {/* Controls Overlay */}
      <div 
        className={cn(
          "absolute inset-0 flex flex-col justify-between transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Top Bar */}
        <div className="p-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logo && (
                <img src={logo} alt="" className="w-8 h-8 object-contain" />
              )}
              {title && (
                <span className="text-white font-medium">{title}</span>
              )}
            </div>
            
            {/* Status Indicators */}
            <div className="flex items-center gap-2">
              {isLLHLS && latencyMs !== null && (
                <div className="flex items-center gap-1 px-2 py-1 bg-red-500/80 rounded text-white text-xs">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  LIVE {latencyMs}ms
                </div>
              )}
              <div className="flex items-center gap-1 px-2 py-1 bg-black/50 rounded text-white text-xs">
                <Settings className="w-3 h-3" />
                {currentQuality}
              </div>
              {isLLHLS ? (
                <div className="flex items-center gap-1 px-2 py-1 bg-green-500/80 rounded text-white text-xs">
                  <Wifi className="w-3 h-3" />
                  LL-HLS
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/80 rounded text-white text-xs">
                  <Wifi className="w-3 h-3" />
                  HLS
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Center Play Button */}
        {!isPlaying && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={togglePlay}
              className="w-20 h-20 flex items-center justify-center bg-primary/80 rounded-full hover:bg-primary transition-colors"
            >
              <Play className="w-10 h-10 text-primary-foreground ml-1" />
            </button>
          </div>
        )}
        
        {/* Bottom Controls */}
        <div className="p-4 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="p-2 text-white hover:text-primary transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </button>
              
              <button
                onClick={toggleMute}
                className="p-2 text-white hover:text-primary transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-6 h-6" />
                ) : (
                  <Volume2 className="w-6 h-6" />
                )}
              </button>
              
              <button
                onClick={handleJumpToLive}
                className="px-3 py-1 text-xs bg-red-500/80 text-white rounded hover:bg-red-500 transition-colors"
              >
                LIVE
              </button>
            </div>
            
            <button
              onClick={toggleFullscreen}
              className="p-2 text-white hover:text-primary transition-colors"
            >
              {isFullscreen ? (
                <Minimize className="w-6 h-6" />
              ) : (
                <Maximize className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default LLHLSPlayer;
