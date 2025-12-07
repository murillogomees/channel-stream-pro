/**
 * SeriesGuide - Season/Episode selector for series content
 * 
 * Features:
 * - Season dropdown selector
 * - Episode cards with watched status
 * - Current episode highlight
 */

import { memo, useMemo, useState } from 'react';
import { Play, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Episode {
  id: string;
  name: string;
  stream_url?: string;
  tvg_logo?: string;
  season: number;
  episode: number;
}

interface SeriesGuideProps {
  seriesName: string;
  episodes: Episode[];
  currentEpisode?: Episode | null;
  watchedEpisodes?: Set<string>;
  onPlayEpisode: (episode: Episode) => void;
  className?: string;
}

export function SeriesGuide({
  seriesName,
  episodes,
  currentEpisode,
  watchedEpisodes = new Set(),
  onPlayEpisode,
  className,
}: SeriesGuideProps) {
  // Get available seasons
  const seasons = useMemo(() => {
    const seasonSet = new Set<number>();
    episodes.forEach(ep => seasonSet.add(ep.season));
    return Array.from(seasonSet).sort((a, b) => a - b);
  }, [episodes]);

  // Current season from current episode or first season
  const [selectedSeason, setSelectedSeason] = useState<number>(() => {
    return currentEpisode?.season || seasons[0] || 1;
  });

  // Episodes for selected season
  const seasonEpisodes = useMemo(() => {
    return episodes
      .filter(ep => ep.season === selectedSeason)
      .sort((a, b) => a.episode - b.episode);
  }, [episodes, selectedSeason]);

  // Episode count per season
  const seasonEpisodeCounts = useMemo(() => {
    const counts = new Map<number, number>();
    episodes.forEach(ep => {
      counts.set(ep.season, (counts.get(ep.season) || 0) + 1);
    });
    return counts;
  }, [episodes]);

  if (episodes.length === 0) {
    return null;
  }

  return (
    <div className={cn("bg-card border border-border rounded-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
              {seriesName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {episodes.length} episódios
            </p>
          </div>
          
          {/* Season Selector */}
          <Select
            value={selectedSeason.toString()}
            onValueChange={(v) => setSelectedSeason(parseInt(v))}
          >
            <SelectTrigger className="w-[140px] sm:w-[160px]">
              <SelectValue placeholder="Temporada" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map(season => (
                <SelectItem key={season} value={season.toString()}>
                  Temporada {season} ({seasonEpisodeCounts.get(season) || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Episodes List */}
      <ScrollArea className="h-[300px] sm:h-[400px]">
        <div className="p-2 sm:p-3 grid gap-2">
          {seasonEpisodes.map(episode => {
            const isCurrent = currentEpisode?.id === episode.id;
            const isWatched = watchedEpisodes.has(episode.id);
            
            return (
              <button
                key={episode.id}
                onClick={() => onPlayEpisode(episode)}
                className={cn(
                  "flex items-center gap-3 p-2 sm:p-3 rounded-lg transition-colors text-left w-full",
                  "hover:bg-muted/50",
                  isCurrent && "bg-primary/10 border border-primary/30",
                  !isCurrent && "bg-muted/20"
                )}
              >
                {/* Episode Number */}
                <div className={cn(
                  "flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-xs sm:text-sm font-medium",
                  isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {episode.episode}
                </div>
                
                {/* Episode Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs sm:text-sm font-medium truncate",
                      isCurrent ? "text-primary" : "text-foreground"
                    )}>
                      Episódio {episode.episode}
                    </span>
                    {isWatched && !isCurrent && (
                      <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    )}
                    {isCurrent && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/20 text-primary">
                        Assistindo
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">
                    T{episode.season} E{episode.episode}
                  </p>
                </div>
                
                {/* Play Button */}
                <Button
                  size="icon"
                  variant={isCurrent ? "default" : "ghost"}
                  className="flex-shrink-0 h-8 w-8"
                >
                  <Play className={cn(
                    "w-4 h-4",
                    isCurrent && "fill-current"
                  )} />
                </Button>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export default memo(SeriesGuide);
