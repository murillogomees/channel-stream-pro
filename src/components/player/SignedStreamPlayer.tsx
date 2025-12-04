/**
 * SignedStreamPlayer - Player wrapper que gerencia URLs assinadas do Cloudflare Stream
 * 
 * Automaticamente:
 * - Detecta se o canal tem cf_stream_uid
 * - Obtém URL assinada para VOD
 * - Faz fallback para URL original se necessário
 * - Mostra loading state durante obtenção da URL
 */

import { useMemo } from 'react';
import { useSignedStreamUrl } from '@/hooks/useSignedStreamUrl';
import { VideoPlayer } from './VideoPlayer';
import { Loader2, Shield, ShieldOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SignedStreamPlayerProps {
  /** URL original do stream */
  url: string;
  /** UID do Cloudflare Stream (se disponível) */
  cfStreamUid?: string | null;
  /** Título do canal */
  title?: string;
  /** Logo do canal */
  logo?: string;
  /** Channel ID for analytics */
  channelId?: string;
  /** User ID for analytics */
  userId?: string;
  /** Autoplay */
  autoPlay?: boolean;
  /** Enable ABR */
  enableABR?: boolean;
  /** Show quality stats */
  showQualityStats?: boolean;
  /** Classes CSS */
  className?: string;
  /** Callback de erro */
  onError?: (msg: string) => void;
  /** Callback ao voltar */
  onBack?: () => void;
  /** Callback quando pronto */
  onReady?: () => void;
}

export function SignedStreamPlayer({
  url,
  cfStreamUid,
  title,
  logo,
  channelId,
  userId,
  autoPlay = true,
  enableABR = true,
  showQualityStats = false,
  className,
  onError,
  onBack,
  onReady,
}: SignedStreamPlayerProps) {
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
      <div className={cn(
        "relative w-full aspect-video bg-black flex items-center justify-center",
        className
      )}>
        <div className="flex flex-col items-center gap-3 text-white/70">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">Preparando playback seguro...</span>
        </div>
      </div>
    );
  }

  // Error state (but still try to play with fallback)
  const showSecurityBadge = cfStreamUid && playbackUrl;

  return (
    <div className={cn("relative", className)}>
      <VideoPlayer
        url={playbackUrl}
        title={title}
        logo={logo}
        autoPlay={autoPlay}
        onError={onError}
        onBack={onBack}
        onReady={onReady}
      />
      
      {/* Security Badge */}
      {showSecurityBadge && (
        <div className={cn(
          "absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm transition-opacity",
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
              <span>Público</span>
            </>
          )}
        </div>
      )}

      {/* Debug info (only in development) */}
      {import.meta.env.DEV && cfStreamUid && (
        <div className="absolute bottom-16 left-3 text-[10px] text-white/50 bg-black/50 px-2 py-1 rounded">
          Source: {source} | Signed: {isSigned ? 'Yes' : 'No'}
        </div>
      )}
    </div>
  );
}
