import React from 'react';
import { Loader2, Database } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { LoadingProgress } from '@/hooks/useM3USyncEditor';

interface LoadingProgressBarProps {
  progress: LoadingProgress;
}

const PHASE_LABELS: Record<LoadingProgress['phase'], string> = {
  counting: 'Contando entradas...',
  fetching: 'Baixando dados...',
  processing: 'Processando entradas...',
  done: 'Concluído',
};

export const LoadingProgressBar = React.memo(function LoadingProgressBar({
  progress,
}: LoadingProgressBarProps) {
  if (progress.phase === 'done') return null;

  return (
    <div className="space-y-2 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {progress.fromCache ? (
            <Database className="w-4 h-4 text-blue-500" />
          ) : (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          )}
          <span className="font-medium">
            {progress.fromCache ? 'Carregando do cache...' : PHASE_LABELS[progress.phase]}
          </span>
        </div>
        <span className="text-muted-foreground">
          {(progress.loaded ?? 0).toLocaleString()} / {(progress.total ?? 0).toLocaleString()}
        </span>
      </div>
      <Progress 
        value={progress.percent} 
        className="h-2"
        indicatorClassName="transition-all duration-300"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{progress.percent ?? 0}% concluído</span>
        {progress.phase === 'fetching' && (progress.total ?? 0) > 0 && !progress.fromCache && (
          <span>
            ~{Math.ceil(((progress.total ?? 0) - (progress.loaded ?? 0)) / 5000)} páginas restantes
          </span>
        )}
      </div>
    </div>
  );
});
