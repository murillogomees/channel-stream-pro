/**
 * SeriesView - Optimized series catalog with lazy loading and deferred computation
 * @version 2.0.0 - Performance optimized with deferred rendering
 */

import { useState, useCallback, useMemo, useEffect, useRef, memo, startTransition, useDeferredValue } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLazyLoadContent } from '@/hooks/useLazyLoadContent';
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

// Helper to extract series name from episode name - optimized with caching
const seriesNameCache = new Map<string, string>();
function extractSeriesName(name: string): string {
  const cached = seriesNameCache.get(name);
  if (cached) return cached;
  
  const result = name
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
  
  // Limit cache size
  if (seriesNameCache.size > 10000) {
    const firstKey = seriesNameCache.keys().next().value;
    if (firstKey) seriesNameCache.delete(firstKey);
  }
  seriesNameCache.set(name, result);
  return result;
}

// Memoized series card
const MemoizedSeriesCard = memo(SeriesCard);

// Loading skeleton for initial render
const SeriesGridSkeleton = memo(() => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
    {Array.from({ length: 12 }).map((_, i) => (
      <div key={i} className="aspect-[2/3] bg-muted/50 rounded-lg animate-pulse" />
    ))}
  </div>
));

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
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Metadata cache - persists across renders
  const metadataCacheRef = useRef<Map<string, SeriesMetadata>>(new Map());
  const [metadataCacheVersion, setMetadataCacheVersion] = useState(0);
  const { fetchSeriesMetadata } = useSeriesMetadata();
  
  // Track loading state
  const loadingSeriesRef = useRef<Set<string>>(new Set());
  
  // Use deferred values for non-critical updates
  const deferredSearch = useDeferredValue(externalSearch);
  const deferredSortBy = useDeferredValue(sortBy);

  // OPTIMIZED: Group episodes into series - compute once and cache
  const seriesDataRef = useRef<{
    seriesGroups: Array<{
      seriesName: string;
      representative: Channel & { category_id?: string };
      episodes: Channel[];
      episodeCount: number;
    }>;
    allEpisodes: Channel[];
    categoriesHash: string;
  } | null>(null);

  const categoriesHash = useMemo(() => {
    // Create a simple hash to detect category changes
    return categories.map(c => `${c.id}:${c.channels.length}`).join('|');
  }, [categories]);

  // Compute series groups only when categories actually change
  const { seriesGroups, allEpisodes } = useMemo(() => {
    // Check if we can reuse cached data
    if (seriesDataRef.current && seriesDataRef.current.categoriesHash === categoriesHash) {
      return {
        seriesGroups: seriesDataRef.current.seriesGroups,
        allEpisodes: seriesDataRef.current.allEpisodes,
      };
    }

    const episodesMap = new Map<string, Channel[]>();
    const allEps: Channel[] = [];

    // Process in chunks to avoid blocking
    categories.forEach(cat => {
      cat.channels.forEach(ch => {
        const channelWithCategory = { ...ch, category_name: cat.display_name };
        allEps.push(channelWithCategory);
        const seriesName = extractSeriesName(ch.name);
        const existing = episodesMap.get(seriesName);
        if (existing) {
          existing.push(channelWithCategory);
        } else {
          episodesMap.set(seriesName, [channelWithCategory]);
        }
      });
    });

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

    // Cache the result
    seriesDataRef.current = {
      seriesGroups: groups,
      allEpisodes: allEps,
      categoriesHash,
    };

    return { seriesGroups: groups, allEpisodes: allEps };
  }, [categories, categoriesHash]);

  // Mark initialization complete after first render
  useEffect(() => {
    if (seriesGroups.length > 0 && isInitializing) {
      // Use requestIdleCallback for non-critical update
      const handle = requestIdleCallback?.(() => {
        setIsInitializing(false);
      }, { timeout: 100 }) ?? setTimeout(() => setIsInitializing(false), 50);
      
      return () => {
        if (typeof handle === 'number') {
          cancelIdleCallback?.(handle) ?? clearTimeout(handle);
        }
      };
    }
  }, [seriesGroups.length, isInitializing]);

  // Filter series - uses deferred values to keep UI responsive
  const filteredSeries = useMemo(() => {
    let series = [...seriesGroups];

    if (selectedCategory) {
      series = series.filter(s => s.representative.category_id === selectedCategory);
    }

    if (deferredSearch) {
      const query = deferredSearch.toLowerCase();
      series = series.filter(s =>
        s.seriesName.toLowerCase().includes(query) ||
        s.representative.category_name?.toLowerCase().includes(query)
      );
    }

    const cache = metadataCacheRef.current;
    series = series.sort((a, b) => {
      const metaA = cache.get(a.representative.id);
      const metaB = cache.get(b.representative.id);

      switch (deferredSortBy) {
        case 'rating':
          return (metaB?.tmdb_rating || 0) - (metaA?.tmdb_rating || 0);
        case 'year':
          return (metaB?.year || 0) - (metaA?.year || 0);
        case 'name':
        default:
          return a.seriesName.localeCompare(b.seriesName);
      }
    });

    return series;
  }, [seriesGroups, selectedCategory, deferredSearch, deferredSortBy, metadataCacheVersion]);

  // Use lazy loading with smaller initial batch for faster first paint
  const {
    visibleItems: visibleSeries,
    hasMore,
    loadMoreRef,
    visibleCount,
    totalCount,
  } = useLazyLoadContent(filteredSeries, {
    initialCount: 18, // Reduced from 24 for faster initial render
    incrementCount: 18,
    rootMargin: '400px',
  });

  // Load metadata in background - with rate limiting
  const metadataLoadTimerRef = useRef<ReturnType<typeof setTimeout>>();
  
  useEffect(() => {
    // Clear any pending load
    if (metadataLoadTimerRef.current) {
      clearTimeout(metadataLoadTimerRef.current);
    }
    
    // Defer metadata loading to not block initial render
    metadataLoadTimerRef.current = setTimeout(() => {
      const loadMetadataInBackground = async () => {
        const cache = metadataCacheRef.current;
        const loading = loadingSeriesRef.current;
        
        const seriesToLoad = visibleSeries
          .slice(0, 12) // Reduced batch size
          .filter(s => !cache.has(s.representative.id) && !loading.has(s.representative.id));

        if (seriesToLoad.length === 0) return;

        seriesToLoad.forEach(s => loading.add(s.representative.id));

        const batchSize = 3; // Smaller batches for less blocking
        for (let i = 0; i < seriesToLoad.length; i += batchSize) {
          const batch = seriesToLoad.slice(i, i + batchSize);
          
          await Promise.allSettled(
            batch.map(async (series) => {
              try {
                const meta = await fetchSeriesMetadata(series.representative.id, series.seriesName);
                if (meta) {
                  cache.set(series.representative.id, meta);
                }
              } catch {
                // Silently fail
              } finally {
                loading.delete(series.representative.id);
              }
            })
          );
          
          startTransition(() => {
            setMetadataCacheVersion(v => v + 1);
          });
          
          // Small delay between batches
          await new Promise(r => setTimeout(r, 50));
        }
      };

      loadMetadataInBackground();
    }, 300); // Delay metadata loading to prioritize UI

    return () => {
      if (metadataLoadTimerRef.current) {
        clearTimeout(metadataLoadTimerRef.current);
      }
    };
  }, [visibleSeries.length, fetchSeriesMetadata]);

  // Handle series selection
  const handleSeriesInfo = useCallback(async (series: typeof seriesGroups[0]) => {
    setSelectedSeries(series.representative);
    setIsLoadingMetadata(true);

    try {
      const cached = metadataCacheRef.current.get(series.representative.id);
      if (cached) {
        setSeriesMetadata(cached);
        setIsLoadingMetadata(false);
        return;
      }

      const meta = await fetchSeriesMetadata(series.representative.id, series.seriesName);
      if (meta) {
        setSeriesMetadata(meta);
        metadataCacheRef.current.set(series.representative.id, meta);
        startTransition(() => {
          setMetadataCacheVersion(v => v + 1);
        });
      }
    } catch (err) {
      console.error('[SeriesView] Error loading metadata:', err);
    } finally {
      setIsLoadingMetadata(false);
    }
  }, [fetchSeriesMetadata]);

  // Handle play - memoized
  const handlePlay = useCallback((channel: Channel) => {
    onPlay(channel);
    setSelectedSeries(null);
  }, [onPlay]);

  // Handle category change with transition
  const handleCategoryChange = useCallback((categoryId: string | null) => {
    startTransition(() => {
      setSelectedCategory(categoryId);
    });
  }, []);

  // Related episodes for selected series
  const relatedEpisodes = useMemo(() => {
    if (!selectedSeries) return [];
    const group = seriesGroups.find(g => g.representative.id === selectedSeries.id);
    return group?.episodes || [];
  }, [selectedSeries, seriesGroups]);

  // Category counts - memoized
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: seriesGroups.length };
    categories.forEach(cat => {
      const catSeries = seriesGroups.filter(s => s.representative.category_id === cat.id);
      counts[cat.id] = catSeries.length;
    });
    return counts;
  }, [categories, seriesGroups]);

  // Show skeleton during initial computation
  if (isInitializing && categories.length > 0) {
    return (
      <div className={cn('flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]', className)}>
        <aside className="hidden lg:flex flex-col w-[240px] xl:w-[280px] flex-shrink-0 border-r border-border">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-lg">Categorias</h2>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </aside>
        <div className="flex-1 p-4 lg:p-6">
          <SeriesGridSkeleton />
        </div>
      </div>
    );
  }

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
              onClick={() => handleCategoryChange(null)}
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
                onClick={() => handleCategoryChange(cat.id)}
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
            onValueChange={(v) => handleCategoryChange(v === 'all' ? null : v)}
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

        {/* Series Grid with lazy loading */}
        <ScrollArea className="flex-1">
          <div className="p-4 lg:p-6">
            {filteredSeries.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhuma série encontrada</p>
                  <p className="text-sm">Tente ajustar os filtros ou busca</p>
                </div>
              </div>
            ) : (
              <>
                {/* Count indicator */}
                <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
                  <span>
                    Exibindo {visibleCount} de {totalCount} séries
                  </span>
                </div>
                
                {/* Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {visibleSeries.map((series) => (
                    <MemoizedSeriesCard
                      key={series.representative.id}
                      id={series.representative.id}
                      name={series.seriesName}
                      logo={series.representative.tvg_logo}
                      category={series.representative.category_name}
                      metadata={metadataCacheRef.current.get(series.representative.id)}
                      isFavorite={isFavorite(series.representative.id)}
                      onPlay={() => handlePlay(series.episodes[0])}
                      onInfo={() => handleSeriesInfo(series)}
                      onToggleFavorite={() => onToggleFavorite(series.representative.id)}
                    />
                  ))}
                </div>
                
                {/* Load more trigger */}
                {hasMore && (
                  <div ref={loadMoreRef} className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                    <span className="text-muted-foreground">Carregando mais...</span>
                  </div>
                )}
              </>
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
