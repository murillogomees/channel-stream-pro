/**
 * Loading Progress Bar - Shows streaming/pagination progress during channel loading
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Database, Check, Wifi } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface LoadingProgressBarProps {
  isLoading: boolean;
  isLoadingMore: boolean;
  loadedChannels: number;
  totalChannels: number;
  loadingPercent: number;
  loadingProgress: string;
  isCached: boolean;
  className?: string;
}

export const LoadingProgressBar = memo(function LoadingProgressBar({
  isLoading,
  isLoadingMore,
  loadedChannels,
  totalChannels,
  loadingPercent,
  loadingProgress,
  isCached,
  className,
}: LoadingProgressBarProps) {
  // Don't show if not loading anything
  if (!isLoading && !isLoadingMore && loadedChannels === totalChannels) {
    return null;
  }

  // Show compact version when loading in background
  if (!isLoading && isLoadingMore) {
    return (
      <div className={cn(
        "fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80",
        "bg-card/95 backdrop-blur-md border border-border rounded-lg p-3 shadow-lg",
        className
      )}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Wifi className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground truncate">
                Sincronizando em segundo plano
              </span>
              <span className="text-xs font-medium text-foreground">
                {loadingPercent}%
              </span>
            </div>
            <Progress value={loadingPercent} className="h-1.5" />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">
                {loadedChannels.toLocaleString()} de {totalChannels.toLocaleString()}
              </span>
              {isCached && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                  <Database className="w-3 h-3" />
                  Cache
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full loading screen
  if (isLoading) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center min-h-[50vh] p-6",
        className
      )}>
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          {isCached && (
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <Database className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-2">
          {isCached ? 'Carregando do cache...' : 'Carregando playlist...'}
        </h3>

        <p className="text-sm text-muted-foreground mb-4 text-center max-w-xs">
          {loadingProgress || 'Conectando ao servidor...'}
        </p>

        {totalChannels > 0 && (
          <div className="w-full max-w-xs space-y-2">
            <Progress value={loadingPercent} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{loadedChannels.toLocaleString()} canais</span>
              <span>{loadingPercent}%</span>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          {loadingPercent === 100 ? (
            <>
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Playlist sincronizada</span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 animate-pulse" />
              <span>Download em andamento...</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
});

export default LoadingProgressBar;
