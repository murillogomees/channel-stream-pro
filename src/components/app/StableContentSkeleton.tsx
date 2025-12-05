/**
 * StableContentSkeleton - Fixed-dimension loading placeholders
 * 
 * Prevents Cumulative Layout Shift (CLS) by reserving exact space
 * Used during initial load and tab switches
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';

interface StableContentSkeletonProps {
  variant?: 'channel-list' | 'content-grid' | 'hero' | 'sidebar';
  count?: number;
  className?: string;
}

// Fixed-size skeleton item for channel list
const ChannelSkeleton = memo(function ChannelSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 animate-pulse">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-muted flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
    </div>
  );
});

// Fixed-size skeleton for content cards
const ContentCardSkeleton = memo(function ContentCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div 
        className="rounded-lg bg-muted" 
        style={{ aspectRatio: '16/9', width: '100%' }} 
      />
      <div className="mt-2 space-y-1">
        <div className="h-4 bg-muted rounded w-4/5" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
    </div>
  );
});

// Hero skeleton with fixed height
const HeroSkeleton = memo(function HeroSkeleton() {
  return (
    <div 
      className="animate-pulse bg-muted rounded-xl"
      style={{ height: '280px', width: '100%' }}
    />
  );
});

// Sidebar skeleton
const SidebarSkeleton = memo(function SidebarSkeleton() {
  return (
    <div className="space-y-2 p-2 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <div className="w-8 h-8 rounded-lg bg-muted" />
          <div className="h-4 bg-muted rounded flex-1" />
        </div>
      ))}
    </div>
  );
});

export const StableContentSkeleton = memo(function StableContentSkeleton({
  variant = 'channel-list',
  count = 10,
  className,
}: StableContentSkeletonProps) {
  if (variant === 'hero') {
    return (
      <div className={cn("px-4", className)}>
        <HeroSkeleton />
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className={className}>
        <SidebarSkeleton />
      </div>
    );
  }

  if (variant === 'content-grid') {
    return (
      <div className={cn("grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <ContentCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Default: channel-list
  return (
    <div className={cn("space-y-1", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ChannelSkeleton key={i} />
      ))}
    </div>
  );
});

// Row skeleton for horizontal carousels
export const ContentRowSkeleton = memo(function ContentRowSkeleton({
  title,
  itemCount = 6,
}: {
  title?: string;
  itemCount?: number;
}) {
  return (
    <div className="space-y-3">
      {title && (
        <div className="px-4">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </div>
      )}
      <div className="flex gap-3 px-4 overflow-hidden">
        {Array.from({ length: itemCount }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-40 sm:w-48">
            <ContentCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
});

export default StableContentSkeleton;
