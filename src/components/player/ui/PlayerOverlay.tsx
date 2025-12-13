/**
 * PlayerOverlay - Overlay states (loading, error, reconnecting)
 * 
 * @features
 * - Buffering indicator
 * - Error message with retry
 * - Reconnecting feedback
 * - Stream offline state
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw, WifiOff, AlertTriangle, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type OverlayState = 
  | 'idle'
  | 'buffering'
  | 'reconnecting'
  | 'error'
  | 'offline';

interface PlayerOverlayProps {
  state: OverlayState;
  message?: string;
  retryAttempt?: number;
  maxRetries?: number;
  onRetry?: () => void;
  className?: string;
}

export const PlayerOverlay = memo(function PlayerOverlay({
  state,
  message,
  retryAttempt,
  maxRetries,
  onRetry,
  className,
}: PlayerOverlayProps) {
  if (state === 'idle') return null;

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center z-20 transition-opacity duration-300',
        state === 'buffering' ? 'bg-black/40' : 'bg-black/80',
        className
      )}
    >
      {/* Buffering */}
      {state === 'buffering' && (
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Radio className="w-6 h-6 text-primary animate-pulse" />
            </div>
          </div>
          <p className="text-white/80 text-sm font-medium">Carregando...</p>
        </div>
      )}

      {/* Reconnecting */}
      {state === 'reconnecting' && (
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            <RefreshCw className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" />
          </div>
          <div>
            <p className="text-white font-medium mb-1">Reconectando...</p>
            {retryAttempt !== undefined && maxRetries !== undefined && (
              <p className="text-white/60 text-sm">
                Tentativa {retryAttempt} de {maxRetries}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="flex flex-col items-center gap-4 text-center px-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <p className="text-white font-medium mb-1">
              {message || 'Erro ao reproduzir'}
            </p>
            <p className="text-white/60 text-sm">
              Não foi possível carregar o conteúdo
            </p>
          </div>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="default"
              className="mt-2"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar novamente
            </Button>
          )}
        </div>
      )}

      {/* Offline */}
      {state === 'offline' && (
        <div className="flex flex-col items-center gap-4 text-center px-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-white font-medium mb-1">
              {message || 'Canal indisponível'}
            </p>
            <p className="text-white/60 text-sm">
              O stream está temporariamente offline
            </p>
          </div>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="secondary"
              className="mt-2"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Verificar novamente
            </Button>
          )}
        </div>
      )}
    </div>
  );
});

export default PlayerOverlay;
