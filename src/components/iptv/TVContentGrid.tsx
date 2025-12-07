/**
 * TVContentGrid - Netflix/YouTube-style content grid with smooth lazy loading
 * 
 * Features:
 * - Skeleton placeholders with shimmer effect
 * - Smooth fade-in animations
 * - Predictive loading
 * - Progress indicator
 */

import { cn } from '@/lib/utils';
import { TVContentCard } from './TVContentCard';
import { useNetflixLazyLoad } from '@/hooks/useNetflixLazyLoad';
import { motion, AnimatePresence } from 'framer-motion';
import { memo, useMemo } from 'react';

interface Channel {
  id: string;
  name: string;
  tvg_logo?: string;
  category_name?: string;
}

interface TVContentGridProps {
  channels: Channel[];
  isFavorite: (id: string) => boolean;
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (id: string) => void;
  emptyMessage?: string;
  className?: string;
  initialLimit?: number;
}

// Netflix-style skeleton with shimmer effect
const SkeletonCard = memo(({ delay = 0 }: { delay?: number }) => (
  <motion.div 
    className="relative aspect-video rounded-lg overflow-hidden bg-muted/60"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.2, delay: delay * 0.02 }}
  >
    {/* Shimmer effect */}
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    
    {/* Content placeholder */}
    <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 space-y-1.5">
      <div className="h-3 sm:h-4 bg-muted-foreground/20 rounded w-3/4" />
      <div className="h-2 sm:h-3 bg-muted-foreground/10 rounded w-1/2" />
    </div>
  </motion.div>
));
SkeletonCard.displayName = 'SkeletonCard';

// Animated card with Netflix-style entrance
const AnimatedCard = memo(({ 
  channel, 
  index, 
  isFavorite, 
  onPlay, 
  onToggleFavorite,
}: {
  channel: Channel;
  index: number;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ 
      duration: 0.25,
      delay: Math.min((index % 30) * 0.02, 0.4),
      ease: [0.25, 0.46, 0.45, 0.94] // Custom easing similar to Netflix
    }}
  >
    <TVContentCard
      id={channel.id}
      name={channel.name}
      logo={channel.tvg_logo}
      category={channel.category_name}
      isFavorite={isFavorite}
      onPlay={onPlay}
      onToggleFavorite={onToggleFavorite}
      fillContainer
      variant="default"
    />
  </motion.div>
));
AnimatedCard.displayName = 'AnimatedCard';

export function TVContentGrid({
  channels,
  isFavorite,
  onPlay,
  onToggleFavorite,
  emptyMessage = "Nenhum conteúdo encontrado",
  className,
  initialLimit = 30,
}: TVContentGridProps) {
  const {
    visibleItems,
    hasMore,
    loadMoreRef,
    containerRef,
    visibleCount,
    totalCount,
    isLoading,
    skeletonCount,
    progress,
  } = useNetflixLazyLoad(channels, {
    initialCount: initialLimit,
    batchSize: 30,
    preloadAhead: 15,
    rootMargin: '600px',
    preloadImages: true,
    getImageUrl: (channel) => channel.tvg_logo,
    predictiveLoad: true,
  });

  // Generate skeleton placeholders
  const skeletons = useMemo(() => 
    Array.from({ length: Math.min(skeletonCount, 12) }, (_, i) => i),
    [skeletonCount]
  );

  if (channels.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] px-4 lg:px-8">
        <motion.p 
          className="text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {emptyMessage}
        </motion.p>
      </div>
    );
  }

  return (
    <section ref={containerRef} className={cn("py-2 sm:py-4 lg:py-6 h-full", className)}>
      {/* Netflix-style progress bar */}
      {totalCount > initialLimit && (
        <div className="px-2 sm:px-4 lg:px-8 mb-2">
          <div className="h-0.5 bg-muted/50 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Results count - Netflix style minimal */}
      <div className="px-2 sm:px-4 lg:px-8 mb-2 lg:mb-4 flex items-center justify-between">
        <motion.p 
          className="text-xs sm:text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {visibleCount} de {totalCount.toLocaleString()}
        </motion.p>
        
        {isLoading && (
          <motion.div 
            className="flex items-center gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 bg-primary rounded-full"
                  animate={{ 
                    scale: [1, 1.3, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.15
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Grid with optimized layout */}
      <div className="px-2 sm:px-4 lg:px-8">
        <motion.div 
          className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-3 lg:gap-4 xl:gap-5"
          layout
        >
          <AnimatePresence mode="popLayout">
            {visibleItems.map((channel, index) => (
              <AnimatedCard
                key={channel.id}
                channel={channel}
                index={index}
                isFavorite={isFavorite(channel.id)}
                onPlay={() => onPlay(channel)}
                onToggleFavorite={() => onToggleFavorite(channel.id)}
              />
            ))}
            
            {/* Skeleton placeholders while loading more */}
            {isLoading && skeletons.map((i) => (
              <SkeletonCard key={`skeleton-${i}`} delay={i} />
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Invisible load trigger */}
      {hasMore && (
        <div 
          ref={loadMoreRef}
          className="h-20 flex items-center justify-center"
          aria-hidden="true"
        />
      )}

      {/* End indicator */}
      {!hasMore && totalCount > initialLimit && (
        <motion.div 
          className="text-center py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-xs text-muted-foreground/60">
            ✓ {totalCount.toLocaleString()} itens
          </p>
        </motion.div>
      )}
    </section>
  );
}

export default TVContentGrid;
