/**
 * ContentSkeleton - Skeleton placeholders for content loading
 * Reserves space to prevent CLS during initial load
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';

interface ContentSkeletonProps {
  variant?: 'card' | 'hero' | 'row';
  count?: number;
  className?: string;
}

const CardSkeleton = memo(function CardSkeleton() {
  return (
    <div className="flex-shrink-0 w-[200px] lg:w-[240px] xl:w-[280px]">
      <div className="aspect-video rounded-lg bg-muted animate-pulse" />
      <div className="mt-2 space-y-2">
        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
        <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
      </div>
    </div>
  );
});

const HeroSkeleton = memo(function HeroSkeleton() {
  return (
    <section 
      className="relative overflow-hidden bg-muted"
      style={{ height: 'clamp(400px, 50vh, 60vh)' }}
    >
      {/* Reserve exact hero dimensions to prevent CLS */}
      <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/5 to-muted animate-pulse" />
      
      {/* Content skeleton */}
      <div className="absolute bottom-12 left-4 lg:left-8 space-y-4">
        <div className="h-6 w-24 bg-muted-foreground/20 rounded-full animate-pulse" />
        <div className="h-12 w-64 lg:w-96 bg-muted-foreground/20 rounded animate-pulse" />
        <div className="h-4 w-48 bg-muted-foreground/10 rounded animate-pulse" />
        <div className="flex gap-3 mt-6">
          <div className="h-12 w-32 bg-muted-foreground/20 rounded-lg animate-pulse" />
          <div className="h-12 w-24 bg-muted-foreground/20 rounded-lg animate-pulse" />
        </div>
      </div>
    </section>
  );
});

const RowSkeleton = memo(function RowSkeleton() {
  return (
    <div className="space-y-4 px-4 lg:px-8">
      {/* Title skeleton */}
      <div className="h-6 w-48 bg-muted rounded animate-pulse" />
      
      {/* Cards skeleton */}
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
});

export const ContentSkeleton = memo(function ContentSkeleton({
  variant = 'card',
  count = 1,
  className
}: ContentSkeletonProps) {
  if (variant === 'hero') {
    return <HeroSkeleton />;
  }

  if (variant === 'row') {
    return (
      <div className={cn('space-y-8', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Card variant
  return (
    <div className={cn('flex gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
});

export default ContentSkeleton;
