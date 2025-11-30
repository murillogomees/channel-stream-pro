/**
 * ResumeDialog - Prompt user to resume or start over
 */

import { memo } from 'react';
import { Play, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ResumeDialogProps {
  isOpen: boolean;
  resumePoint: number; // in seconds
  contentName: string;
  onResume: () => void;
  onStartOver: () => void;
  onClose: () => void;
  className?: string;
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export const ResumeDialog = memo(function ResumeDialog({
  isOpen,
  resumePoint,
  contentName,
  onResume,
  onStartOver,
  onClose,
  className,
}: ResumeDialogProps) {
  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        'absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm',
        'animate-fade-in',
        className
      )}
    >
      <div className="bg-card rounded-2xl p-6 max-w-sm mx-4 shadow-2xl border border-border animate-scale-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Continuar assistindo?
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
            {contentName}
          </p>
          <p className="text-sm text-primary font-medium">
            Parou em {formatTime(resumePoint)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onStartOver}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Do início
          </Button>
          <Button
            onClick={onResume}
            className="flex-1"
          >
            <Play className="w-4 h-4 mr-2 fill-current" />
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
});

export default ResumeDialog;
