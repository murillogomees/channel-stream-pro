/**
 * MyList Page - User's saved content
 * 
 * Mobile/TV/Desktop responsive with feature flag support
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Trash2, Play, Grid, List, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFavoriteChannels } from '@/hooks/useFavoriteChannels';
import { useIPTVPlayerClient } from '@/hooks/useIPTVPlayerClient';
import { cn } from '@/lib/utils';
import { featureFlagsService } from '@/services/featureFlagsService';
import { AppLayout } from '@/components/layouts/AppLayout';

type ViewMode = 'grid' | 'list';
type FilterTab = 'all' | 'live' | 'movies' | 'series';

export default function MyList() {
  const navigate = useNavigate();
  const { favorites, isFavorite, toggleFavorite, isLoading: favoritesLoading } = useFavoriteChannels();
  const { categories } = useIPTVPlayerClient();
  
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const isTV = featureFlagsService.isTV();
  const isMobile = featureFlagsService.isMobile();

  // Get all channels map for quick lookup
  const allChannelsMap = useMemo(() => {
    const map = new Map<string, any>();
    categories.forEach(cat => {
      cat.channels.forEach(ch => {
        map.set(ch.id, { ...ch, category_name: cat.display_name, category_id: cat.id });
      });
    });
    return map;
  }, [categories]);

  // Get favorite channels with full data
  const favoriteChannels = useMemo(() => {
    return favorites
      .map(favId => allChannelsMap.get(favId))
      .filter(Boolean);
  }, [favorites, allChannelsMap]);

  // Categorize favorites
  const categorizedFavorites = useMemo(() => {
    const live: any[] = [];
    const movies: any[] = [];
    const series: any[] = [];

    favoriteChannels.forEach(ch => {
      const catName = (ch.category_name || '').toLowerCase();
      const isMovie = /filme|movie|cinema|vod filme/i.test(catName);
      const isSeries = /série|series|seriado|novela|temporada/i.test(catName);

      if (isSeries) {
        series.push(ch);
      } else if (isMovie) {
        movies.push(ch);
      } else {
        live.push(ch);
      }
    });

    return { live, movies, series, all: favoriteChannels };
  }, [favoriteChannels]);

  // Filter by search and tab
  const filteredChannels = useMemo(() => {
    let channels = categorizedFavorites[activeTab];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      channels = channels.filter(ch => 
        ch.name.toLowerCase().includes(query) ||
        ch.category_name?.toLowerCase().includes(query)
      );
    }

    return channels;
  }, [categorizedFavorites, activeTab, searchQuery]);

  // Handle play
  const handlePlay = useCallback((channel: any) => {
    navigate(`/app/player?channelId=${channel.id}&channelUrl=${encodeURIComponent(channel.stream_url)}&channelName=${encodeURIComponent(channel.name)}`);
  }, [navigate]);

  // Handle remove from list
  const handleRemove = useCallback((channelId: string) => {
    toggleFavorite(channelId);
  }, [toggleFavorite]);

  return (
    <AppLayout allowScroll className={cn(
      isTV ? 'p-8' : 'p-4 md:p-6'
    )}>
      {/* Header */}
      <header className={cn(
        'flex items-center gap-4 mb-6',
        isTV && 'mb-8'
      )}>
        <Button
          variant="ghost"
          size={isTV ? 'lg' : 'icon'}
          onClick={() => navigate(-1)}
          className="shrink-0"
        >
          <ArrowLeft className={cn('w-5 h-5', isTV && 'w-6 h-6')} />
        </Button>

        <div className="flex-1">
          <h1 className={cn(
            'font-bold text-foreground',
            isTV ? 'text-3xl' : 'text-xl md:text-2xl'
          )}>
            Minha Lista
          </h1>
          <p className="text-sm text-muted-foreground">
            {favoriteChannels.length} {favoriteChannels.length === 1 ? 'item' : 'itens'}
          </p>
        </div>

        {/* View Toggle */}
        {!isMobile && (
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        )}
      </header>

      {/* Search & Filter */}
      <div className={cn(
        'flex flex-col sm:flex-row gap-4 mb-6',
        isTV && 'mb-8'
      )}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar na lista..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'pl-10',
              isTV && 'h-12 text-lg'
            )}
          />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
          <TabsList className={cn(isTV && 'h-12')}>
            <TabsTrigger value="all" className={cn(isTV && 'text-base px-6')}>
              Todos ({categorizedFavorites.all.length})
            </TabsTrigger>
            <TabsTrigger value="live" className={cn(isTV && 'text-base px-6')}>
              TV ({categorizedFavorites.live.length})
            </TabsTrigger>
            <TabsTrigger value="movies" className={cn(isTV && 'text-base px-6')}>
              Filmes ({categorizedFavorites.movies.length})
            </TabsTrigger>
            <TabsTrigger value="series" className={cn(isTV && 'text-base px-6')}>
              Séries ({categorizedFavorites.series.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      {favoritesLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Heart className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {searchQuery ? 'Nenhum resultado encontrado' : 'Sua lista está vazia'}
          </h2>
          <p className="text-muted-foreground max-w-sm">
            {searchQuery 
              ? 'Tente buscar por outro termo'
              : 'Adicione canais, filmes e séries aos favoritos para ver aqui'
            }
          </p>
          {!searchQuery && (
            <Button 
              className="mt-6" 
              onClick={() => navigate('/app/player')}
            >
              Explorar conteúdo
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' || isMobile ? (
        // Grid View
        <div className={cn(
          'grid gap-4',
          isMobile ? 'grid-cols-2' : isTV ? 'grid-cols-6 gap-6' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
        )}>
          <AnimatePresence mode="popLayout">
            {filteredChannels.map((channel, index) => (
              <motion.div
                key={channel.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.02 }}
                className={cn(
                  'group relative bg-card rounded-xl overflow-hidden',
                  'border border-border hover:border-primary/50 transition-all duration-200',
                  'hover:shadow-lg hover:-translate-y-1',
                  isTV && 'focus-within:ring-2 focus-within:ring-primary'
                )}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-muted relative">
                  {channel.tvg_logo ? (
                    <img
                      src={channel.tvg_logo}
                      alt={channel.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-background">
                      <span className="text-2xl font-bold text-muted-foreground/30">
                        {channel.name[0]}
                      </span>
                    </div>
                  )}

                  {/* Play Overlay */}
                  <div className={cn(
                    'absolute inset-0 bg-black/60 flex items-center justify-center opacity-0',
                    'group-hover:opacity-100 transition-opacity',
                    isTV && 'group-focus-within:opacity-100'
                  )}>
                    <Button
                      size={isTV ? 'lg' : 'default'}
                      onClick={() => handlePlay(channel)}
                      className="rounded-full"
                    >
                      <Play className="w-5 h-5 fill-current" />
                    </Button>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(channel.id);
                    }}
                    className={cn(
                      'absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white',
                      'opacity-0 group-hover:opacity-100 transition-opacity',
                      'hover:bg-red-500',
                      isTV && 'group-focus-within:opacity-100'
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Info */}
                <div className={cn('p-3', isTV && 'p-4')}>
                  <h3 className={cn(
                    'font-medium text-foreground line-clamp-1',
                    isTV ? 'text-base' : 'text-sm'
                  )}>
                    {channel.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                    {channel.category_name}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        // List View
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredChannels.map((channel, index) => (
              <motion.div
                key={channel.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.02 }}
                className={cn(
                  'flex items-center gap-4 p-4 bg-card rounded-xl border border-border',
                  'hover:border-primary/50 transition-all',
                  'group cursor-pointer',
                  isTV && 'p-6 focus-within:ring-2 focus-within:ring-primary'
                )}
                onClick={() => handlePlay(channel)}
              >
                {/* Thumbnail */}
                <div className={cn(
                  'w-24 h-14 bg-muted rounded-lg overflow-hidden shrink-0',
                  isTV && 'w-32 h-20'
                )}>
                  {channel.tvg_logo ? (
                    <img
                      src={channel.tvg_logo}
                      alt={channel.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-lg font-bold text-muted-foreground/30">
                        {channel.name[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    'font-medium text-foreground line-clamp-1',
                    isTV && 'text-lg'
                  )}>
                    {channel.name}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {channel.category_name}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(channel.id);
                    }}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button size={isTV ? 'lg' : 'default'}>
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    Assistir
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </AppLayout>
  );
}
