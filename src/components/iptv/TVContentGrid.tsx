import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TVContentCard } from './TVContentCard';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

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

const ITEMS_PER_PAGE = 50;

export function TVContentGrid({
  channels,
  isFavorite,
  onPlay,
  onToggleFavorite,
  emptyMessage = "Nenhum conteúdo encontrado",
  className,
  initialLimit = ITEMS_PER_PAGE,
}: TVContentGridProps) {
  const [displayCount, setDisplayCount] = useState(initialLimit);

  // Reset display count when channels change significantly
  const channelsKey = channels.length;
  
  const visibleChannels = useMemo(() => {
    return channels.slice(0, displayCount);
  }, [channels, displayCount]);

  const hasMore = displayCount < channels.length;
  const remainingCount = channels.length - displayCount;

  const loadMore = () => {
    setDisplayCount(prev => Math.min(prev + ITEMS_PER_PAGE, channels.length));
  };

  if (channels.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] px-4 lg:px-8">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <section className={cn("py-4 lg:py-6", className)}>
      {/* Results count - matching TVContentRow header padding */}
      <div className="px-4 lg:px-8 mb-3 lg:mb-4">
        <p className="text-sm text-muted-foreground">
          Mostrando {visibleChannels.length} de {channels.length.toLocaleString()} itens
        </p>
      </div>

      {/* Grid - matching TVContentRow content padding */}
      <div className="px-4 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 lg:gap-4">
          {visibleChannels.map((channel) => (
            <TVContentCard
              key={channel.id}
              id={channel.id}
              name={channel.name}
              logo={channel.tvg_logo}
              category={channel.category_name}
              isFavorite={isFavorite(channel.id)}
              onPlay={() => onPlay(channel)}
              onToggleFavorite={() => onToggleFavorite(channel.id)}
            />
          ))}
        </div>
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-6 px-4 lg:px-8">
          <Button 
            variant="outline" 
            size="lg"
            onClick={loadMore}
            className="gap-2"
          >
            <ChevronDown className="w-4 h-4" />
            Carregar mais ({Math.min(ITEMS_PER_PAGE, remainingCount).toLocaleString()} de {remainingCount.toLocaleString()} restantes)
          </Button>
        </div>
      )}
    </section>
  );
}
