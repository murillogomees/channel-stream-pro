/**
 * MoviesView - Complete movies catalog with TMDB integration
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Search, Filter, Grid, List, Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMovieMetadata } from '../hooks/useMovieMetadata';
import { MovieCard, MovieCardSkeleton } from './MovieCard';
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

interface MoviesViewProps {
  categories: Category[];
  onPlay: (channel: Channel) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  searchQuery?: string;
  className?: string;
}

type SortOption = 'name' | 'rating' | 'year' | 'recent';
type ViewMode = 'grid' | 'list';

export function MoviesView({
  categories,
  onPlay,
  isFavorite,
  onToggleFavorite,
  searchQuery: externalSearch = '',
  className,
}: MoviesViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState(externalSearch);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
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
    const search = localSearch || externalSearch;
    if (search) {
      const query = search.toLowerCase();
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
  }, [allMovies, selectedCategory, localSearch, externalSearch, sortBy, metadataCache]);

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
        {/* Toolbar */}
        <div className="sticky top-14 sm:top-16 z-30 bg-background/95 backdrop-blur-sm border-b border-border p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Mobile Category Select */}
            <div className="lg:hidden">
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

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar filmes..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Sort & View Options */}
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">A-Z</SelectItem>
                  <SelectItem value="rating">
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3" /> Avaliação
                    </span>
                  </SelectItem>
                  <SelectItem value="year">Ano</SelectItem>
                </SelectContent>
              </Select>

              <div className="hidden sm:flex gap-1 border border-border rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Results count */}
          <p className="text-sm text-muted-foreground mt-3">
            {filteredMovies.length} filme{filteredMovies.length !== 1 ? 's' : ''} encontrado{filteredMovies.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Movies Grid */}
        <ScrollArea className="flex-1">
          <div className={cn(
            'p-4 lg:p-6',
            viewMode === 'grid'
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
              : 'space-y-3'
          )}>
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
                  variant={viewMode === 'list' ? 'compact' : 'default'}
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
