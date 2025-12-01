/**
 * SeriesCard - Card component for displaying series with metadata
 */

import { memo } from 'react';
import { Play, Info, Heart, Star, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getSafeImageUrl } from '@/utils/imageUtils';
import type { SeriesMetadata } from '../types/series';

interface SeriesCardProps {
  id: string;
  name: string;
  logo?: string;
  category?: string;
  metadata?: SeriesMetadata;
  isFavorite: boolean;
  onPlay: () => void;
  onInfo: () => void;
  onToggleFavorite: () => void;
  className?: string;
}

export const SeriesCard = memo(function SeriesCard({
  id,
  name,
  logo,
  category,
  metadata,
  isFavorite,
  onPlay,
  onInfo,
  onToggleFavorite,
  className,
}: SeriesCardProps) {
  const posterUrl = getSafeImageUrl(metadata?.poster_url || logo);
  const displayName = metadata?.title || name;
  const rating = metadata?.tmdb_rating;
  const year = metadata?.year;
  const totalSeasons = metadata?.total_seasons;

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg bg-card transition-all duration-300',
        'hover:scale-105 hover:z-10 hover:shadow-2xl hover:shadow-primary/20',
        'focus-within:scale-105 focus-within:ring-2 focus-within:ring-primary',
        className
      )}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={displayName}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = '/placeholder.svg';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <span className="text-4xl text-muted-foreground/50">📺</span>
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Rating badge */}
        {rating && rating > 0 && (
          <Badge className="absolute top-2 left-2 bg-black/70 text-white border-0 gap-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            {rating.toFixed(1)}
          </Badge>
        )}

        {/* Season count badge */}
        {totalSeasons && totalSeasons > 0 && (
          <Badge className="absolute top-2 right-2 bg-primary/90 text-primary-foreground border-0">
            {totalSeasons} temp.
          </Badge>
        )}

        {/* Favorite button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={cn(
            'absolute bottom-2 right-2 w-8 h-8 rounded-full transition-all',
            'opacity-0 group-hover:opacity-100',
            'bg-black/50 hover:bg-black/70',
            isFavorite && 'opacity-100 text-red-500'
          )}
        >
          <Heart className={cn('w-4 h-4', isFavorite && 'fill-current')} />
        </Button>

        {/* Action buttons on hover */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button
            size="sm"
            onClick={onPlay}
            className="bg-primary hover:bg-primary/90 shadow-lg"
          >
            <Play className="w-4 h-4 mr-1 fill-current" />
            Assistir
          </Button>
          <Button
            size="icon"
            variant="secondary"
            onClick={onInfo}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm"
          >
            <Info className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="p-2 sm:p-3 space-y-1">
        <h3 className="font-medium text-sm line-clamp-2 leading-tight">
          {displayName}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {year && (
            <span className="flex items-center gap-0.5">
              <Calendar className="w-3 h-3" />
              {year}
            </span>
          )}
          {category && (
            <span className="truncate">{category}</span>
          )}
        </div>
      </div>
    </div>
  );
});

export function SeriesCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg bg-card">
      <Skeleton className="aspect-[2/3] w-full" />
      <div className="p-2 sm:p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
