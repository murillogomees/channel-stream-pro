/**
 * ThumbnailPreview - Shows thumbnail preview on timeline hover
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ThumbnailData {
  time: number;
  dataUrl: string;
}

interface ThumbnailPreviewProps {
  /** Current position on timeline (0-1) */
  position: number;
  /** Duration of video in seconds */
  duration: number;
  /** Get thumbnail at time */
  getThumbnailAtTime: (time: number) => ThumbnailData | null;
  /** Whether to show */
  isVisible: boolean;
  /** Container width */
  containerWidth: number;
  /** Thumbnail width */
  thumbnailWidth?: number;
  className?: string;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const ThumbnailPreview = memo(function ThumbnailPreview({
  position,
  duration,
  getThumbnailAtTime,
  isVisible,
  containerWidth,
  thumbnailWidth = 160,
  className,
}: ThumbnailPreviewProps) {
  const [thumbnail, setThumbnail] = useState<ThumbnailData | null>(null);
  const time = position * duration;
  
  // Get thumbnail when position changes
  useEffect(() => {
    if (isVisible && duration > 0) {
      const thumb = getThumbnailAtTime(time);
      setThumbnail(thumb);
    }
  }, [time, isVisible, duration, getThumbnailAtTime]);

  if (!isVisible || !thumbnail) return null;

  // Calculate position (keep within bounds)
  const halfWidth = thumbnailWidth / 2;
  const left = Math.max(halfWidth, Math.min(containerWidth - halfWidth, position * containerWidth));

  return (
    <div
      className={cn(
        'absolute bottom-full mb-2 -translate-x-1/2 z-50',
        'pointer-events-none transition-opacity duration-150',
        isVisible ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{ left }}
    >
      <div className="flex flex-col items-center">
        {/* Thumbnail image */}
        <div 
          className="rounded-lg overflow-hidden border-2 border-white/30 shadow-xl bg-black"
          style={{ width: thumbnailWidth, height: thumbnailWidth * (9/16) }}
        >
          <img
            src={thumbnail.dataUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Time label */}
        <div className="mt-1 px-2 py-0.5 bg-black/80 rounded text-white text-xs font-medium">
          {formatTime(time)}
        </div>
        
        {/* Arrow pointer */}
        <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black/80" />
      </div>
    </div>
  );
});

export default ThumbnailPreview;
