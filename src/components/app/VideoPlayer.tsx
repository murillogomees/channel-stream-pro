import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Volume2, VolumeX, Maximize, Minimize, AlertCircle, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';

interface VideoPlayerProps {
  url: string;
  title: string;
  logo?: string;
  onError?: (error: string) => void;
  onReady?: () => void;
  className?: string;
}

type StreamType = 'hls' | 'flv' | 'ts' | 'mp4' | 'unknown';

function detectStreamType(url: string): StreamType {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('.m3u8') || urlLower.includes('.m3u')) return 'hls';
  if (urlLower.includes('.flv')) return 'flv';
  if (urlLower.includes('.ts')) return 'ts';
  if (urlLower.includes('.mp4')) return 'mp4';
  
  // Xtream Codes live streams are usually TS
  if (/\/live\/[^\/]+\/[^\/]+\/\d+/.test(urlLower)) return 'ts';
  if (/\/[^\/]+\/[^\/]+\/\d+$/.test(urlLower)) return 'ts';
  
  return 'unknown';
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
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [needsManualPlay, setNeedsManualPlay] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Conectando...');
  const retryCount = useRef(0);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      mpegtsRef.current.destroy();
      mpegtsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.src = '';
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
      setIsLoading(false);
    } catch {
      setHasError(true);
      setErrorMessage('Não foi possível iniciar');
    }
  }, []);

  const showError = useCallback((msg: string) => {
    setHasError(true);
    setErrorMessage(msg);
    setIsLoading(false);
    onError?.(msg);
  }, [onError]);

  const initPlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    const streamType = detectStreamType(url);
    console.log(`[VideoPlayer] Type: ${streamType}, URL: ${url.substring(0, 80)}`);
    
    setIsLoading(true);
    setHasError(false);
    setNeedsManualPlay(false);
    setLoadingStatus('Conectando...');
    cleanup();

    // Timeout de 20 segundos
    timeoutRef.current = setTimeout(() => {
      console.log('[VideoPlayer] Timeout - trying fallback');
      if (isLoading) {
        retryCount.current++;
        if (retryCount.current < 3) {
          setLoadingStatus(`Tentativa ${retryCount.current + 1}...`);
          cleanup();
          setTimeout(initPlayer, 1000);
        } else {
          showError('Stream não respondeu. Tente outro canal.');
        }
      }
    }, 20000);

    // MPEG-TS / FLV streams (use mpegts.js)
    if ((streamType === 'ts' || streamType === 'flv' || streamType === 'unknown') && mpegts.isSupported()) {
      console.log('[VideoPlayer] Using mpegts.js');
      setLoadingStatus('Carregando stream...');
      
      const player = mpegts.createPlayer({
        type: streamType === 'flv' ? 'flv' : 'mpegts',
        isLive: true,
        url: url,
      }, {
        enableWorker: true,
        enableStashBuffer: false,
        stashInitialSize: 128,
        lazyLoad: false,
        lazyLoadMaxDuration: 0,
        deferLoadAfterSourceOpen: false,
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 30,
        autoCleanupMinBackwardDuration: 15,
      });

      mpegtsRef.current = player;
      player.attachMediaElement(video);
      player.load();

      player.on(mpegts.Events.LOADING_COMPLETE, () => {
        console.log('[VideoPlayer] mpegts loading complete');
      });

      player.on(mpegts.Events.METADATA_ARRIVED, () => {
        console.log('[VideoPlayer] mpegts metadata arrived');
        setLoadingStatus('Iniciando reprodução...');
      });

      player.on(mpegts.Events.ERROR, (errorType, errorDetail) => {
        console.error('[VideoPlayer] mpegts error:', errorType, errorDetail);
        if (retryCount.current < 2) {
          retryCount.current++;
          cleanup();
          setTimeout(initPlayer, 1500);
        } else {
          showError('Erro ao carregar stream');
        }
      });

      video.oncanplay = () => {
        console.log('[VideoPlayer] mpegts can play');
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsLoading(false);
        attemptPlay();
        onReady?.();
      };

      video.onplaying = () => {
        setIsLoading(false);
        setNeedsManualPlay(false);
      };

      return;
    }

    // HLS streams
    if (streamType === 'hls') {
      if (Hls.isSupported()) {
        console.log('[VideoPlayer] Using HLS.js');
        setLoadingStatus('Carregando manifesto...');
        
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          startLevel: 0,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          manifestLoadingTimeOut: 15000,
          fragLoadingTimeOut: 20000,
          levelLoadingTimeOut: 15000,
        });

        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('[VideoPlayer] HLS manifest ready');
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setLoadingStatus('Iniciando...');
          setIsLoading(false);
          attemptPlay();
          onReady?.();
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          setIsLoading(false);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) return;
          
          console.error('[VideoPlayer] HLS error:', data.type, data.details);
          
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retryCount.current < 2) {
            retryCount.current++;
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            showError('Erro no stream HLS');
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        console.log('[VideoPlayer] Native HLS (Safari)');
        video.src = url;
        
        video.onloadedmetadata = () => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setIsLoading(false);
          attemptPlay();
          onReady?.();
        };
        
        video.onerror = () => showError('Erro ao carregar HLS');
        video.load();
      }
      return;
    }

    // MP4 / Direct video
    if (streamType === 'mp4') {
      console.log('[VideoPlayer] Direct MP4 playback');
      setLoadingStatus('Carregando vídeo...');
      video.src = url;
      
      video.onloadeddata = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsLoading(false);
        attemptPlay();
        onReady?.();
      };
      
      video.onerror = () => {
        if (retryCount.current < 2) {
          retryCount.current++;
          setTimeout(() => video.load(), 1500);
        } else {
          showError('Erro ao carregar vídeo');
        }
      };
      
      video.oncanplay = () => setIsLoading(false);
      video.onplaying = () => { setIsLoading(false); setNeedsManualPlay(false); };
      video.load();
    }
  }, [url, cleanup, attemptPlay, onReady, showError, isLoading]);

  useEffect(() => {
    retryCount.current = 0;
    initPlayer();
    return cleanup;
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <p className="text-white text-sm">{loadingStatus}</p>
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
