/**
 * MovieDetailSheet - Full movie details modal/sheet
 */

import { memo, useState, useEffect } from 'react';
import { 
  X, Play, Plus, Star, Clock, Calendar, Users, 
  ChevronRight, Heart, Share2, Volume2, VolumeX 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { ContentMetadata } from '../types';

interface MovieDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  movie: {
    id: string;
    name: string;
    tvg_logo?: string;
    category_name?: string;
    stream_url: string;
  } | null;
  metadata?: ContentMetadata | null;
  isLoadingMetadata?: boolean;
  onPlay: () => void;
  onAddToList?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  similarMovies?: any[];
}

export const MovieDetailSheet = memo(function MovieDetailSheet({
  isOpen,
  onClose,
  movie,
  metadata,
  isLoadingMetadata,
  onPlay,
  onAddToList,
  onToggleFavorite,
  isFavorite,
  similarMovies = [],
}: MovieDetailSheetProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timeout = setTimeout(() => setShow(false), 300);
      document.body.style.overflow = '';
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  if (!show || !movie) return null;

  const displayTitle = metadata?.title || movie.name;
  const displayYear = metadata?.year;
  const displayRating = metadata?.tmdb_rating;
  const displayDuration = metadata?.duration_minutes;
  const displayDescription = metadata?.description;
  const displayGenres = metadata?.genres || [];
  const displayCast = metadata?.cast_members || [];
  const displayDirector = metadata?.director;
  const backdropUrl = metadata?.backdrop_url || movie.tvg_logo;
  const posterUrl = metadata?.poster_url || movie.tvg_logo;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/80 z-50 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 max-h-[90vh] bg-background rounded-t-3xl',
          'transform transition-transform duration-300 ease-out',
          'md:inset-y-4 md:right-4 md:left-auto md:w-[500px] md:rounded-2xl md:max-h-none',
          isOpen ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'
        )}
      >
        <ScrollArea className="h-full max-h-[90vh] md:max-h-[calc(100vh-2rem)]">
          {/* Hero Image */}
          <div className="relative aspect-video bg-muted">
            {backdropUrl ? (
              <img
                src={backdropUrl}
                alt={displayTitle}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-background">
                <span className="text-6xl font-bold text-muted-foreground/20">
                  {displayTitle[0]}
                </span>
              </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="absolute top-4 right-4 bg-background/50 backdrop-blur-sm hover:bg-background/80"
            >
              <X className="w-5 h-5" />
            </Button>

            {/* Rating Badge */}
            {displayRating && (
              <div className="absolute top-4 left-4 flex items-center gap-1 px-2 py-1 bg-background/80 backdrop-blur-sm rounded-lg">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-semibold">{displayRating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6 -mt-16 relative">
            {/* Poster & Title */}
            <div className="flex gap-4 mb-6">
              {posterUrl && (
                <div className="w-24 h-36 flex-shrink-0 rounded-lg overflow-hidden shadow-xl">
                  <img
                    src={posterUrl}
                    alt={displayTitle}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex-1 min-w-0 pt-12">
                {isLoadingMetadata ? (
                  <Skeleton className="h-7 w-48 mb-2" />
                ) : (
                  <h1 className="text-2xl font-bold text-foreground mb-2 line-clamp-2">
                    {displayTitle}
                  </h1>
                )}

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {displayYear && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {displayYear}
                    </span>
                  )}
                  {displayDuration && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {Math.floor(displayDuration / 60)}h {displayDuration % 60}min
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
              <Button
                size="lg"
                onClick={onPlay}
                className="flex-1"
              >
                <Play className="w-5 h-5 mr-2 fill-current" />
                Assistir
              </Button>

              {onToggleFavorite && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={onToggleFavorite}
                  className={cn(isFavorite && 'text-red-500 border-red-500/50')}
                >
                  <Heart className={cn('w-5 h-5', isFavorite && 'fill-current')} />
                </Button>
              )}

              {onAddToList && (
                <Button variant="outline" size="lg" onClick={onAddToList}>
                  <Plus className="w-5 h-5" />
                </Button>
              )}
            </div>

            {/* Genres */}
            {displayGenres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {displayGenres.map((genre, i) => (
                  <Badge key={i} variant="secondary">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {/* Description */}
            {isLoadingMetadata ? (
              <div className="space-y-2 mb-6">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : displayDescription ? (
              <p className="text-muted-foreground leading-relaxed mb-6">
                {displayDescription}
              </p>
            ) : null}

            {/* Director */}
            {displayDirector && (
              <div className="mb-4">
                <span className="text-sm text-muted-foreground">Diretor: </span>
                <span className="text-sm font-medium">{displayDirector}</span>
              </div>
            )}

            {/* Cast */}
            {displayCast.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Elenco
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {displayCast.slice(0, 6).map((actor, i) => (
                    <div key={i} className="flex-shrink-0 w-16 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted overflow-hidden mb-2">
                        {actor.profile_url ? (
                          <img
                            src={actor.profile_url}
                            alt={actor.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
                            {actor.name[0]}
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-medium truncate">{actor.name}</p>
                      {actor.character && (
                        <p className="text-xs text-muted-foreground truncate">
                          {actor.character}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Similar Movies */}
            {similarMovies.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Títulos Semelhantes</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {similarMovies.slice(0, 6).map((similar, i) => (
                    <div key={i} className="flex-shrink-0 w-28">
                      <div className="aspect-[2/3] rounded-lg bg-muted overflow-hidden mb-2">
                        {similar.poster_url ? (
                          <img
                            src={similar.poster_url}
                            alt={similar.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground/30">
                            ?
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-medium truncate">
                        {similar.title || similar.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
});
