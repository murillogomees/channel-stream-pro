/**
 * EPGStrip - Shows current and next program info
 */

import { memo } from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import type { EPGProgram } from '../types';

interface EPGStripProps {
  currentProgram?: EPGProgram;
  nextProgram?: EPGProgram;
  progress?: number;
  timeRemaining?: string;
  className?: string;
  compact?: boolean;
}

export const EPGStrip = memo(function EPGStrip({
  currentProgram,
  nextProgram,
  progress = 0,
  timeRemaining,
  className,
  compact = false,
}: EPGStripProps) {
  if (!currentProgram && !nextProgram) {
    return null;
  }

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-xs', className)}>
        {currentProgram && (
          <>
            <span className="text-primary font-medium">AGORA</span>
            <span className="text-foreground truncate max-w-[150px]">
              {currentProgram.program_title}
            </span>
            {timeRemaining && (
              <span className="text-muted-foreground">({timeRemaining})</span>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn('bg-background/80 backdrop-blur-sm rounded-lg p-3', className)}>
      {/* Current Program */}
      {currentProgram && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-semibold rounded">
              AO VIVO
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(currentProgram.start_time)} - {formatTime(currentProgram.end_time)}
            </span>
          </div>
          
          <h4 className="font-semibold text-foreground mb-1 line-clamp-1">
            {currentProgram.program_title}
          </h4>
          
          {currentProgram.program_description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {currentProgram.program_description}
            </p>
          )}
          
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <Progress value={progress} className="flex-1 h-1" />
            {timeRemaining && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {timeRemaining}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Next Program */}
      {nextProgram && (
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">A SEGUIR</span>
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {formatTime(nextProgram.start_time)}
              </span>
            </div>
            <p className="text-sm text-foreground truncate">
              {nextProgram.program_title}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
