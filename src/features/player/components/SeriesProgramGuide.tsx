/**
 * SeriesProgramGuide - Season and episode selector for series in player
 * Shows all seasons, episodes with watched status
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Play, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Episode {
  id: string;
  name: string;
  stream_url?: string;
  tvg_logo?: string;
  category_name?: string;
  season: number;
  episode: number;
}

interface SeriesProgramGuideProps {
  seriesName: string;
  episodes: Episode[];
  currentEpisode: Episode | null;
  watchedEpisodes?: Set<string>; // IDs of watched episodes
  onPlayEpisode: (episode: Episode) => void;
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
  
  // Try T01E01 pattern
  const match4 = name.match(/T(\d{1,2})[\s]*E(\d{1,3})/i);
  if (match4) {
    return { season: parseInt(match4[1]), episode: parseInt(match4[2]) };
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

export function SeriesProgramGuide({
  seriesName,
  episodes,
  currentEpisode,
  watchedEpisodes = new Set(),
  onPlayEpisode,
  className,
}: SeriesProgramGuideProps) {
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

  // Episode count per season
  const seasonEpisodeCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    episodes.forEach(ep => {
      counts[ep.season] = (counts[ep.season] || 0) + 1;
    });
    return counts;
  }, [episodes]);

  return (
    <div className={cn('flex flex-col gap-3 bg-background/95 backdrop-blur-sm rounded-lg p-4', className)}>
      {/* Header with series name */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-base truncate">{seriesName}</h3>
        <span className="text-sm text-muted-foreground">
          {episodes.length} episódios
        </span>
      </div>
      
      {/* Season selector */}
      {seasons.length > 0 && (
        <Select 
          value={String(selectedSeason)} 
          onValueChange={(v) => setSelectedSeason(parseInt(v))}
        >
          <SelectTrigger className="w-full h-10 bg-muted/50">
            <SelectValue placeholder="Temporada" />
          </SelectTrigger>
          <SelectContent className="z-[70] bg-popover">
            {seasons.map((season) => (
              <SelectItem key={season} value={String(season)}>
                Temporada {season} ({seasonEpisodeCounts[season]} ep)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Episode list for selected season */}
      <ScrollArea className="max-h-[300px]">
        <div className="space-y-1">
          {seasonEpisodes.map((ep) => {
            const isCurrent = ep.id === currentEpisode?.id;
            const isWatched = watchedEpisodes.has(ep.id);
            
            return (
              <button
                key={ep.id}
                onClick={() => onPlayEpisode(ep)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                  isCurrent 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-muted'
                )}
              >
                {/* Episode number */}
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-medium',
                  isCurrent 
                    ? 'bg-primary-foreground/20' 
                    : isWatched 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-muted'
                )}>
                  {isCurrent ? (
                    <Play className="w-5 h-5 fill-current" />
                  ) : isWatched ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    ep.episode
                  )}
                </div>
                
                {/* Episode info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    Episódio {ep.episode}
                  </div>
                  {isWatched && !isCurrent && (
                    <div className="text-xs text-muted-foreground">Assistido</div>
                  )}
                  {isCurrent && (
                    <div className="text-xs opacity-80">Reproduzindo</div>
                  )}
                </div>
              </button>
            );
          })}
          
          {seasonEpisodes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum episódio nesta temporada
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default SeriesProgramGuide;
