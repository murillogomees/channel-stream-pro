/**
 * SecureYouTubePlayer - Wrapper para YouTubeStylePlayer com URLs assinadas
 * 
 * Gerencia automaticamente:
 * - URLs assinadas do Cloudflare Stream para VOD
 * - Fallback para URL original se necessário
 * - Badge de segurança visual
 */

import { useMemo } from 'react';
import { useSignedStreamUrl } from '@/hooks/useSignedStreamUrl';
import YouTubeStylePlayer from './YouTubeStylePlayer';
import { Loader2, Shield, ShieldOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SeriesEpisode {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo?: string;
  category_name?: string;
  cf_stream_uid?: string | null;
}

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

export interface SecureYouTubePlayerProps {
  /** URL original do stream */
  url: string;
  /** UID do Cloudflare Stream (se disponível) */
  cfStreamUid?: string | null;
  /** Título do conteúdo */
  title?: string;
  /** Logo do canal */
  logo?: string;
  /** Categoria */
  category?: string;
  /** Autoplay */
  autoplay?: boolean;
  /** Iniciar mutado */
  muted?: boolean;
  /** Callback ao voltar */
  onBack?: () => void;
  /** Callback de erro */
  onError?: (error: any) => void;
  /** Callback quando pronto */
  onReady?: () => void;
  /** É favorito */
  isFavorite?: boolean;
  /** Toggle favorito */
  onToggleFavorite?: () => void;
  /** Callback de progresso */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Callback início de playback */
  onPlaybackStart?: () => void;
  /** Callback fim de playback */
  onPlaybackComplete?: () => void;
  /** Tempo inicial */
  initialTime?: number;
  /** Metadata do conteúdo */
  metadata?: ContentMetadata;
  /** Episódios da série */
  seriesEpisodes?: SeriesEpisode[];
  /** Callback ao reproduzir episódio */
  onPlayEpisode?: (episode: SeriesEpisode) => void;
  /** Mostrar badge de segurança */
  showSecurityBadge?: boolean;
}

export function SecureYouTubePlayer({
  url,
  cfStreamUid,
  title,
  logo,
  category,
  autoplay = true,
  muted = false,
  onBack,
  onError,
  onReady,
  isFavorite,
  onToggleFavorite,
  onTimeUpdate,
  onPlaybackStart,
  onPlaybackComplete,
  initialTime,
  metadata,
  seriesEpisodes,
  onPlayEpisode,
  showSecurityBadge = true,
}: SecureYouTubePlayerProps) {
  // Get signed URL if we have a CF Stream UID
  const {
    url: signedUrl,
    isSigned,
    isLoading,
    error,
    source,
  } = useSignedStreamUrl({
    cfStreamUid: cfStreamUid || null,
    fallbackUrl: url,
    expiresInSeconds: 7200, // 2 hours for longer viewing sessions
    renewalMarginSeconds: 600, // Renew 10 min before expiry
    enabled: !!cfStreamUid,
  });

  // Determine the final URL to use
  const playbackUrl = useMemo(() => {
    if (cfStreamUid && signedUrl) {
      return signedUrl;
    }
    return url;
  }, [cfStreamUid, signedUrl, url]);

  // Loading state while getting signed URL
  if (cfStreamUid && isLoading && !signedUrl) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-3 text-white/70">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">Preparando playback seguro...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <YouTubeStylePlayer
        url={playbackUrl}
        title={title}
        logo={logo}
        category={category}
        autoplay={autoplay}
        muted={muted}
        onBack={onBack}
        onError={onError}
        onReady={onReady}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        onTimeUpdate={onTimeUpdate}
        onPlaybackStart={onPlaybackStart}
        onPlaybackComplete={onPlaybackComplete}
        initialTime={initialTime}
        metadata={metadata}
        seriesEpisodes={seriesEpisodes}
        onPlayEpisode={onPlayEpisode}
      />
      
      {/* Security Badge - shown in top corner when using CF Stream */}
      {showSecurityBadge && cfStreamUid && (
        <div className={cn(
          "fixed top-16 right-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm transition-all z-[60]",
          isSigned 
            ? "bg-green-500/20 text-green-400 border border-green-500/30"
            : error 
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              : "bg-muted/50 text-muted-foreground border border-border/30"
        )}>
          {isSigned ? (
            <>
              <Shield className="h-3 w-3" />
              <span>Protegido</span>
            </>
          ) : error ? (
            <>
              <AlertTriangle className="h-3 w-3" />
              <span>Sem assinatura</span>
            </>
          ) : (
            <>
              <ShieldOff className="h-3 w-3" />
              <span>CDN</span>
            </>
          )}
        </div>
      )}

      {/* Debug info (only in development) */}
      {import.meta.env.DEV && cfStreamUid && (
        <div className="fixed bottom-20 left-4 text-[10px] text-white/50 bg-black/50 px-2 py-1 rounded z-[60]">
          Source: {source} | Signed: {isSigned ? 'Yes' : 'No'} | UID: {cfStreamUid.slice(0, 8)}...
        </div>
      )}
    </div>
  );
}

export default SecureYouTubePlayer;
