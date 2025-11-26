import { Play, Heart, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ContentCardProps {
  id: string;
  name: string;
  logo?: string;
  category?: string;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  className?: string;
}

export function ContentCard({
  id,
  name,
  logo,
  category,
  isFavorite,
  onPlay,
  onToggleFavorite,
  className
}: ContentCardProps) {
  return (
    <div
      className={cn(
        "group relative flex-shrink-0 w-[200px] md:w-[280px] transition-all duration-300 hover:scale-105 hover:z-10",
        className
      )}
    >
      {/* Card Container */}
      <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-card border border-border shadow-card">
        {/* Image/Logo */}
        {logo ? (
          <img
            src={logo}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        
        {/* Fallback Background */}
        <div className={cn(
          "absolute inset-0 bg-gradient-card flex items-center justify-center",
          logo && "hidden"
        )}>
          <div className="text-center p-4">
            <p className="text-sm font-medium text-foreground line-clamp-2">
              {name}
            </p>
          </div>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Hover Actions */}
        <div className="absolute inset-0 flex flex-col items-center justify-end p-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
          {/* Title */}
          <h3 className="text-sm font-semibold text-foreground mb-2 line-clamp-2 text-center w-full">
            {name}
          </h3>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mb-2">
            <Button
              size="icon"
              variant="default"
              className="h-10 w-10 rounded-full bg-primary hover:bg-primary-glow shadow-glow"
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
            >
              <Play className="w-5 h-5 fill-current" />
            </Button>

            <Button
              size="icon"
              variant="outline"
              className={cn(
                "h-8 w-8 rounded-full",
                isFavorite && "bg-primary text-primary-foreground border-primary"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
            >
              <Heart className={cn("w-4 h-4", isFavorite && "fill-current")} />
            </Button>
          </div>

          {/* Category Badge */}
          {category && (
            <span className="text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
              {category}
            </span>
          )}
        </div>

        {/* Favorite Indicator (Top Right) */}
        {isFavorite && (
          <div className="absolute top-2 right-2 bg-primary rounded-full p-1.5 shadow-glow">
            <Heart className="w-3 h-3 fill-current text-primary-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
