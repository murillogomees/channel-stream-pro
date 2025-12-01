/**
 * MovieCard - Enhanced movie card with TMDB metadata
 */

import { memo, useState } from 'react';
import { Play, Plus, Star, Info, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getSafeImageUrl } from '@/utils/imageUtils';
import type { ContentMetadata } from '../types';

interface MovieCardProps {
  id: string;
  name: string;
  logo?: string;
  category?: string;
  metadata?: ContentMetadata | null;
  isLoadingMetadata?: boolean;
  isFavorite?: boolean;
  onPlay: () => void;
  onInfo: () => void;
  onToggleFavorite?: () => void;
  variant?: 'default' | 'compact' | 'large';
  className?: string;
}

export const MovieCard = memo(function MovieCard({
  id,
  name,
  logo,
  category,
  metadata,
  isLoadingMetadata,
  isFavorite,
  onPlay,
  onInfo,
  onToggleFavorite,
  variant = 'default',
  className,
}: MovieCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Use TMDB data if available
  const displayTitle = metadata?.title || name;
  const displayPoster = getSafeImageUrl(metadata?.poster_url || logo);
  const displayRating = metadata?.tmdb_rating;
  const displayYear = metadata?.year;
  const displayGenres = metadata?.genres?.slice(0, 2) || [];

  const isCompact = variant === 'compact';
  const isLarge = variant === 'large';

  return (
    <div
      className={cn(
        'group relative rounded-lg overflow-hidden transition-all duration-300',
        'bg-card hover:shadow-xl hover:shadow-primary/10',
        isLarge ? 'aspect-[2/3]' : isCompact ? 'aspect-video' : 'aspect-[2/3]',
        isHovered && 'scale-105 z-10',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onInfo}
    >
      {/* Poster */}
      {isLoadingMetadata ? (
        <Skeleton className="absolute inset-0" />
      ) : displayPoster && !imageError ? (
        <img
          src={displayPoster}
          alt={displayTitle}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          <span className="text-4xl font-bold text-muted-foreground/20">
            {displayTitle[0]?.toUpperCase()}
          </span>
        </div>
      )}

      {/* Gradient Overlay */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent',
        'opacity-70 group-hover:opacity-100 transition-opacity duration-300'
      )} />

      {/* Rating Badge */}
      {displayRating && displayRating > 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded text-xs">
          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
          <span className="font-medium">{displayRating.toFixed(1)}</span>
        </div>
      )}

      {/* Favorite Badge */}
      {isFavorite && (
        <div className="absolute top-2 left-2">
          <Heart className="w-5 h-5 text-red-500 fill-red-500" />
        </div>
      )}

      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 p-3 transform transition-transform duration-300">
        {/* Title & Meta */}
        <div className="mb-2">
          <h3 className="font-semibold text-white text-sm line-clamp-2 mb-1">
            {displayTitle}
          </h3>
          
          <div className="flex items-center gap-2 text-xs text-white/70">
            {displayYear && <span>{displayYear}</span>}
            {displayGenres.length > 0 && (
              <>
                {displayYear && <span>•</span>}
                <span className="truncate">{displayGenres.join(', ')}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions - Show on hover */}
        <div className={cn(
          'flex gap-2 transition-all duration-300',
          isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        )}>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="flex-1 h-8"
          >
            <Play className="w-4 h-4 mr-1 fill-current" />
            Assistir
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onInfo();
            }}
            className="h-8 px-2"
          >
            <Info className="w-4 h-4" />
          </Button>

          {onToggleFavorite && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={cn('h-8 px-2', isFavorite && 'text-red-500')}
            >
              <Heart className={cn('w-4 h-4', isFavorite && 'fill-current')} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

// Skeleton loader
export const MovieCardSkeleton = memo(function MovieCardSkeleton({
  variant = 'default',
}: { variant?: 'default' | 'compact' | 'large' }) {
  const isCompact = variant === 'compact';
  
  return (
    <div className={cn(
      'rounded-lg overflow-hidden',
      isCompact ? 'aspect-video' : 'aspect-[2/3]'
    )}>
      <Skeleton className="w-full h-full" />
    </div>
  );
});
