import { cn } from '@/lib/utils';
import { TVContentCard } from './TVContentCard';
import { Loader2 } from 'lucide-react';
import { useLazyLoadContent } from '@/hooks/useLazyLoadContent';

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
    remainingCount,
    loadMoreRef,
    visibleCount,
    totalCount,
  } = useLazyLoadContent(channels, {
    initialCount: initialLimit,
    incrementCount: 30,
    rootMargin: '400px',
  });

  if (channels.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] px-4 lg:px-8">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <section className={cn("py-2 sm:py-4 lg:py-6 h-full", className)}>
      {/* Results count - smaller on mobile */}
      <div className="px-2 sm:px-4 lg:px-8 mb-2 lg:mb-4">
        <p className="text-xs sm:text-sm text-muted-foreground">
          {visibleCount} de {totalCount.toLocaleString()}
        </p>
      </div>

      {/* Grid - optimized for mobile: 3 cols, smaller gaps, fills screen */}
      <div className="px-2 sm:px-4 lg:px-8">
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-3 lg:gap-4 xl:gap-5">
          {visibleItems.map((channel) => (
            <TVContentCard
              key={channel.id}
              id={channel.id}
              name={channel.name}
              logo={channel.tvg_logo}
              category={channel.category_name}
              isFavorite={isFavorite(channel.id)}
              onPlay={() => onPlay(channel)}
              onToggleFavorite={() => onToggleFavorite(channel.id)}
              fillContainer
              variant="default"
            />
          ))}
        </div>
      </div>

      {/* Lazy load trigger */}
      {hasMore && (
        <div 
          ref={loadMoreRef}
          className="flex justify-center items-center py-8 px-4"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">
              Carregando mais {Math.min(30, remainingCount)} de {remainingCount.toLocaleString()}...
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
