import { useState, useEffect, memo } from 'react';
import { Play, Info, Heart, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OptimizedImage } from './OptimizedImage';

interface FeaturedItem {
  id: string;
  name: string;
  logo?: string;
  category?: string;
  description?: string;
}

interface TVHeroSectionProps {
  items: FeaturedItem[];
  onPlay: (item: FeaturedItem) => void;
  onToggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

export const TVHeroSection = memo(function TVHeroSection({ items, onPlay, onToggleFavorite, isFavorite }: TVHeroSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const featuredItems = items.slice(0, 5);
  const currentItem = featuredItems[activeIndex];

  // Auto-rotate featured content
  useEffect(() => {
    if (featuredItems.length <= 1) return;
    
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % featuredItems.length);
    }, 8000);
    
    return () => clearInterval(interval);
  }, [featuredItems.length]);

  // Reserve space even when no content (prevents CLS)
  if (!currentItem) {
    return (
      <section 
        className="relative overflow-hidden bg-muted"
        style={{ height: 'clamp(400px, 50vh, 60vh)' }}
      />
    );
  }

  return (
    <section 
      className="relative overflow-hidden"
      style={{ height: 'clamp(400px, 50vh, 60vh)' }}
    >
      {/* Background Image - Optimized for LCP */}
      <div className="absolute inset-0">
        {currentItem.logo ? (
          <OptimizedImage
            src={currentItem.logo}
            alt={currentItem.name}
            aspectRatio="21/9"
            priority={activeIndex === 0} // Priority for first image (LCP)
            containerClassName="w-full h-full"
            className="transition-opacity duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-card" />
        )}
        
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end pb-12 lg:pb-16 pl-4 lg:pl-8 pr-4">
        {/* Category Badge */}
        {currentItem.category && (
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full mb-4 w-fit">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            {currentItem.category}
          </span>
        )}

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground mb-4 max-w-2xl leading-tight">
          {currentItem.name}
        </h1>

        {/* Description */}
        {currentItem.description && (
          <p className="text-sm lg:text-base text-muted-foreground max-w-xl mb-6 line-clamp-2">
            {currentItem.description}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            size="lg"
            className="gap-2 px-6 lg:px-8 h-12 lg:h-14 text-base lg:text-lg font-semibold shadow-glow hover:shadow-glow-lg transition-shadow"
            onClick={() => onPlay(currentItem)}
          >
            <Play className="w-5 h-5 lg:w-6 lg:h-6 fill-current" />
            Assistir
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            className={cn(
              "gap-2 h-12 lg:h-14 px-4 lg:px-6 bg-background/20 backdrop-blur-sm border-border/50 hover:bg-background/40",
              isFavorite(currentItem.id) && "border-primary text-primary"
            )}
            onClick={() => onToggleFavorite(currentItem.id)}
          >
            <Heart className={cn("w-5 h-5", isFavorite(currentItem.id) && "fill-current")} />
            <span className="hidden sm:inline">
              {isFavorite(currentItem.id) ? 'Favoritado' : 'Favoritar'}
            </span>
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 lg:h-14 lg:w-14 bg-background/20 backdrop-blur-sm border-border/50 hover:bg-background/40"
          >
            <Plus className="w-5 h-5 lg:w-6 lg:h-6" />
          </Button>
        </div>

        {/* Carousel Indicators */}
        {featuredItems.length > 1 && (
          <div className="flex items-center gap-2">
            {featuredItems.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  index === activeIndex 
                    ? "w-8 bg-primary" 
                    : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground/60"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
});

export default TVHeroSection;
