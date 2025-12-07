/**
 * SearchResultsView - Display search results with series consolidation
 * 
 * Features:
 * - Consolidates series episodes into single card
 * - Shows movies and live TV separately
 * - Grid layout for results
 */

import { memo, useMemo } from 'react';
import { Film, Tv, PlaySquare, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isValidImageUrl } from '@/lib/imageUtils';

interface SearchResult {
  id: string;
  name?: string;
  title?: string;
  stream_url?: string;
  tvg_logo?: string;
  group_title?: string;
  content_type?: string;
}

interface SearchResultsViewProps {
  results: SearchResult[];
  onPlay: (item: SearchResult) => void;
  isSearching?: boolean;
  query?: string;
}

// Extract series name from episode name
function extractSeriesName(name: string): string {
  return name
    .replace(/\s*S\d{1,2}\s*E\d{1,3}.*/gi, '')
    .replace(/\s*\d{1,2}x\d{1,3}.*/gi, '')
    .replace(/\s*-\s*Temporada\s*\d+.*/gi, '')
    .replace(/\s*Temporada\s*\d+.*/gi, '')
    .replace(/\s*Season\s*\d+.*/gi, '')
    .replace(/\s*T\d+\s*E?\d*.*/gi, '')
    .replace(/\s*Ep[is]*[óo]*d?i?o?\s*\d+.*/gi, '')
    .replace(/\s*\(\d{4}\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Detect if content is a series episode
function isSeriesEpisode(name: string, group?: string): boolean {
  const nameCheck = /S\d{1,2}\s*E\d{1,3}/i.test(name) || 
                    /\d{1,2}x\d{1,3}/i.test(name) || 
                    /Temporada\s*\d+/i.test(name) ||
                    /T\d+\s*E\d+/i.test(name);
  const groupCheck = group ? 
    /serie|series|seriado|temporada/i.test(group) : false;
  
  return nameCheck || groupCheck;
}

// Detect content type
function detectContentType(item: SearchResult): 'movie' | 'series' | 'live' {
  const name = (item.name || item.title || '').toLowerCase();
  const group = (item.group_title || '').toLowerCase();
  
  if (isSeriesEpisode(name, group)) return 'series';
  if (group.includes('filme') || group.includes('movie')) return 'movie';
  
  return 'live';
}

// Result Card
const ResultCard = memo(function ResultCard({
  item,
  type,
  episodeCount,
  onPlay,
}: {
  item: SearchResult;
  type: 'movie' | 'series' | 'live';
  episodeCount?: number;
  onPlay: () => void;
}) {
  const displayName = type === 'series' 
    ? extractSeriesName(item.name || item.title || '')
    : (item.name || item.title || '');
    
  const TypeIcon = type === 'movie' ? Film : type === 'series' ? PlaySquare : Tv;
  const typeLabel = type === 'movie' ? 'Filme' : type === 'series' ? 'Série' : 'Ao Vivo';

  return (
    <div 
      className="group/card cursor-pointer"
      onClick={onPlay}
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
        {isValidImageUrl(item.tvg_logo) ? (
          <img
            src={item.tvg_logo}
            alt={displayName}
            className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted-foreground/20 to-muted-foreground/5 flex items-center justify-center">
            <TypeIcon className="w-10 h-10 text-muted-foreground/40" />
          </div>
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
          <Button size="icon" variant="secondary" className="rounded-full h-12 w-12">
            <Play className="w-6 h-6 fill-current" />
          </Button>
        </div>
        
        {/* Type badge */}
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs flex items-center gap-1">
          <TypeIcon className="w-3 h-3" />
          {typeLabel}
        </div>
        
        {/* Episode count for series */}
        {type === 'series' && episodeCount && episodeCount > 1 && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-xs font-medium">
            {episodeCount} episódios
          </div>
        )}
      </div>
      
      <div className="mt-2">
        <h3 className="font-medium text-foreground text-sm line-clamp-2 leading-tight">
          {displayName}
        </h3>
        {item.group_title && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {item.group_title}
          </p>
        )}
      </div>
    </div>
  );
});

export function SearchResultsView({
  results,
  onPlay,
  isSearching,
  query,
}: SearchResultsViewProps) {
  // Process and consolidate results
  const processedResults = useMemo(() => {
    const seriesMap = new Map<string, { item: SearchResult; episodes: SearchResult[] }>();
    const otherItems: Array<{ item: SearchResult; type: 'movie' | 'live' }> = [];
    
    for (const result of results) {
      const name = result.name || result.title || '';
      const type = detectContentType(result);
      
      if (type === 'series') {
        // Consolidate series
        const seriesName = extractSeriesName(name).toLowerCase();
        if (!seriesMap.has(seriesName)) {
          seriesMap.set(seriesName, { 
            item: result, 
            episodes: [result] 
          });
        } else {
          seriesMap.get(seriesName)!.episodes.push(result);
        }
      } else {
        otherItems.push({ item: result, type });
      }
    }
    
    // Convert series map to array
    const seriesItems = Array.from(seriesMap.values()).map(({ item, episodes }) => ({
      item,
      type: 'series' as const,
      episodeCount: episodes.length,
    }));
    
    // Add episodeCount to other items for type consistency
    const otherWithCount = otherItems.map(i => ({
      ...i,
      episodeCount: undefined as number | undefined,
    }));
    
    // Combine and sort - series first, then movies, then live
    return [
      ...seriesItems,
      ...otherWithCount.filter(i => i.type === 'movie'),
      ...otherWithCount.filter(i => i.type === 'live'),
    ];
  }, [results]);

  if (isSearching) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Buscando...</div>
      </div>
    );
  }

  if (results.length === 0 && query && query.length >= 2) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Film className="w-16 h-16 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          Nenhum resultado encontrado
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Não encontramos resultados para "{query}". Tente outra busca.
        </p>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="px-4 lg:px-6 py-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">
          Resultados da busca
          <span className="text-muted-foreground font-normal ml-2">
            ({processedResults.length} {processedResults.length === 1 ? 'resultado' : 'resultados'})
          </span>
        </h2>
      </div>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
        {processedResults.map(({ item, type, episodeCount }) => (
          <ResultCard
            key={item.id}
            item={item}
            type={type}
            episodeCount={episodeCount}
            onPlay={() => onPlay(item)}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(SearchResultsView);
