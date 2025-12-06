import { useState, memo } from 'react';
import { Play, Heart, MoreVertical, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TVContentCardProps {
  id: string;
  name: string;
  logo?: string;
  category?: string;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  variant?: 'default' | 'wide' | 'poster';
  /** When true, card fills its container (for grid layouts). When false, uses fixed width (for scroll rows) */
  fillContainer?: boolean;
  /** Indicates if content is optimized and served from CDN (R2) */
  isOptimized?: boolean;
  className?: string;
}

/**
 * Memoized TV Content Card - Prevents unnecessary re-renders
 * Only re-renders when props actually change
 */
export const TVContentCard = memo(function TVContentCard({
  id,
  name,
  logo,
  category,
  isFavorite,
  onPlay,
  onToggleFavorite,
  variant = 'default',
  fillContainer = false,
  isOptimized = false,
  className
}: TVContentCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const aspectRatio = variant === 'poster' ? 'aspect-[2/3]' : 
                      variant === 'wide' ? 'aspect-[21/9]' : 'aspect-video';
  
  // Fixed widths for horizontal scroll (TVContentRow)
  const fixedWidth = variant === 'poster' ? 'w-[140px] lg:w-[160px]' : 
                     variant === 'wide' ? 'w-[300px] lg:w-[380px]' : 'w-[200px] lg:w-[240px] xl:w-[280px]';

  return (
    <div
      className={cn(
        "group relative transition-all duration-300 ease-out",
        "focus-within:scale-105 focus-within:z-20 hover:scale-105 hover:z-20",
        fillContainer ? "w-full" : cn("flex-shrink-0", fixedWidth),
        className
      )}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      {/* Card Container */}
      <button
        onClick={onPlay}
        className={cn(
          "relative w-full rounded-lg lg:rounded-xl overflow-hidden bg-card",
          "border-2 border-transparent transition-all duration-300",
          "focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20",
          "group-hover:border-primary/50 group-hover:shadow-xl group-hover:shadow-primary/10",
          aspectRatio
        )}
      >
        {/* Image/Logo - Optimized with reserved space */}
        {logo && !imageError ? (
          <img
            src={logo}
            alt={name}
            width={280}
            height={158}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center p-3">
            <span className="text-xs lg:text-sm font-medium text-center text-muted-foreground line-clamp-3">
              {name}
            </span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent",
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300"
        )} />

        {/* Play Button Overlay */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center",
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-300",
          "transform scale-75 group-hover:scale-100 group-focus-within:scale-100"
        )}>
          <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-primary flex items-center justify-center shadow-glow">
            <Play className="w-5 h-5 lg:w-6 lg:h-6 text-primary-foreground fill-current ml-0.5" />
          </div>
        </div>

        {/* Badges */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {/* CDN Optimized Badge */}
          {isOptimized && (
            <div 
              className="bg-emerald-500/90 rounded-full p-1.5 shadow-lg"
              title="Conteúdo otimizado - CDN"
            >
              <Zap className="w-3 h-3 text-white" />
            </div>
          )}
          
          {/* Favorite Badge */}
          {isFavorite && (
            <div className="bg-primary rounded-full p-1.5 shadow-lg">
              <Heart className="w-3 h-3 text-primary-foreground fill-current" />
            </div>
          )}
        </div>
      </button>

      {/* Card Info - compact on mobile */}
      <div className="mt-1 sm:mt-2 lg:mt-3 px-0.5">
        <h3 className="text-[10px] sm:text-sm lg:text-base font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {name}
        </h3>
        
        {category && (
          <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1 hidden sm:block">
            {category}
          </p>
        )}
      </div>

      {/* Quick Actions (visible on hover/focus) */}
      <div className={cn(
        "absolute top-2 left-2 flex items-center gap-1",
        "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300"
      )}>
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            "h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 border-0",
            isFavorite && "text-primary"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
        >
          <Heart className={cn("w-3.5 h-3.5", isFavorite && "fill-current")} />
        </Button>
      </div>
    </div>
  );
});

export default TVContentCard;
