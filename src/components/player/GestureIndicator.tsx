/**
 * GestureIndicator - Visual feedback for touch gestures
 */

import React, { memo } from 'react';
import { Volume2, Sun, FastForward, Rewind } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GestureIndicatorProps {
  isActive: boolean;
  type: 'volume' | 'brightness' | 'seek' | null;
  value: number;           // 0-1 for volume/brightness, seconds for seek
  className?: string;
}

export const GestureIndicator = memo(function GestureIndicator({
  isActive,
  type,
  value,
  className,
}: GestureIndicatorProps) {
  if (!isActive || !type) return null;

  const getIcon = () => {
    switch (type) {
      case 'volume':
        return <Volume2 className="w-8 h-8" />;
      case 'brightness':
        return <Sun className="w-8 h-8" />;
      case 'seek':
        return value >= 0 
          ? <FastForward className="w-8 h-8" />
          : <Rewind className="w-8 h-8" />;
    }
  };

  const getText = () => {
    switch (type) {
      case 'volume':
        return `${Math.round(value * 100)}%`;
      case 'brightness':
        return `${Math.round(value * 100)}%`;
      case 'seek':
        const sign = value >= 0 ? '+' : '';
        return `${sign}${Math.round(value)}s`;
    }
  };

  const getProgress = () => {
    if (type === 'seek') return null;
    return value;
  };

  const progress = getProgress();

  return (
    <div 
      className={cn(
        'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        'bg-black/80 rounded-2xl px-8 py-6 backdrop-blur-sm',
        'flex flex-col items-center gap-3 min-w-[120px]',
        'animate-scale-in pointer-events-none',
        className
      )}
    >
      <div className="text-white">
        {getIcon()}
      </div>
      
      <span className="text-white text-xl font-semibold">
        {getText()}
      </span>

      {progress !== null && (
        <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white rounded-full transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
});

export default GestureIndicator;
