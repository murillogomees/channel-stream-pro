/**
 * SeriesDetailSheet - Detailed view sheet for series with seasons/episodes
 */

import { useState, useEffect } from 'react';
import { X, Play, Heart, Star, Calendar, Clock, Users, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useSeriesMetadata } from '../hooks/useSeriesMetadata';
import type { SeriesMetadata, Episode } from '../types/series';

interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo?: string;
  category_name?: string;
}

interface SeriesDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  series: Channel | null;
  metadata: SeriesMetadata | null;
  isLoadingMetadata: boolean;
  onPlay: (episode?: { season: number; episode: number; name?: string }) => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  // Episodes list for this series
  relatedEpisodes?: Channel[];
}

export function SeriesDetailSheet({
  isOpen,
  onClose,
  series,
  metadata,
  isLoadingMetadata,
  onPlay,
  onToggleFavorite,
  isFavorite,
  relatedEpisodes = [],
}: SeriesDetailSheetProps) {
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const { fetchSeasonDetails } = useSeriesMetadata();

  // Load episodes when season changes
  useEffect(() => {
    if (!metadata?.tmdb_id || !isOpen) return;

    const loadEpisodes = async () => {
      setLoadingEpisodes(true);
      try {
        const eps = await fetchSeasonDetails(metadata.tmdb_id!, selectedSeason);
        if (eps) {
          setEpisodes(eps);
        }
      } catch (err) {
        console.error('[SeriesDetailSheet] Error loading episodes:', err);
      } finally {
        setLoadingEpisodes(false);
      }
    };

    loadEpisodes();
  }, [metadata?.tmdb_id, selectedSeason, isOpen, fetchSeasonDetails]);

  // Reset season when series changes
  useEffect(() => {
    setSelectedSeason(1);
    setEpisodes([]);
  }, [series?.id]);

  if (!series) return null;

  const displayName = metadata?.title || series.name;
  const posterUrl = metadata?.poster_url || series.tvg_logo;
  const backdropUrl = metadata?.backdrop_url;

  // Parse episodes from relatedEpisodes if available
  const parsedEpisodes = relatedEpisodes
    .map(ep => {
      const match = ep.name.match(/S(\d{1,2})[\s]*E(\d{1,3})/i) ||
                   ep.name.match(/(\d{1,2})x(\d{1,3})/i) ||
                   ep.name.match(/Temporada\s*(\d+).*?Ep[is]*[óo]*d?i?o?\s*(\d+)/i);
      if (match) {
        return {
          ...ep,
          season: parseInt(match[1]),
          episode: parseInt(match[2]),
        };
      }
      return null;
    })
    .filter(Boolean)
    .filter(ep => ep!.season === selectedSeason)
    .sort((a, b) => a!.episode - b!.episode);

  const availableSeasons = [...new Set(
    relatedEpisodes
      .map(ep => {
        const match = ep.name.match(/S(\d{1,2})/i) ||
                     ep.name.match(/(\d{1,2})x/i) ||
                     ep.name.match(/Temporada\s*(\d+)/i);
        return match ? parseInt(match[1]) : null;
      })
      .filter(Boolean)
  )].sort((a, b) => a! - b!);

  const seasonsToShow = metadata?.seasons?.filter(s => s.season_number > 0) || 
    availableSeasons.map(n => ({ season_number: n!, name: `Temporada ${n}`, episode_count: 0 }));

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 overflow-hidden">
        {/* Backdrop header */}
        <div className="relative h-48 sm:h-64 overflow-hidden">
          {backdropUrl ? (
            <img
              src={backdropUrl}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>

          {/* Poster overlay */}
          <div className="absolute -bottom-12 left-4 w-24 sm:w-32 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl border-4 border-background">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <span className="text-3xl">📺</span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="h-[calc(100vh-12rem)] sm:h-[calc(100vh-16rem)]">
          <div className="p-4 pt-16 sm:pt-20 space-y-4">
            {/* Header info */}
            <SheetHeader className="text-left">
              <SheetTitle className="text-xl sm:text-2xl font-bold">
                {isLoadingMetadata ? <Skeleton className="h-8 w-3/4" /> : displayName}
              </SheetTitle>
              
              {/* Metadata badges */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {metadata?.tmdb_rating && (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    {metadata.tmdb_rating.toFixed(1)}
                  </Badge>
                )}
                {metadata?.year && (
                  <Badge variant="secondary" className="gap-1">
                    <Calendar className="w-3 h-3" />
                    {metadata.year}
                  </Badge>
                )}
                {metadata?.total_seasons && (
                  <Badge variant="secondary">
                    {metadata.total_seasons} temporada{metadata.total_seasons > 1 ? 's' : ''}
                  </Badge>
                )}
                {metadata?.total_episodes && (
                  <Badge variant="outline">
                    {metadata.total_episodes} episódios
                  </Badge>
                )}
                {metadata?.status && (
                  <Badge variant={metadata.status === 'Ended' ? 'secondary' : 'default'}>
                    {metadata.status === 'Returning Series' ? 'Em exibição' : 
                     metadata.status === 'Ended' ? 'Finalizada' : metadata.status}
                  </Badge>
                )}
              </div>
            </SheetHeader>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button onClick={() => onPlay()} className="flex-1 gap-2">
                <Play className="w-4 h-4 fill-current" />
                Assistir
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onToggleFavorite}
                className={cn(isFavorite && 'text-red-500 border-red-500/50')}
              >
                <Heart className={cn('w-5 h-5', isFavorite && 'fill-current')} />
              </Button>
            </div>

            {/* Genres */}
            {metadata?.genres && metadata.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {metadata.genres.map((genre) => (
                  <Badge key={genre} variant="outline" className="text-xs">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {/* Description */}
            {metadata?.description ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {metadata.description}
              </p>
            ) : isLoadingMetadata ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            ) : null}

            {/* Cast */}
            {metadata?.cast_members && metadata.cast_members.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Elenco
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {metadata.cast_members.slice(0, 8).map((member) => (
                    <Badge key={member.name} variant="secondary" className="text-xs">
                      {member.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Seasons & Episodes */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Episódios</h4>
                {seasonsToShow.length > 0 && (
                  <Select 
                    value={String(selectedSeason)} 
                    onValueChange={(v) => setSelectedSeason(parseInt(v))}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Temporada" />
                    </SelectTrigger>
                    <SelectContent>
                      {seasonsToShow.map((season) => (
                        <SelectItem key={season.season_number} value={String(season.season_number)}>
                          Temporada {season.season_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Episodes list */}
              <div className="space-y-2">
                {loadingEpisodes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : parsedEpisodes.length > 0 ? (
                  parsedEpisodes.map((ep) => (
                    <button
                      key={ep!.id}
                      onClick={() => onPlay({ season: ep!.season, episode: ep!.episode })}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded bg-primary/20 flex items-center justify-center">
                        <Play className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          Episódio {ep!.episode}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {ep!.name}
                        </p>
                      </div>
                    </button>
                  ))
                ) : episodes.length > 0 ? (
                  episodes.map((ep) => (
                    <button
                      key={ep.id}
                      onClick={() => onPlay({ season: selectedSeason, episode: ep.episode_number, name: ep.name })}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                    >
                      {ep.still_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w185${ep.still_path}`}
                          alt={ep.name}
                          className="w-24 h-14 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-24 h-14 bg-muted rounded flex items-center justify-center flex-shrink-0">
                          <Play className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {ep.episode_number}. {ep.name}
                        </p>
                        {ep.runtime && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {ep.runtime} min
                          </p>
                        )}
                        {ep.overview && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {ep.overview}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Nenhum episódio encontrado para esta temporada</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
