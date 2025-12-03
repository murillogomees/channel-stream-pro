/**
 * DoubleTapIndicator - Visual feedback for double-tap seek
 */

import React, { memo } from 'react';
import { FastForward, Rewind } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DoubleTapIndicatorProps {
  isActive: boolean;
  side: 'left' | 'right' | null;
  seekAmount: number;
  tapCount: number;
  className?: string;
}

export const DoubleTapIndicator = memo(function DoubleTapIndicator({
  isActive,
  side,
  seekAmount,
  tapCount,
  className,
}: DoubleTapIndicatorProps) {
  if (!isActive || !side) return null;

  const isForward = side === 'right';

  return (
    <div 
      className={cn(
        'absolute top-0 bottom-0 flex items-center justify-center',
        'pointer-events-none',
        side === 'left' ? 'left-0 right-1/2' : 'left-1/2 right-0',
        className
      )}
    >
      {/* Ripple effect background */}
      <div 
        className={cn(
          'absolute inset-0',
          'bg-gradient-to-r',
          side === 'left' 
            ? 'from-white/20 to-transparent' 
            : 'from-transparent to-white/20',
          'animate-fade-in'
        )}
      />

      {/* Indicator */}
      <div className="relative flex flex-col items-center gap-2 animate-scale-in">
        {/* Animated icons */}
        <div className="flex items-center gap-1">
          {isForward ? (
            <>
              <FastForward className="w-6 h-6 text-white animate-pulse" style={{ animationDelay: '0ms' }} />
              <FastForward className="w-6 h-6 text-white animate-pulse" style={{ animationDelay: '100ms' }} />
              {tapCount > 1 && (
                <FastForward className="w-6 h-6 text-white animate-pulse" style={{ animationDelay: '200ms' }} />
              )}
            </>
          ) : (
            <>
              {tapCount > 1 && (
                <Rewind className="w-6 h-6 text-white animate-pulse" style={{ animationDelay: '200ms' }} />
              )}
              <Rewind className="w-6 h-6 text-white animate-pulse" style={{ animationDelay: '100ms' }} />
              <Rewind className="w-6 h-6 text-white animate-pulse" style={{ animationDelay: '0ms' }} />
            </>
          )}
        </div>

        {/* Text */}
        <span className="text-white font-semibold text-lg drop-shadow-lg">
          {seekAmount} segundos
        </span>
      </div>
    </div>
  );
});

export default DoubleTapIndicator;
