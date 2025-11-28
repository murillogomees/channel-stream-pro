/**
 * SeriesView - Complete series catalog with TMDB integration and episode tracking
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSeriesMetadata } from '../hooks/useSeriesMetadata';
import { SeriesCard } from './SeriesCard';
import { SeriesDetailSheet } from './SeriesDetailSheet';
import type { SeriesMetadata } from '../types/series';

interface Category {
  id: string;
  name: string;
  display_name: string;
  channels: Channel[];
}

interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo?: string;
  category_name?: string;
}

export type SeriesSortOption = 'name' | 'rating' | 'year' | 'recent';

interface SeriesViewProps {
  categories: Category[];
  onPlay: (channel: Channel) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  searchQuery?: string;
  sortBy?: SeriesSortOption;
  className?: string;
}

// Helper to extract series name from episode name
function extractSeriesName(name: string): string {
  return name
    .replace(/\s*S\d{1,2}\s*E\d{1,3}.*/gi, '') // Remove S01E01 and everything after
    .replace(/\s*\d{1,2}x\d{1,3}.*/gi, '') // Remove 1x01 and everything after
    .replace(/\s*-\s*Temporada\s*\d+.*/gi, '') // Remove "- Temporada X" and everything after
    .replace(/\s*Temporada\s*\d+.*/gi, '') // Remove "Temporada X" and everything after
    .replace(/\s*Season\s*\d+.*/gi, '') // Remove "Season X" and everything after
    .replace(/\s*T\d+\s*E?\d*.*/gi, '') // Remove "T1E01" patterns
    .replace(/\s*Ep[is]*[óo]*d?i?o?\s*\d+.*/gi, '') // Remove "Episódio X" and everything after
    .replace(/\s*\(\d{4}\)/g, '') // Remove (2024)
    .replace(/\s*\[.*?\]/g, '') // Remove [tags]
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

export function SeriesView({
  categories,
  onPlay,
  isFavorite,
  onToggleFavorite,
  searchQuery: externalSearch = '',
  sortBy = 'name',
  className,
}: SeriesViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<Channel | null>(null);
  const [seriesMetadata, setSeriesMetadata] = useState<SeriesMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  
  // Metadata cache
  const [metadataCache, setMetadataCache] = useState<Map<string, SeriesMetadata>>(new Map());
  const { fetchSeriesMetadata } = useSeriesMetadata();

  // Group episodes into series
  const { seriesGroups, allEpisodes } = useMemo(() => {
    const episodesMap = new Map<string, Channel[]>();
    const allEps: Channel[] = [];

    categories.forEach(cat => {
      cat.channels.forEach(ch => {
        allEps.push({ ...ch, category_name: cat.display_name });
        const seriesName = extractSeriesName(ch.name);
        if (!episodesMap.has(seriesName)) {
          episodesMap.set(seriesName, []);
        }
        episodesMap.get(seriesName)!.push({ ...ch, category_name: cat.display_name });
      });
    });

    // Create series entries (use first episode of each series as representative)
    const groups: Array<{
      seriesName: string;
      representative: Channel & { category_id?: string };
      episodes: Channel[];
      episodeCount: number;
    }> = [];

    episodesMap.forEach((episodes, seriesName) => {
      if (episodes.length > 0) {
        const firstEpisode = episodes[0];
        const category = categories.find(c => 
          c.channels.some(ch => ch.id === firstEpisode.id)
        );
        groups.push({
          seriesName,
          representative: {
            ...firstEpisode,
            name: seriesName,
            category_id: category?.id,
          },
          episodes,
          episodeCount: episodes.length,
        });
      }
    });

    return { seriesGroups: groups, allEpisodes: allEps };
  }, [categories]);

  // Filter series
  const filteredSeries = useMemo(() => {
    let series = [...seriesGroups];

    // Filter by category
    if (selectedCategory) {
      series = series.filter(s => s.representative.category_id === selectedCategory);
    }

    // Filter by search
    if (externalSearch) {
      const query = externalSearch.toLowerCase();
      series = series.filter(s =>
        s.seriesName.toLowerCase().includes(query) ||
        s.representative.category_name?.toLowerCase().includes(query)
      );
    }

    // Sort
    series = series.sort((a, b) => {
      const metaA = metadataCache.get(a.representative.id);
      const metaB = metadataCache.get(b.representative.id);

      switch (sortBy) {
        case 'rating':
          return (metaB?.tmdb_rating || 0) - (metaA?.tmdb_rating || 0);
        case 'year':
          return (metaB?.year || 0) - (metaA?.year || 0);
        case 'recent':
          return 0;
        case 'name':
        default:
          return a.seriesName.localeCompare(b.seriesName);
      }
    });

    return series;
  }, [seriesGroups, selectedCategory, externalSearch, sortBy, metadataCache]);

  // Load metadata for visible series
  useEffect(() => {
    const loadMetadataForVisible = async () => {
      const seriesToLoad = filteredSeries
        .slice(0, 15)
        .filter(s => !metadataCache.has(s.representative.id));

      for (const series of seriesToLoad) {
        try {
          const meta = await fetchSeriesMetadata(series.representative.id, series.seriesName);
          if (meta) {
            setMetadataCache(prev => new Map(prev).set(series.representative.id, meta));
          }
        } catch (err) {
          // Silently fail
        }
      }
    };

    loadMetadataForVisible();
  }, [filteredSeries.slice(0, 15).map(s => s.representative.id).join(',')]);

  // Handle series selection for details
  const handleSeriesInfo = useCallback(async (series: typeof seriesGroups[0]) => {
    setSelectedSeries(series.representative);
    setIsLoadingMetadata(true);

    try {
      const cached = metadataCache.get(series.representative.id);
      if (cached) {
        setSeriesMetadata(cached);
        setIsLoadingMetadata(false);
        return;
      }

      const meta = await fetchSeriesMetadata(series.representative.id, series.seriesName);
      if (meta) {
        setSeriesMetadata(meta);
        setMetadataCache(prev => new Map(prev).set(series.representative.id, meta));
      }
    } catch (err) {
      console.error('[SeriesView] Error loading metadata:', err);
    } finally {
      setIsLoadingMetadata(false);
    }
  }, [fetchSeriesMetadata, metadataCache]);

  // Handle play
  const handlePlay = useCallback((channel: Channel) => {
    onPlay(channel);
    setSelectedSeries(null);
  }, [onPlay]);

  // Get related episodes for selected series
  const relatedEpisodes = useMemo(() => {
    if (!selectedSeries) return [];
    const group = seriesGroups.find(g => g.representative.id === selectedSeries.id);
    return group?.episodes || [];
  }, [selectedSeries, seriesGroups]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: seriesGroups.length };
    categories.forEach(cat => {
      const catSeries = seriesGroups.filter(s => s.representative.category_id === cat.id);
      counts[cat.id] = catSeries.length;
    });
    return counts;
  }, [categories, seriesGroups]);

  return (
    <div className={cn('flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]', className)}>
      {/* Sidebar - Categories */}
      <aside className="hidden lg:flex flex-col w-[240px] xl:w-[280px] flex-shrink-0 border-r border-border">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-lg">Categorias</h2>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors',
                'hover:bg-muted',
                !selectedCategory && 'bg-primary/10 text-primary'
              )}
            >
              <span>Todas as Séries</span>
              <Badge variant="secondary" className="ml-2">
                {categoryCounts.all}
              </Badge>
            </button>
            
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors',
                  'hover:bg-muted',
                  selectedCategory === cat.id && 'bg-primary/10 text-primary'
                )}
              >
                <span className="truncate">{cat.display_name}</span>
                <Badge variant="secondary" className="ml-2 flex-shrink-0">
                  {categoryCounts[cat.id] || 0}
                </Badge>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Category Select */}
        <div className="lg:hidden p-4 border-b border-border">
          <Select
            value={selectedCategory || 'all'}
            onValueChange={(v) => setSelectedCategory(v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Todas ({categoryCounts.all})
              </SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.display_name} ({categoryCounts[cat.id] || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Series Grid */}
        <ScrollArea className="flex-1">
          <div className="p-4 lg:p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredSeries.length === 0 ? (
              <div className="col-span-full py-16 text-center">
                <div className="text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhuma série encontrada</p>
                  <p className="text-sm">Tente ajustar os filtros ou busca</p>
                </div>
              </div>
            ) : (
              filteredSeries.map((series) => (
                <SeriesCard
                  key={series.representative.id}
                  id={series.representative.id}
                  name={series.seriesName}
                  logo={series.representative.tvg_logo}
                  category={series.representative.category_name}
                  metadata={metadataCache.get(series.representative.id)}
                  isFavorite={isFavorite(series.representative.id)}
                  onPlay={() => handlePlay(series.episodes[0])}
                  onInfo={() => handleSeriesInfo(series)}
                  onToggleFavorite={() => onToggleFavorite(series.representative.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Series Detail Sheet */}
      <SeriesDetailSheet
        isOpen={!!selectedSeries}
        onClose={() => {
          setSelectedSeries(null);
          setSeriesMetadata(null);
        }}
        series={selectedSeries}
        metadata={seriesMetadata}
        isLoadingMetadata={isLoadingMetadata}
        onPlay={(episode) => {
          if (episode && relatedEpisodes.length > 0) {
            // Find specific episode
            const ep = relatedEpisodes.find(e => {
              const match = e.name.match(/S(\d{1,2})[\s]*E(\d{1,3})/i) ||
                           e.name.match(/(\d{1,2})x(\d{1,3})/i);
              if (match) {
                return parseInt(match[1]) === episode.season && parseInt(match[2]) === episode.episode;
              }
              return false;
            });
            if (ep) {
              handlePlay(ep);
              return;
            }
          }
          // Default: play first episode
          if (relatedEpisodes.length > 0) {
            handlePlay(relatedEpisodes[0]);
          }
        }}
        onToggleFavorite={() => selectedSeries && onToggleFavorite(selectedSeries.id)}
        isFavorite={selectedSeries ? isFavorite(selectedSeries.id) : false}
        relatedEpisodes={relatedEpisodes}
      />
    </div>
  );
}
