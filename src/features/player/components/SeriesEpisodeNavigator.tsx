/**
 * SeriesEpisodeNavigator - Season/Episode selector and navigation for series
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Episode {
  id: string;
  name: string;
  stream_url?: string;
  tvg_logo?: string;
  category_name?: string;
  season: number;
  episode: number;
}

interface SeriesEpisodeNavigatorProps {
  episodes: Episode[];
  currentEpisode: Episode | null;
  onPlayEpisode: (episode: Episode) => void;
  seriesName: string;
  className?: string;
}

// Parse season/episode from channel name
export function parseEpisodeInfo(name: string): { season: number; episode: number } | null {
  // Try S01E01 pattern
  const match1 = name.match(/S(\d{1,2})[\s]*E(\d{1,3})/i);
  if (match1) {
    return { season: parseInt(match1[1]), episode: parseInt(match1[2]) };
  }
  
  // Try 1x01 pattern
  const match2 = name.match(/(\d{1,2})x(\d{1,3})/i);
  if (match2) {
    return { season: parseInt(match2[1]), episode: parseInt(match2[2]) };
  }
  
  // Try Temporada X Episódio Y pattern
  const match3 = name.match(/Temporada\s*(\d+).*?Ep[is]*[óo]*d?i?o?\s*(\d+)/i);
  if (match3) {
    return { season: parseInt(match3[1]), episode: parseInt(match3[2]) };
  }
  
  return null;
}

// Get first episode of a series (S01E01)
export function getFirstEpisode(episodes: Episode[]): Episode | null {
  if (!episodes.length) return null;
  
  // Sort by season then episode
  const sorted = [...episodes].sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    return a.episode - b.episode;
  });
  
  return sorted[0] || null;
}

// Check if user has watch history for a series
export function hasWatchHistoryForSeries(seriesName: string, watchHistory: Array<{ content_name?: string; content_id?: string }>): boolean {
  const normalizedSeriesName = seriesName.toLowerCase().trim();
  
  return watchHistory.some(item => {
    const itemName = (item.content_name || '').toLowerCase();
    return itemName.includes(normalizedSeriesName);
  });
}

export function SeriesEpisodeNavigator({
  episodes,
  currentEpisode,
  onPlayEpisode,
  seriesName,
  className,
}: SeriesEpisodeNavigatorProps) {
  // Get available seasons
  const seasons = useMemo(() => {
    const seasonSet = new Set<number>();
    episodes.forEach(ep => seasonSet.add(ep.season));
    return Array.from(seasonSet).sort((a, b) => a - b);
  }, [episodes]);

  const [selectedSeason, setSelectedSeason] = useState<number>(() => 
    currentEpisode?.season || seasons[0] || 1
  );

  // Update selected season when current episode changes
  useEffect(() => {
    if (currentEpisode?.season) {
      setSelectedSeason(currentEpisode.season);
    }
  }, [currentEpisode?.season]);

  // Get episodes for selected season
  const seasonEpisodes = useMemo(() => {
    return episodes
      .filter(ep => ep.season === selectedSeason)
      .sort((a, b) => a.episode - b.episode);
  }, [episodes, selectedSeason]);

  // Get current index in the full list
  const currentIndex = useMemo(() => {
    if (!currentEpisode) return -1;
    const sorted = [...episodes].sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season;
      return a.episode - b.episode;
    });
    return sorted.findIndex(ep => ep.id === currentEpisode.id);
  }, [episodes, currentEpisode]);

  // Sorted episodes for navigation
  const sortedEpisodes = useMemo(() => {
    return [...episodes].sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season;
      return a.episode - b.episode;
    });
  }, [episodes]);

  // Navigate to previous episode
  const handlePreviousEpisode = useCallback(() => {
    if (currentIndex <= 0) return;
    onPlayEpisode(sortedEpisodes[currentIndex - 1]);
  }, [currentIndex, sortedEpisodes, onPlayEpisode]);

  // Navigate to next episode
  const handleNextEpisode = useCallback(() => {
    if (currentIndex >= sortedEpisodes.length - 1) return;
    onPlayEpisode(sortedEpisodes[currentIndex + 1]);
  }, [currentIndex, sortedEpisodes, onPlayEpisode]);

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < sortedEpisodes.length - 1;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Header with series name and season selector */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-sm truncate">{seriesName}</h3>
        
        {seasons.length > 0 && (
          <Select 
            value={String(selectedSeason)} 
            onValueChange={(v) => setSelectedSeason(parseInt(v))}
          >
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="Temporada" />
            </SelectTrigger>
            <SelectContent className="z-[60]">
              {seasons.map((season) => (
                <SelectItem key={season} value={String(season)}>
                  Temporada {season}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Episode navigation buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreviousEpisode}
          disabled={!hasPrevious}
          className="gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </Button>
        
        <div className="flex-1 text-center text-sm text-muted-foreground">
          {currentEpisode && (
            <span>
              T{currentEpisode.season} E{currentEpisode.episode}
            </span>
          )}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextEpisode}
          disabled={!hasNext}
          className="gap-1"
        >
          Próximo
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Episode list for selected season */}
      <ScrollArea className="h-[200px]">
        <div className="space-y-1">
          {seasonEpisodes.map((ep) => {
            const isCurrent = ep.id === currentEpisode?.id;
            
            return (
              <button
                key={ep.id}
                onClick={() => onPlayEpisode(ep)}
                className={cn(
                  'w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left text-sm',
                  isCurrent 
                    ? 'bg-primary/20 text-primary' 
                    : 'hover:bg-muted'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded flex items-center justify-center flex-shrink-0',
                  isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}>
                  {isCurrent ? (
                    <Play className="w-4 h-4 fill-current" />
                  ) : (
                    <span className="text-xs font-medium">{ep.episode}</span>
                  )}
                </div>
                <span className="truncate">Episódio {ep.episode}</span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export default SeriesEpisodeNavigator;
