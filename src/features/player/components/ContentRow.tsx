/**
 * ContentRow - Generic horizontal scrolling content row
 */

import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RecommendationItem, ContentType } from '../types';

interface ContentRowProps {
  title: string;
  items: RecommendationItem[];
  onPlay: (item: RecommendationItem) => void;
  onInfo: (item: RecommendationItem) => void;
  onAddToList: (item: RecommendationItem) => void;
  isLoading?: boolean;
  variant?: 'poster' | 'backdrop' | 'square';
  showRating?: boolean;
}

export function ContentRow({
  title,
  items,
  onPlay,
  onInfo,
  onAddToList,
  isLoading = false,
  variant = 'poster',
  showRating = true,
}: ContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const getCardDimensions = () => {
    switch (variant) {
      case 'backdrop':
        return 'w-[280px] lg:w-[320px] aspect-video';
      case 'square':
        return 'w-[160px] lg:w-[200px] aspect-square';
      case 'poster':
      default:
        return 'w-[140px] lg:w-[180px] aspect-[2/3]';
    }
  };

  if (isLoading) {
    return (
      <section className="py-6">
        <h2 className="text-xl lg:text-2xl font-semibold text-foreground mb-4 px-4 lg:px-12">
          {title}
        </h2>
        <div className="flex gap-3 px-4 lg:px-12 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex-shrink-0 bg-muted animate-pulse rounded-lg",
                getCardDimensions()
              )}
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
        className="flex gap-3 px-4 lg:px-12 overflow-x-auto scrollbar-hide scroll-smooth"
      >
        {items.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            className={cn(
              "flex-shrink-0 group/card cursor-pointer",
              getCardDimensions()
            )}
            onClick={() => onInfo(item)}
          >
            {/* Card */}
            <div className="relative w-full h-full rounded-lg overflow-hidden bg-muted transition-transform duration-300 group-hover/card:scale-105 group-hover/card:ring-2 group-hover/card:ring-primary">
              {/* Image */}
              {item.content_logo ? (
                <img
                  src={item.content_logo}
                  alt={item.content_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-card flex items-center justify-center">
                  <span className="text-3xl font-bold text-muted-foreground/30">
                    {item.content_name.charAt(0)}
                  </span>
                </div>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex flex-col justify-end p-3">
                {/* Quick Actions */}
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(item);
                    }}
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-background/20 border-border/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToList(item);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-background/20 border-border/50 ml-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInfo(item);
                    }}
                  >
                    <Info className="w-4 h-4" />
                  </Button>
                </div>

                {/* Title & Info */}
                <h3 className="font-medium text-white text-sm truncate">
                  {item.content_name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-gray-300">
                  {showRating && item.score && (
                    <span className="text-green-400 font-semibold">
                      {Math.round(item.score * 10)}% Match
                    </span>
                  )}
                  <span className="capitalize">
                    {item.content_type === 'movie' ? 'Filme' :
                     item.content_type === 'series' ? 'Série' : 'Ao Vivo'}
                  </span>
                </div>
                {item.content_category && (
                  <span className="text-xs text-gray-400 truncate">
                    {item.content_category}
                  </span>
                )}
              </div>

              {/* Content Type Badge */}
              <div className="absolute top-2 left-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                <span className={cn(
                  "px-2 py-0.5 text-xs font-medium rounded",
                  item.content_type === 'live' 
                    ? "bg-red-500 text-white" 
                    : "bg-background/80 text-foreground"
                )}>
                  {item.content_type === 'live' && '● '}
                  {item.content_type === 'movie' ? 'Filme' :
                   item.content_type === 'series' ? 'Série' : 'Ao Vivo'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ContentRow;
