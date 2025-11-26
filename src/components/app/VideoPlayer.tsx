import { useEffect, useRef, useState } from 'react';
import { Loader2, Volume2, VolumeX, Maximize, Minimize, AlertCircle } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');

    let hls: Hls | null = null;

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = (e: Event) => {
      setIsLoading(false);
      setHasError(true);
      
      let errorMsg = 'Erro ao carregar o canal';
      
      if (video.error) {
        switch (video.error.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            errorMsg = 'Erro de conexão. Verifique sua internet.';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMsg = 'Erro ao decodificar o vídeo.';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMsg = 'Formato de vídeo não suportado.';
            break;
          case MediaError.MEDIA_ERR_ABORTED:
            errorMsg = 'Reprodução cancelada.';
            break;
        }
      }
      
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      onError?.(errorMsg);
    };

    // Check if stream is HLS
    const isHLS = url.includes('.m3u8') || url.includes('application/x-mpegURL') || url.includes('stream-proxy');

    if (isHLS && Hls.isSupported()) {
      // Get auth token for stream proxy (must be done before HLS setup)
      const initHLS = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';

        // Use HLS.js with custom loader for auth headers
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          xhrSetup: (xhr, url) => {
            if (token) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
          },
        });

        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          video.play().catch(err => {
            console.error('Autoplay prevented:', err);
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            setHasError(true);
            setIsLoading(false);
            
            let errorMsg = 'Erro ao carregar stream HLS';
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                errorMsg = 'Erro de rede ao carregar stream';
                hls?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                errorMsg = 'Erro de mídia ao reproduzir';
                hls?.recoverMediaError();
                break;
              default:
                errorMsg = 'Erro fatal no player';
                break;
            }
            
            setErrorMessage(errorMsg);
            toast.error(errorMsg);
            onError?.(errorMsg);
          }
        });
      };

      initHLS();
    } else if (isHLS && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(err => {
          console.error('Autoplay prevented:', err);
        });
      });
    } else {
      // Standard video source
      video.src = url;
    }

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      
      if (hls) {
        hls.destroy();
      }
    };
  }, [url, onError]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await videoRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleRetry = () => {
    if (videoRef.current) {
      setHasError(false);
      setErrorMessage('');
      setIsLoading(true);
      videoRef.current.load();
      videoRef.current.play();
    }
  };

  return (
    <div className={`relative bg-black aspect-video ${className}`}>
      {/* Channel Info Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center gap-3">
          {logo && (
            <img 
              src={logo} 
              alt={title}
              className="w-12 h-12 object-contain rounded bg-white/10"
            />
          )}
          <h2 className="text-white font-semibold text-lg">{title}</h2>
        </div>
      </div>

      {/* Video Element */}
      <video
        ref={videoRef}
        src={url}
        autoPlay
        playsInline
        className="w-full h-full"
        controls={false}
      />

      {/* Loading State */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-white" />
          <p className="text-white text-sm">Carregando stream...</p>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-4">
          <AlertCircle className="w-16 h-16 text-red-500" />
          <p className="text-xl mb-2">{errorMessage}</p>
          <Button
            onClick={handleRetry}
            variant="secondary"
            className="mt-4"
          >
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Controls */}
      {!hasError && (
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
