/**
 * Top10Row - Netflix-style Top 10 ranking display
 */

import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TrendingItem, ContentType } from '../types';

interface Top10RowProps {
  items: TrendingItem[];
  title?: string;
  onPlay: (item: TrendingItem) => void;
  onInfo: (item: TrendingItem) => void;
  isLoading?: boolean;
}

// Large number SVGs for ranking display
const RankNumbers: Record<number, React.ReactNode> = {
  1: <span className="text-[120px] lg:text-[160px] font-black text-transparent stroke-text">1</span>,
  2: <span className="text-[120px] lg:text-[160px] font-black text-transparent stroke-text">2</span>,
  3: <span className="text-[120px] lg:text-[160px] font-black text-transparent stroke-text">3</span>,
  4: <span className="text-[120px] lg:text-[160px] font-black text-transparent stroke-text">4</span>,
  5: <span className="text-[120px] lg:text-[160px] font-black text-transparent stroke-text">5</span>,
  6: <span className="text-[120px] lg:text-[160px] font-black text-transparent stroke-text">6</span>,
  7: <span className="text-[120px] lg:text-[160px] font-black text-transparent stroke-text">7</span>,
  8: <span className="text-[120px] lg:text-[160px] font-black text-transparent stroke-text">8</span>,
  9: <span className="text-[120px] lg:text-[160px] font-black text-transparent stroke-text">9</span>,
  10: <span className="text-[100px] lg:text-[140px] font-black text-transparent stroke-text">10</span>,
};

export function Top10Row({
  items,
  title = "Top 10 da Semana",
  onPlay,
  onInfo,
  isLoading = false,
}: Top10RowProps) {
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
          {title}
        </h2>
        <div className="flex gap-3 px-4 lg:px-12 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[200px] lg:w-[240px] h-[280px] lg:h-[340px] bg-muted animate-pulse rounded-lg"
            />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  const top10Items = items.slice(0, 10);

  return (
    <section className="py-6 group/section">
      <div className="flex items-center justify-between mb-4 px-4 lg:px-12">
        <h2 className="text-xl lg:text-2xl font-semibold text-foreground flex items-center gap-2">
          <span className="text-primary">🔥</span>
          {title}
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
        className="flex gap-1 px-4 lg:px-12 overflow-x-auto scrollbar-hide scroll-smooth"
      >
        {top10Items.map((item, index) => (
          <div
            key={item.id}
            className="flex-shrink-0 flex items-end group/card cursor-pointer"
            onClick={() => onInfo(item)}
          >
            {/* Rank Number */}
            <div className="relative -mr-6 lg:-mr-8 z-0 select-none leading-none">
              <span 
                className={cn(
                  "text-[120px] lg:text-[160px] font-black leading-none",
                  "bg-gradient-to-b from-muted-foreground/20 to-transparent bg-clip-text text-transparent",
                  "drop-shadow-lg"
                )}
                style={{
                  WebkitTextStroke: '2px hsl(var(--muted-foreground) / 0.3)',
                }}
              >
                {index + 1}
              </span>
            </div>

            {/* Poster Card */}
            <div className="relative w-[140px] lg:w-[180px] h-[200px] lg:h-[260px] rounded-lg overflow-hidden bg-muted z-10 transition-transform duration-300 group-hover/card:scale-105">
              {item.content_logo ? (
                <img
                  src={item.content_logo}
                  alt={item.content_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-card flex items-center justify-center">
                  <span className="text-3xl font-bold text-muted-foreground/30">
                    {item.content_name.charAt(0)}
                  </span>
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex flex-col items-center justify-end p-4">
                <Button
                  size="sm"
                  className="gap-1 w-full mb-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(item);
                  }}
                >
                  <Play className="w-4 h-4 fill-current" />
                  Assistir
                </Button>
                <span className="text-xs text-muted-foreground text-center truncate w-full">
                  {item.content_name}
                </span>
              </div>

              {/* View count badge */}
              {item.view_count > 0 && (
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 rounded text-xs text-white">
                  {item.view_count > 1000 
                    ? `${(item.view_count / 1000).toFixed(1)}k` 
                    : item.view_count} views
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Top10Row;
