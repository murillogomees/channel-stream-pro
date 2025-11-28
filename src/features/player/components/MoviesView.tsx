/**
 * MoviesView - Complete movies catalog with TMDB integration
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  
  // Metadata cache
  const [metadataCache, setMetadataCache] = useState<Map<string, ContentMetadata>>(new Map());
  const { fetchMetadata, fetchTMDBDetails } = useMovieMetadata();

  // Flatten all movies
  const allMovies = useMemo(() => {
    return categories.flatMap(cat =>
      cat.channels.map(ch => ({
        ...ch,
        category_name: cat.display_name,
        category_id: cat.id,
      }))
    );
  }, [categories]);

  // Filter movies
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

    // Sort
    movies = [...movies].sort((a, b) => {
      const metaA = metadataCache.get(a.id);
      const metaB = metadataCache.get(b.id);

      switch (sortBy) {
        case 'rating':
          return (metaB?.tmdb_rating || 0) - (metaA?.tmdb_rating || 0);
        case 'year':
          return (metaB?.year || 0) - (metaA?.year || 0);
        case 'recent':
          return 0; // Would need timestamp
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return movies;
  }, [allMovies, selectedCategory, externalSearch, sortBy, metadataCache]);

  // Load metadata for visible movies (lazy loading)
  useEffect(() => {
    const loadMetadataForVisible = async () => {
      const moviesToLoad = filteredMovies
        .slice(0, 20)
        .filter(m => !metadataCache.has(m.id));

      for (const movie of moviesToLoad) {
        try {
          const meta = await fetchMetadata(movie.id, movie.name);
          if (meta) {
            setMetadataCache(prev => new Map(prev).set(movie.id, meta));
          }
        } catch (err) {
          // Silently fail, show original data
        }
      }
    };

    loadMetadataForVisible();
  }, [filteredMovies.slice(0, 20).map(m => m.id).join(',')]);

  // Handle movie selection for details
  const handleMovieInfo = useCallback(async (movie: Channel) => {
    setSelectedMovie(movie);
    setIsLoadingMetadata(true);

    try {
      // Check cache first
      const cached = metadataCache.get(movie.id);
      if (cached) {
        setMovieMetadata(cached);
        setIsLoadingMetadata(false);
        return;
      }

      const meta = await fetchMetadata(movie.id, movie.name);
      if (meta) {
        setMovieMetadata(meta);
        setMetadataCache(prev => new Map(prev).set(movie.id, meta));
      }
    } catch (err) {
      console.error('[MoviesView] Error loading metadata:', err);
    } finally {
      setIsLoadingMetadata(false);
    }
  }, [fetchMetadata, metadataCache]);

  // Handle play
  const handlePlay = useCallback((movie: Channel) => {
    onPlay(movie);
    setSelectedMovie(null);
  }, [onPlay]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allMovies.length };
    categories.forEach(cat => {
      counts[cat.id] = cat.channels.length;
    });
    return counts;
  }, [categories, allMovies]);

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
              <span>Todos os Filmes</span>
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
            onValueChange={(v) => setSelectedCategory(v === 'all' ? null : v)}
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

        {/* Movies Grid */}
        <ScrollArea className="flex-1">
          <div className="p-4 lg:p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredMovies.length === 0 ? (
              <div className="col-span-full py-16 text-center">
                <div className="text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhum filme encontrado</p>
                  <p className="text-sm">Tente ajustar os filtros ou busca</p>
                </div>
              </div>
            ) : (
              filteredMovies.map((movie) => (
                <MovieCard
                  key={movie.id}
                  id={movie.id}
                  name={movie.name}
                  logo={movie.tvg_logo}
                  category={movie.category_name}
                  metadata={metadataCache.get(movie.id)}
                  isFavorite={isFavorite(movie.id)}
                  onPlay={() => handlePlay(movie)}
                  onInfo={() => handleMovieInfo(movie)}
                  onToggleFavorite={() => onToggleFavorite(movie.id)}
                />
              ))
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
