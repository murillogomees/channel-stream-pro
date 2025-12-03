/**
 * SeekBar - Advanced seek bar with thumbnail preview
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ThumbnailPreview } from './ThumbnailPreview';

interface ThumbnailData {
  time: number;
  dataUrl: string;
}

interface SeekBarProps {
  /** Current time in seconds */
  currentTime: number;
  /** Duration in seconds */
  duration: number;
  /** Buffered progress (0-1) */
  buffered: number;
  /** Seek to time callback */
  onSeek: (time: number) => void;
  /** Get thumbnail at time */
  getThumbnailAtTime?: (time: number) => ThumbnailData | null;
  /** Whether seeking is enabled */
  disabled?: boolean;
  className?: string;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const SeekBar = memo(function SeekBar({
  currentTime,
  duration,
  buffered,
  onSeek,
  getThumbnailAtTime,
  disabled = false,
  className,
}: SeekBarProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Update container width
  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
      
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = buffered * 100;

  const calculatePosition = useCallback((clientX: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = calculatePosition(e.clientX);
    setHoverPosition(pos);
    
    if (isDragging && !disabled) {
      onSeek(pos * duration);
    }
  }, [calculatePosition, isDragging, duration, onSeek, disabled]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    const pos = calculatePosition(e.clientX);
    onSeek(pos * duration);
  }, [calculatePosition, duration, onSeek, disabled]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Global mouse events for dragging
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        const pos = calculatePosition(e.clientX);
        setHoverPosition(pos);
        onSeek(pos * duration);
      };
      
      const handleGlobalMouseUp = () => {
        setIsDragging(false);
      };
      
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, calculatePosition, duration, onSeek]);

  return (
    <div className={cn('w-full', className)}>
      {/* Time display */}
      <div className="flex justify-between text-xs text-white/70 mb-1.5 px-0.5">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      
      {/* Seek bar container */}
      <div
        ref={containerRef}
        className={cn(
          'relative h-5 cursor-pointer group',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          if (!isDragging) setHoverPosition(0);
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {/* Thumbnail preview */}
        {getThumbnailAtTime && duration > 0 && isFinite(duration) && (
          <ThumbnailPreview
            position={hoverPosition}
            duration={duration}
            getThumbnailAtTime={getThumbnailAtTime}
            isVisible={isHovering || isDragging}
            containerWidth={containerWidth}
          />
        )}
        
        {/* Track */}
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 bg-white/20 rounded-full overflow-hidden">
          {/* Buffered */}
          <div
            className="absolute h-full bg-white/30 rounded-full transition-all"
            style={{ width: `${bufferedProgress}%` }}
          />
          
          {/* Progress */}
          <div
            className="absolute h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Hover indicator */}
        {(isHovering || isDragging) && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1 bg-white/50 rounded-full pointer-events-none"
            style={{ width: `${hoverPosition * 100}%` }}
          />
        )}
        
        {/* Thumb */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
            'w-3 h-3 bg-white rounded-full shadow-lg',
            'transition-transform duration-100',
            (isHovering || isDragging) && 'scale-125'
          )}
          style={{ left: `${progress}%` }}
        />
      </div>
    </div>
  );
});

export default SeekBar;
