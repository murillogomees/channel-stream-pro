/**
 * Gesture Overlay Component
 * 
 * Visual feedback for touch gestures (volume, brightness, seek)
 */

import React from 'react';
import { Volume2, Sun, SkipForward, SkipBack } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GestureState } from '../hooks/useTouchGestures';

interface GestureOverlayProps {
  gestureState: GestureState;
  className?: string;
}

export function GestureOverlay({ gestureState, className }: GestureOverlayProps) {
  if (!gestureState.isGesturing) return null;

  const getIcon = () => {
    switch (gestureState.gestureType) {
      case 'volume':
        return <Volume2 className="w-8 h-8" />;
      case 'brightness':
        return <Sun className="w-8 h-8" />;
      case 'seek':
        return gestureState.gestureValue >= 0 
          ? <SkipForward className="w-8 h-8" />
          : <SkipBack className="w-8 h-8" />;
      default:
        return null;
    }
  };

  const getProgressWidth = () => {
    switch (gestureState.gestureType) {
      case 'volume':
      case 'brightness':
        return `${Math.min(100, Math.max(0, gestureState.gestureValue))}%`;
      default:
        return '0%';
    }
  };

  return (
    <div 
      className={cn(
        'absolute inset-0 flex items-center justify-center pointer-events-none',
        className
      )}
    >
      <div className="bg-black/70 backdrop-blur-sm rounded-2xl p-6 flex flex-col items-center gap-4 min-w-[140px]">
        {/* Icon */}
        <div className="text-white">
          {getIcon()}
        </div>

        {/* Value */}
        <div className="text-white text-2xl font-bold">
          {gestureState.displayValue}
        </div>

        {/* Progress bar for volume/brightness */}
        {(gestureState.gestureType === 'volume' || gestureState.gestureType === 'brightness') && (
          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-100"
              style={{ width: getProgressWidth() }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default GestureOverlay;
