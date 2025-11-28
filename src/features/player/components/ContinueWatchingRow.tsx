/**
 * ContinueWatchingRow - Shows content the user is currently watching
 */

import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { WatchProgress } from '../types';

interface ContinueWatchingRowProps {
  items: WatchProgress[];
  onPlay: (item: WatchProgress) => void;
  onRemove: (contentId: string) => void;
  isLoading?: boolean;
}

export function ContinueWatchingRow({
  items,
  onPlay,
  onRemove,
  isLoading = false,
}: ContinueWatchingRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (isLoading) {
    return (
      <section className="py-6">
        <h2 className="text-xl lg:text-2xl font-semibold text-foreground mb-4 px-4 lg:px-12">
          Continuar Assistindo
        </h2>
        <div className="flex gap-3 px-4 lg:px-12 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[280px] lg:w-[320px] aspect-video bg-muted animate-pulse rounded-lg"
            />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="py-6 group/section">
      <div className="flex items-center justify-between mb-4 px-4 lg:px-12">
        <h2 className="text-xl lg:text-2xl font-semibold text-foreground">
          Continuar Assistindo
        </h2>
        <div className="flex gap-2 opacity-0 group-hover/section:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 px-4 lg:px-12 overflow-x-auto scrollbar-hide scroll-smooth"
      >
        {items.map((item) => {
          const progressPercent = item.duration_seconds > 0
            ? Math.round((item.progress_seconds / item.duration_seconds) * 100)
            : 0;
          const remainingMinutes = Math.ceil((item.duration_seconds - item.progress_seconds) / 60);

          return (
            <div
              key={item.id}
              className="flex-shrink-0 w-[280px] lg:w-[320px] group/card relative"
            >
              {/* Card */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                {/* Thumbnail */}
                {item.content_logo ? (
                  <img
                    src={item.content_logo}
                    alt={item.content_name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-card flex items-center justify-center">
                    <span className="text-4xl font-bold text-muted-foreground/30">
                      {item.content_name.charAt(0)}
                    </span>
                  </div>
                )}

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    size="lg"
                    className="gap-2 shadow-lg"
                    onClick={() => onPlay(item)}
                  >
                    <Play className="w-5 h-5 fill-current" />
                    Continuar
                  </Button>
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.content_id);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-black/80"
                  aria-label="Remover"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0">
                  <Progress value={progressPercent} className="h-1 rounded-none" />
                </div>
              </div>

              {/* Info */}
              <div className="mt-2 space-y-1">
                <h3 className="font-medium text-foreground truncate">
                  {item.content_name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="capitalize">
                    {item.content_type === 'movie' ? 'Filme' :
                     item.content_type === 'series' ? 'Série' :
                     item.content_type === 'episode' ? 'Episódio' : 'Ao Vivo'}
                  </span>
                  {remainingMinutes > 0 && (
                    <>
                      <span>•</span>
                      <span>{remainingMinutes} min restantes</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ContinueWatchingRow;
