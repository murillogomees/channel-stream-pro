/**
 * TVHeroCarousel - Netflix-style hero banner with auto-rotation
 */

import { useState, useEffect, useCallback } from 'react';
import { Play, Info, Plus, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ContentType } from '../types';

interface HeroItem {
  id: string;
  title: string;
  description?: string;
  backdrop_url?: string;
  poster_url?: string;
  content_type: ContentType;
  year?: number;
  rating?: number;
  genres?: string[];
  trailer_url?: string;
}

interface TVHeroCarouselProps {
  items: HeroItem[];
  onPlay: (item: HeroItem) => void;
  onInfo: (item: HeroItem) => void;
  onAddToList: (item: HeroItem) => void;
  autoRotateInterval?: number;
}

export function TVHeroCarousel({
  items,
  onPlay,
  onInfo,
  onAddToList,
  autoRotateInterval = 8000,
}: TVHeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isHovering, setIsHovering] = useState(false);

  const featuredItems = items.slice(0, 5);
  const currentItem = featuredItems[activeIndex];

  // Auto-rotate
  useEffect(() => {
    if (featuredItems.length <= 1 || isHovering) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % featuredItems.length);
    }, autoRotateInterval);

    return () => clearInterval(interval);
  }, [featuredItems.length, autoRotateInterval, isHovering]);

  const goToSlide = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  if (!currentItem) {
    return (
      <div className="relative h-[60vh] min-h-[400px] lg:h-[70vh] bg-gradient-to-b from-background/50 to-background animate-pulse" />
    );
  }

  return (
    <section
      className="relative h-[60vh] min-h-[400px] lg:h-[70vh] overflow-hidden"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Background with transitions */}
      <div className="absolute inset-0">
        {featuredItems.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-1000",
              index === activeIndex ? "opacity-100" : "opacity-0"
            )}
          >
            {item.backdrop_url ? (
              <img
                src={item.backdrop_url}
                alt={item.title}
                className="w-full h-full object-cover object-top"
                loading={index === 0 ? "eager" : "lazy"}
              />
            ) : item.poster_url ? (
              <img
                src={item.poster_url}
                alt={item.title}
                className="w-full h-full object-cover object-center blur-sm scale-110"
                loading={index === 0 ? "eager" : "lazy"}
              />
            ) : (
              <div className="w-full h-full bg-gradient-card" />
            )}
          </div>
        ))}

        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end pb-16 lg:pb-24 px-4 lg:px-12">
        <div className="max-w-2xl space-y-4">
          {/* Content Type Badge */}
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground rounded">
              {currentItem.content_type === 'movie' ? 'Filme' : 
               currentItem.content_type === 'series' ? 'Série' : 'Ao Vivo'}
            </span>
            {currentItem.rating && (
              <span className="flex items-center gap-1 text-sm text-yellow-400">
                ★ {currentItem.rating.toFixed(1)}
              </span>
            )}
            {currentItem.year && (
              <span className="text-sm text-muted-foreground">{currentItem.year}</span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight tracking-tight">
            {currentItem.title}
          </h1>

          {/* Genres */}
          {currentItem.genres && currentItem.genres.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {currentItem.genres.slice(0, 3).map((genre, i) => (
                <span key={genre}>
                  {genre}
                  {i < Math.min(currentItem.genres!.length - 1, 2) && (
                    <span className="ml-2">•</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {currentItem.description && (
            <p className="text-base lg:text-lg text-muted-foreground line-clamp-3 max-w-xl">
              {currentItem.description}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              size="lg"
              className="gap-2 px-8 h-12 lg:h-14 text-base lg:text-lg font-semibold shadow-glow hover:shadow-glow-lg transition-all"
              onClick={() => onPlay(currentItem)}
            >
              <Play className="w-5 h-5 lg:w-6 lg:h-6 fill-current" />
              Assistir
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="gap-2 h-12 lg:h-14 px-6 bg-background/30 backdrop-blur-sm border-border/50 hover:bg-background/50"
              onClick={() => onInfo(currentItem)}
            >
              <Info className="w-5 h-5" />
              <span className="hidden sm:inline">Mais Informações</span>
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 lg:h-14 lg:w-14 bg-background/30 backdrop-blur-sm border-border/50 hover:bg-background/50"
              onClick={() => onAddToList(currentItem)}
            >
              <Plus className="w-5 h-5 lg:w-6 lg:h-6" />
            </Button>

            {currentItem.trailer_url && (
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 lg:h-14 lg:w-14 ml-auto"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Carousel Indicators */}
        {featuredItems.length > 1 && (
          <div className="absolute bottom-8 right-4 lg:right-12 flex items-center gap-2">
            {featuredItems.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  index === activeIndex
                    ? "w-8 bg-primary"
                    : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground/60"
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default TVHeroCarousel;
