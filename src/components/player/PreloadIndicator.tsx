/**
 * ============================================================================
 * PreloadIndicator - Visual indicator for preloaded streams
 * ============================================================================
 */

import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

interface PreloadIndicatorProps {
  isPreloaded: boolean;
  isPending?: boolean;
  priority?: 'high' | 'medium' | 'low';
  reason?: string;
  showLabel?: boolean;
  className?: string;
}

const priorityColors = {
  high: 'bg-green-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

const reasonLabels: Record<string, string> = {
  adjacent_channel: 'Próximo',
  user_favorite: 'Favorito',
  frequently_watched: 'Frequente',
  time_based: 'Horário',
  trending: 'Popular',
  continue_watching: 'Continuar',
};

export function PreloadIndicator({
  isPreloaded,
  isPending,
  priority,
  reason,
  showLabel = false,
  className,
}: PreloadIndicatorProps) {
  if (!isPreloaded && !isPending) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        className
      )}
      title={isPreloaded ? 'Stream pré-carregado' : 'Pré-carregando...'}
    >
      {isPreloaded ? (
        <>
          <span 
            className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              priority ? priorityColors[priority] : 'bg-green-500'
            )} 
          />
          {showLabel && (
            <span className="text-green-400">
              <Zap className="w-3 h-3 inline" /> Pronto
            </span>
          )}
        </>
      ) : isPending ? (
        <>
          <span className="w-2 h-2 rounded-full bg-yellow-500/50 animate-pulse" />
          {showLabel && (
            <span className="text-yellow-400/70">Carregando...</span>
          )}
        </>
      ) : null}
      
      {showLabel && reason && reasonLabels[reason] && (
        <span className="text-muted-foreground">
          ({reasonLabels[reason]})
        </span>
      )}
    </div>
  );
}

export default PreloadIndicator;
