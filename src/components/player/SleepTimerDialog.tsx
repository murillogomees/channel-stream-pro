/**
 * SleepTimerDialog - UI for sleep timer settings
 */

import React, { memo } from 'react';
import { Moon, Clock, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SleepTimerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isActive: boolean;
  remainingTime: string;
  remainingMinutes: number;
  progress: number;
  presets: number[];
  onStartTimer: (minutes: number) => void;
  onCancelTimer: () => void;
  onAddTime: (minutes: number) => void;
  className?: string;
}

export const SleepTimerDialog = memo(function SleepTimerDialog({
  isOpen,
  onClose,
  isActive,
  remainingTime,
  remainingMinutes,
  progress,
  presets,
  onStartTimer,
  onCancelTimer,
  onAddTime,
  className,
}: SleepTimerDialogProps) {
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
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              Sleep Timer
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {isActive ? (
          /* Active timer view */
          <div className="text-center">
            {/* Progress ring */}
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 58}`}
                  strokeDashoffset={`${2 * Math.PI * 58 * (progress / 100)}`}
                  className="text-primary transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Clock className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-2xl font-bold text-foreground">
                  {remainingTime}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              O player será pausado em {remainingMinutes} minutos
            </p>

            {/* Quick add buttons */}
            <div className="flex gap-2 justify-center mb-4">
              {[5, 10, 15].map(min => (
                <Button
                  key={min}
                  variant="outline"
                  size="sm"
                  onClick={() => onAddTime(min)}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {min}min
                </Button>
              ))}
            </div>

            {/* Cancel button */}
            <Button
              variant="destructive"
              onClick={onCancelTimer}
              className="w-full"
            >
              Cancelar Timer
            </Button>
          </div>
        ) : (
          /* Preset selection view */
          <div>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Selecione quando o player deve pausar automaticamente
            </p>

            <div className="grid grid-cols-3 gap-2">
              {presets.map(minutes => (
                <Button
                  key={minutes}
                  variant="outline"
                  onClick={() => {
                    onStartTimer(minutes);
                    onClose();
                  }}
                  className="flex flex-col py-4 h-auto"
                >
                  <span className="text-lg font-bold">{minutes}</span>
                  <span className="text-xs text-muted-foreground">min</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default SleepTimerDialog;
