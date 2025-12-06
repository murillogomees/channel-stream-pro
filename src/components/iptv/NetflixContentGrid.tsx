/**
 * NetflixContentGrid - Intelligent content grid with Netflix-style lazy loading
 * 
 * Features:
 * - Skeleton placeholders during load
 * - Predictive image preloading
 * - Smooth scroll-based loading
 * - Animated item reveals
 */

import { cn } from '@/lib/utils';
import { TVContentCard } from './TVContentCard';
import { Loader2 } from 'lucide-react';
import { useNetflixLazyLoad } from '@/hooks/useNetflixLazyLoad';
import { motion, AnimatePresence } from 'framer-motion';
import { memo, useMemo } from 'react';

interface Channel {
  id: string;
  name: string;
  tvg_logo?: string;
  category_name?: string;
}

interface NetflixContentGridProps {
  channels: Channel[];
  isFavorite: (id: string) => boolean;
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (id: string) => void;
  emptyMessage?: string;
  className?: string;
  initialLimit?: number;
}

// Skeleton card component
const SkeletonCard = memo(() => (
  <div className="relative aspect-video rounded-lg overflow-hidden bg-muted animate-pulse">
    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
    <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
      <div className="h-4 bg-muted-foreground/20 rounded w-3/4" />
      <div className="h-3 bg-muted-foreground/10 rounded w-1/2" />
    </div>
  </div>
));
SkeletonCard.displayName = 'SkeletonCard';

// Animated card wrapper
const AnimatedCard = memo(({ 
  channel, 
  index, 
  isFavorite, 
  onPlay, 
  onToggleFavorite,
  isPreloaded,
}: {
  channel: Channel;
  index: number;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  isPreloaded: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ 
      duration: 0.3,
      delay: Math.min(index * 0.03, 0.3), // Max 300ms delay
      ease: 'easeOut'
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
    />
  </motion.div>
));
AnimatedCard.displayName = 'AnimatedCard';

export function NetflixContentGrid({
  channels,
  isFavorite,
  onPlay,
  onToggleFavorite,
  emptyMessage = "Nenhum conteúdo encontrado",
  className,
  initialLimit = 24,
}: NetflixContentGridProps) {
  const {
    visibleItems,
    hasMore,
    remainingCount,
    loadMoreRef,
    containerRef,
    visibleCount,
    totalCount,
    isLoading,
    skeletonCount,
    isImagePreloaded,
    progress,
  } = useNetflixLazyLoad(channels, {
    initialCount: initialLimit,
    batchSize: 24,
    preloadAhead: 12,
    rootMargin: '800px', // Start loading earlier
    preloadImages: true,
    getImageUrl: (channel) => channel.tvg_logo,
    predictiveLoad: true,
  });

  // Skeleton items array
  const skeletons = useMemo(() => 
    Array.from({ length: skeletonCount }, (_, i) => i),
    [skeletonCount]
  );

  if (channels.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] px-4 lg:px-8">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <section ref={containerRef} className={cn("py-4 lg:py-6", className)}>
      {/* Progress bar (subtle) */}
      {totalCount > initialLimit && (
        <div className="px-4 lg:px-8 mb-2">
          <div className="h-0.5 bg-muted rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary/50"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="px-4 lg:px-8 mb-3 lg:mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {visibleCount.toLocaleString()} de {totalCount.toLocaleString()}
        </p>
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-xs">Carregando...</span>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="px-4 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4">
          <AnimatePresence mode="popLayout">
            {visibleItems.map((channel, index) => (
              <AnimatedCard
                key={channel.id}
                channel={channel}
                index={index % 24} // Reset index for each batch
                isFavorite={isFavorite(channel.id)}
                onPlay={() => onPlay(channel)}
                onToggleFavorite={() => onToggleFavorite(channel.id)}
                isPreloaded={isImagePreloaded(channel.tvg_logo)}
              />
            ))}
            
            {/* Skeleton placeholders */}
            {skeletons.map((i) => (
              <SkeletonCard key={`skeleton-${i}`} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Lazy load trigger - invisible element */}
      {hasMore && (
        <div 
          ref={loadMoreRef}
          className="flex justify-center items-center py-8 px-4"
          aria-hidden="true"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">
              +{Math.min(24, remainingCount).toLocaleString()} próximos
            </span>
          </div>
        </div>
      )}

      {/* End of content */}
      {!hasMore && totalCount > initialLimit && (
        <div className="text-center py-8">
          <p className="text-xs text-muted-foreground">
            Todos os {totalCount.toLocaleString()} itens carregados
          </p>
        </div>
      )}
    </section>
  );
}

export default NetflixContentGrid;
