/**
 * MoviesView - Optimized movies catalog with lazy loading and background metadata
 */

import { useState, useCallback, useMemo, useEffect, useRef, memo, startTransition } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLazyLoadContent } from '@/hooks/useLazyLoadContent';
import { useMovieMetadata } from '../hooks/useMovieMetadata';
import { MovieCard } from './MovieCard';
import { MovieDetailSheet } from './MovieDetailSheet';
import type { ContentMetadata } from '../types';

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

export type MovieSortOption = 'name' | 'rating' | 'year' | 'recent';

interface MoviesViewProps {
  categories: Category[];
  onPlay: (channel: Channel) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  searchQuery?: string;
  sortBy?: MovieSortOption;
  className?: string;
}

// Memoized movie card to prevent unnecessary re-renders
const MemoizedMovieCard = memo(MovieCard);

export function MoviesView({
  categories,
  onPlay,
  isFavorite,
  onToggleFavorite,
  searchQuery: externalSearch = '',
  sortBy = 'name',
  className,
}: MoviesViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Channel | null>(null);
  const [movieMetadata, setMovieMetadata] = useState<ContentMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  
  // Metadata cache - persists across renders
  const metadataCacheRef = useRef<Map<string, ContentMetadata>>(new Map());
  const [metadataCacheVersion, setMetadataCacheVersion] = useState(0);
  const { fetchMetadata } = useMovieMetadata();
  
  // Track which movies are being loaded to avoid duplicate requests
  const loadingMoviesRef = useRef<Set<string>>(new Set());

  // Flatten all movies - memoized
  const allMovies = useMemo(() => {
    return categories.flatMap(cat =>
      cat.channels.map(ch => ({
        ...ch,
        category_name: cat.display_name,
        category_id: cat.id,
      }))
    );
  }, [categories]);

  // Filter and sort movies - memoized
  const filteredMovies = useMemo(() => {
    let movies = allMovies;

    // Filter by category
    if (selectedCategory) {
      movies = movies.filter(m => m.category_id === selectedCategory);
    }

    // Filter by search
    if (externalSearch) {
      const query = externalSearch.toLowerCase();
      movies = movies.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.category_name?.toLowerCase().includes(query)
      );
    }

    // Sort - use ref to avoid dependency on cache state
    const cache = metadataCacheRef.current;
    movies = [...movies].sort((a, b) => {
      const metaA = cache.get(a.id);
      const metaB = cache.get(b.id);

      switch (sortBy) {
        case 'rating':
          return (metaB?.tmdb_rating || 0) - (metaA?.tmdb_rating || 0);
        case 'year':
          return (metaB?.year || 0) - (metaA?.year || 0);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return movies;
  }, [allMovies, selectedCategory, externalSearch, sortBy, metadataCacheVersion]);

  // Use lazy loading for visible items
  const {
    visibleItems: visibleMovies,
    hasMore,
    loadMoreRef,
    visibleCount,
    totalCount,
  } = useLazyLoadContent(filteredMovies, {
    initialCount: 24,
    incrementCount: 24,
    rootMargin: '400px',
  });

  // Load metadata for visible movies in background - non-blocking
  useEffect(() => {
    const loadMetadataInBackground = async () => {
      const cache = metadataCacheRef.current;
      const loading = loadingMoviesRef.current;
      
      // Get movies that need metadata
      const moviesToLoad = visibleMovies
        .slice(0, 30)
        .filter(m => !cache.has(m.id) && !loading.has(m.id));

      if (moviesToLoad.length === 0) return;

      // Mark as loading
      moviesToLoad.forEach(m => loading.add(m.id));

      // Load in small batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < moviesToLoad.length; i += batchSize) {
        const batch = moviesToLoad.slice(i, i + batchSize);
        
        // Use Promise.allSettled to not block on failures
        await Promise.allSettled(
          batch.map(async (movie) => {
            try {
              const meta = await fetchMetadata(movie.id, movie.name);
              if (meta) {
                cache.set(movie.id, meta);
              }
            } catch {
              // Silently fail
            } finally {
              loading.delete(movie.id);
            }
          })
        );
        
        // Update version to trigger re-render with new metadata
        startTransition(() => {
          setMetadataCacheVersion(v => v + 1);
        });
      }
    };

    // Run in background without blocking
    const timeoutId = setTimeout(loadMetadataInBackground, 100);
    return () => clearTimeout(timeoutId);
  }, [visibleMovies.map(m => m.id).slice(0, 10).join(','), fetchMetadata]);

  // Handle movie selection for details
  const handleMovieInfo = useCallback(async (movie: Channel) => {
    setSelectedMovie(movie);
    setIsLoadingMetadata(true);

    try {
      // Check cache first
      const cached = metadataCacheRef.current.get(movie.id);
      if (cached) {
        setMovieMetadata(cached);
        setIsLoadingMetadata(false);
        return;
      }

      const meta = await fetchMetadata(movie.id, movie.name);
      if (meta) {
        setMovieMetadata(meta);
        metadataCacheRef.current.set(movie.id, meta);
        startTransition(() => {
          setMetadataCacheVersion(v => v + 1);
        });
      }
    } catch (err) {
      console.error('[MoviesView] Error loading metadata:', err);
    } finally {
      setIsLoadingMetadata(false);
    }
  }, [fetchMetadata]);

  // Handle play - memoized
  const handlePlay = useCallback((movie: Channel) => {
    onPlay(movie);
    setSelectedMovie(null);
  }, [onPlay]);

  // Handle category change with transition
  const handleCategoryChange = useCallback((categoryId: string | null) => {
    startTransition(() => {
      setSelectedCategory(categoryId);
    });
  }, []);

  // Category counts - memoized
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allMovies.length };
    categories.forEach(cat => {
      counts[cat.id] = cat.channels.length;
    });
    return counts;
  }, [categories, allMovies.length]);

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
              <span>Todos os Filmes</span>
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
                  {cat.channels.length}
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
                Todos ({categoryCounts.all})
              </SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.display_name} ({cat.channels.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Movies Grid with lazy loading */}
        <ScrollArea className="flex-1">
          <div className="p-4 lg:p-6">
            {/* Loading indicator */}
            {filteredMovies.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhum filme encontrado</p>
                  <p className="text-sm">Tente ajustar os filtros ou busca</p>
                </div>
              </div>
            ) : (
              <>
                {/* Count indicator */}
                <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
                  <span>
                    Exibindo {visibleCount} de {totalCount} filmes
                  </span>
                </div>
                
                {/* Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {visibleMovies.map((movie) => (
                    <MemoizedMovieCard
                      key={movie.id}
                      id={movie.id}
                      name={movie.name}
                      logo={movie.tvg_logo}
                      category={movie.category_name}
                      metadata={metadataCacheRef.current.get(movie.id)}
                      isFavorite={isFavorite(movie.id)}
                      onPlay={() => handlePlay(movie)}
                      onInfo={() => handleMovieInfo(movie)}
                      onToggleFavorite={() => onToggleFavorite(movie.id)}
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

      {/* Movie Detail Sheet */}
      <MovieDetailSheet
        isOpen={!!selectedMovie}
        onClose={() => {
          setSelectedMovie(null);
          setMovieMetadata(null);
        }}
        movie={selectedMovie}
        metadata={movieMetadata}
        isLoadingMetadata={isLoadingMetadata}
        onPlay={() => selectedMovie && handlePlay(selectedMovie)}
        onToggleFavorite={() => selectedMovie && onToggleFavorite(selectedMovie.id)}
        isFavorite={selectedMovie ? isFavorite(selectedMovie.id) : false}
      />
    </div>
  );
}
