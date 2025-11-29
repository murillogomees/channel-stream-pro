/**
 * ============================================================================
 * QualityBadge - Small quality indicator component
 * ============================================================================
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { getQualityBadge, getQualityLabel } from '@/services/abrService';

interface QualityBadgeProps {
  height: number;
  bitrate?: number;
  isAuto?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const QualityBadge = memo(function QualityBadge({
  height,
  bitrate,
  isAuto = false,
  showLabel = true,
  size = 'sm',
  className,
}: QualityBadgeProps) {
  const badge = getQualityBadge(height);
  const label = isAuto ? 'AUTO' : getQualityLabel(height);

  const sizeClasses = {
    sm: 'text-[10px] px-1 py-0.5',
    md: 'text-xs px-1.5 py-0.5',
    lg: 'text-sm px-2 py-1',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded font-bold text-white uppercase',
        isAuto ? 'bg-primary' : badge.color,
        sizeClasses[size],
        className
      )}
    >
      {showLabel && label}
      {!showLabel && (
        <span className={cn('w-2 h-2 rounded-full', badge.color)} />
      )}
    </span>
  );
});

export default QualityBadge;
