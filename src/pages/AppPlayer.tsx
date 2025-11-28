import { useState, useEffect, useCallback, useMemo, useRef, startTransition, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Tv, ArrowLeft, Search, Settings, RefreshCw, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import YouTubeStylePlayer from '@/components/app/YouTubeStylePlayer';
import { useIPTVPlayerClient } from '@/hooks/useIPTVPlayerClient';
import { useIPTVPlayerAdmin } from '@/hooks/useIPTVPlayerAdmin';
import { useFavoriteChannels } from '@/hooks/useFavoriteChannels';
import { useBackendSearch } from '@/hooks/useBackendSearch';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TVNavRail } from '@/components/iptv/TVNavRail';
import { TVHeroSection } from '@/components/iptv/TVHeroSection';
import { TVContentRow } from '@/components/iptv/TVContentRow';
import { TVContentCard } from '@/components/iptv/TVContentCard';
import { TVCategoryFilter } from '@/components/iptv/TVCategoryFilter';
import { TVContentGrid } from '@/components/iptv/TVContentGrid';
import { streamService } from '@/modules/player/services/StreamService';
import { useFocusManagerInit, useBackHandler } from '@/modules/player/hooks/useFocusManager';
// Smart features imports
import { useContinueWatching, useTrending } from '@/features/player/hooks';
import { ContinueWatchingRow, Top10Row, LiveTVView, MoviesView, SeriesView } from '@/features/player/components';
import type { MovieSortOption, SeriesSortOption } from '@/features/player/components';
import { 
  favoritesService as playerFavoritesService, 
  watchProgressService,
  analyticsService 
} from '@/features/player/services';
import type { WatchProgress, TrendingItem, ContentType } from '@/features/player/types';

export default function AppPlayer() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  
  // Use different hooks based on role
  const clientPlayer = useIPTVPlayerClient();
  const adminPlayer = useIPTVPlayerAdmin();
  
  // Select appropriate player based on role
  const player = isAdmin ? adminPlayer : clientPlayer;
  
  const {
    categories,
    currentChannel,
    isLoading: playerLoading,
    loadingProgress,
    changeChannel,
    nextChannel,
    previousChannel,
  } = player;
  
  // Role-specific properties
  const assignedPlaylist = isAdmin ? (adminPlayer as any).selectedList : (clientPlayer as any).assignedPlaylist;
  const hasPlaylist = isAdmin ? categories.length > 0 : (clientPlayer as any).hasPlaylist;
  const totalChannels = isAdmin ? (adminPlayer as any).totalChannels : (clientPlayer as any).totalChannels;
  const loadedChannels = isAdmin ? (adminPlayer as any).loadedChannels : (clientPlayer as any).loadedChannels;
  const isLoadingMore = isAdmin ? (adminPlayer as any).isLoadingMore : (clientPlayer as any).isLoadingMore;
  const isCached = !isAdmin && (clientPlayer as any).isCached;
  const clearCacheAndReload = !isAdmin ? (clientPlayer as any).clearCacheAndReload : undefined;
  
  // Admin-specific
  const availableLists = isAdmin ? (adminPlayer as any).availableLists : [];
  const selectList = isAdmin ? (adminPlayer as any).selectList : undefined;

  const {
    isFavorite,
    toggleFavorite,
    isLoading: favoritesLoading,
  } = useFavoriteChannels();

  // Backend search hook
  const {
    query: backendQuery,
    results: backendResults,
    isSearching,
    totalResults: backendTotalResults,
    updateQuery: updateBackendSearch,
    clearSearch,
    isActive: isBackendSearchActive,
  } = useBackendSearch({ playlistKey: 'lista-vip', debounceMs: 400 });

  const [activeTab, setActiveTab] = useState<'home' | 'live' | 'movies' | 'series' | 'favorites'>('home');
  
  // Use startTransition for tab changes to keep UI responsive
  const handleTabChange = useCallback((tab: typeof activeTab) => {
    startTransition(() => {
      setActiveTab(tab);
    });
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [playerChannel, setPlayerChannel] = useState<any>(null);
  const [showPlayerDialog, setShowPlayerDialog] = useState(false);
  const [movieSortBy, setMovieSortBy] = useState<MovieSortOption>('name');
  const [seriesSortBy, setSeriesSortBy] = useState<SeriesSortOption>('name');
  
  // Smart features hooks
  const { 
    items: continueWatchingItems, 
    isLoading: loadingContinueWatching, 
    removeItem: removeContinueWatchingItem,
    refresh: refreshContinueWatching,
  } = useContinueWatching();
  const { items: trendingItems, isLoading: loadingTrending } = useTrending('weekly');

  // Handle search change - use backend search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    updateBackendSearch(value);
  }, [updateBackendSearch]);

  // Reset category selection when tab changes - use transition for smooth UX
  useEffect(() => {
    startTransition(() => {
      setSelectedCategory(null);
      setSearchQuery('');
      clearSearch();
    });
  }, [activeTab, clearSearch]);

  // Categorize content by type
  const categorizedContent = useMemo(() => {
    const live: typeof categories = [];
    const movies: typeof categories = [];
    const series: typeof categories = [];

    categories.forEach(cat => {
      const catName = cat.display_name.toLowerCase();
      const catId = cat.name.toLowerCase();
      const combinedText = `${catName} ${catId}`;
      
      const movieKeywords = ['filme', 'movie', 'cinema', 'vod filme', 'filmes', 'movies', 'film', 'peliculas'];
      const seriesKeywords = ['série', 'series', 'seriado', 'novela', 'temporada', 'season', 'episódio', 'serie', 'séries', 'drama', 'dorama'];
      
      const isMovie = movieKeywords.some(keyword => combinedText.includes(keyword)) &&
                      !seriesKeywords.some(keyword => combinedText.includes(keyword));
      const isSeries = seriesKeywords.some(keyword => combinedText.includes(keyword));
      
      if (isSeries) {
        series.push(cat);
      } else if (isMovie) {
        movies.push(cat);
      } else {
        live.push(cat);
      }
    });

    return { live, movies, series };
  }, [categories]);

  // Content counts
  const counts = useMemo(() => ({
    live: categorizedContent.live.reduce((acc, cat) => acc + cat.channels.length, 0),
    movies: categorizedContent.movies.reduce((acc, cat) => acc + cat.channels.length, 0),
    series: categorizedContent.series.reduce((acc, cat) => acc + cat.channels.length, 0),
  }), [categorizedContent]);

  // Get all channels for search and favorites
  const allChannels = useMemo(() => 
    categories.flatMap(cat => cat.channels.map(ch => ({ ...ch, category_name: cat.display_name }))),
    [categories]
  );

  // Featured items for hero
  const featuredItems = useMemo(() => {
    const items = allChannels.filter(ch => ch.tvg_logo).slice(0, 10);
    return items.map(ch => ({
      id: ch.id,
      name: ch.name,
      logo: ch.tvg_logo || undefined,
      category: ch.category_name,
    }));
  }, [allChannels]);

  // Get categories for current tab
  const currentTabCategories = useMemo(() => {
    const getCats = () => {
      switch (activeTab) {
        case 'live': return categorizedContent.live;
        case 'movies': return categorizedContent.movies;
        case 'series': return categorizedContent.series;
        default: return [];
      }
    };
    
    return getCats().map(cat => ({
      id: cat.id,
      name: cat.name,
      display_name: cat.display_name,
      channelCount: cat.channels.length,
    }));
  }, [activeTab, categorizedContent]);

  // Filtered channels based on search and category
  // Uses backend search when there's an active query, otherwise local filter
  const filteredChannels = useMemo(() => {
    // If backend search is active and has results, use those
    if (isBackendSearchActive && backendResults.length > 0) {
      return backendResults.map(r => ({
        id: r.id,
        name: r.name,
        stream_url: r.stream_url,
        tvg_logo: r.tvg_logo,
        tvg_id: r.tvg_id,
        category_id: 'search',
        category_name: r.category_name,
        order_position: 0,
      }));
    }
    
    let sourceCategories: typeof categories = [];
    
    if (activeTab === 'favorites') {
      const favs = allChannels.filter(ch => isFavorite(ch.id));
      if (!searchQuery) return favs;
      // For favorites, still use local filter as fallback
      return favs.filter(ch => 
        ch.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (activeTab === 'home') {
      // If searching on home, show backend results
      if (isBackendSearchActive) {
        return backendResults.map(r => ({
          id: r.id,
          name: r.name,
          stream_url: r.stream_url,
          tvg_logo: r.tvg_logo,
          tvg_id: r.tvg_id,
          category_id: 'search',
          category_name: r.category_name,
          order_position: 0,
        }));
      }
      return [];
    }

    switch (activeTab) {
      case 'live': sourceCategories = categorizedContent.live; break;
      case 'movies': sourceCategories = categorizedContent.movies; break;
      case 'series': sourceCategories = categorizedContent.series; break;
    }

    if (selectedCategory) {
      sourceCategories = sourceCategories.filter(cat => cat.id === selectedCategory);
    }

    let channels = sourceCategories.flatMap(cat => 
      cat.channels.map(ch => ({ ...ch, category_name: cat.display_name }))
    );

    // If we have search but no backend results yet, show loading placeholder
    // Otherwise, the backend results take precedence
    if (searchQuery && !isBackendSearchActive) {
      const query = searchQuery.toLowerCase();
      channels = channels.filter(ch => 
        ch.name.toLowerCase().includes(query)
      );
    }

    return channels;
  }, [activeTab, categorizedContent, selectedCategory, searchQuery, allChannels, isFavorite, isBackendSearchActive, backendResults]);

  // Home content
  const homeContent = useMemo(() => {
    const sections = [];
    
    const filterChannels = (channels: any[]) => {
      if (!searchQuery) return channels.slice(0, 20);
      const query = searchQuery.toLowerCase();
      return channels.filter(ch => ch.name.toLowerCase().includes(query)).slice(0, 20);
    };
    
    if (categorizedContent.live.length > 0) {
      const liveSection = categorizedContent.live[0];
      const filteredLive = filterChannels(liveSection.channels);
      if (filteredLive.length > 0 || !searchQuery) {
        sections.push({
          ...liveSection,
          display_name: `📺 ${liveSection.display_name}`,
          channels: filteredLive,
        });
      }
    }
    
    if (categorizedContent.movies.length > 0) {
      const movieSection = categorizedContent.movies[0];
      const filteredMovies = filterChannels(movieSection.channels);
      if (filteredMovies.length > 0 || !searchQuery) {
        sections.push({
          ...movieSection,
          display_name: `🎬 ${movieSection.display_name}`,
          channels: filteredMovies,
        });
      }
    }
    
    if (categorizedContent.series.length > 0) {
      const seriesSection = categorizedContent.series[0];
      const filteredSeries = filterChannels(seriesSection.channels);
      if (filteredSeries.length > 0 || !searchQuery) {
        sections.push({
          ...seriesSection,
          display_name: `📺 ${seriesSection.display_name}`,
          channels: filteredSeries,
        });
      }
    }
    
    return sections;
  }, [categorizedContent, searchQuery]);

  // Keyboard navigation
  useEffect(() => {
    if (!showPlayerDialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPlayerDialog(false);
        setPlayerChannel(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPlayerDialog]);

  // Initialize FocusManager for TV navigation
  useFocusManagerInit();

  // Handle back button from remote/TV
  // For clients: only close player, don't navigate away
  // For admins: allow navigation back to dashboard
  useBackHandler(() => {
    if (showPlayerDialog) {
      setShowPlayerDialog(false);
      setPlayerChannel(null);
    } else if (isAdmin) {
      navigate('/dashboard');
    }
    // For clients, do nothing - they stay on the player page
  }, true);

  // Use StreamService for proxy URLs
  const getStreamUrl = useCallback((channel: any) => {
    if (!channel?.stream_url) return '';
    return streamService.getPlayableUrl(channel);
  }, []);

  // Handle play
  const handlePlay = (channel: any) => {
    setPlayerChannel(channel);
    setShowPlayerDialog(true);
  };

  // Loading state
  if (playerLoading || favoritesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-6 text-primary" />
          <p className="text-xl font-medium text-foreground mb-2">
            Carregando conteúdo
          </p>
          <p className="text-muted-foreground">
            {loadingProgress || 'Preparando sua experiência...'}
          </p>
        </div>
      </div>
    );
  }

  // No playlist state
  if (hasPlaylist === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 max-w-md text-center">
          <Tv className="w-20 h-20 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-3">Nenhuma playlist disponível</h2>
          <p className="text-muted-foreground mb-8">
            Entre em contato com o suporte para ativar sua playlist IPTV.
          </p>
          {isAdmin && (
            <Button size="lg" onClick={() => navigate('/dashboard')}>
              Voltar ao Dashboard
            </Button>
          )}
        </Card>
      </div>
    );
  }

  const tabTitle = {
    home: 'Início',
    live: 'TV ao Vivo',
    movies: 'Filmes',
    series: 'Séries',
    favorites: 'Meus Favoritos',
  }[activeTab];

  return (
    <div className="min-h-screen bg-background">
      {/* Left Navigation Rail */}
      <TVNavRail
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSettings={() => navigate(isAdmin ? '/dashboard' : '/app/profile')}
      />

      {/* Main Content Area */}
      <main className="md:ml-[72px] lg:ml-[88px]">
        {/* Top Bar */}
        <header className="fixed top-0 right-0 left-0 md:left-[72px] lg:left-[88px] h-14 sm:h-16 bg-background/95 backdrop-blur-xl border-b border-border z-40 flex items-center justify-between px-3 sm:px-4 lg:px-6 safe-area-top">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard')}
                className="flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold truncate">
                {isBackendSearchActive ? 'Busca' : tabTitle}
              </h1>
              {/* Content count */}
              <span className="hidden sm:inline text-sm text-muted-foreground flex-shrink-0">
                {isBackendSearchActive && (
                  isSearching 
                    ? 'Buscando...' 
                    : `${backendTotalResults.toLocaleString()} resultados`
                )}
                {!isBackendSearchActive && activeTab === 'home' && `${allChannels.length.toLocaleString()} itens`}
                {!isBackendSearchActive && activeTab === 'live' && `${counts.live.toLocaleString()} canais`}
                {!isBackendSearchActive && activeTab === 'movies' && `${counts.movies.toLocaleString()} filmes`}
                {!isBackendSearchActive && activeTab === 'series' && `${counts.series.toLocaleString()} séries`}
                {!isBackendSearchActive && activeTab === 'favorites' && `${allChannels.filter(ch => isFavorite(ch.id)).length.toLocaleString()} favoritos`}
              </span>
              {/* Cache indicator */}
              {isCached && !isLoadingMore && !isBackendSearchActive && (
                <div className="hidden sm:flex items-center gap-1 text-xs text-green-500 flex-shrink-0">
                  <Database className="w-3 h-3" />
                  <span>Cache</span>
                </div>
              )}
              {/* Background loading indicator */}
              {isLoadingMore && (
                <div className="hidden sm:flex items-center gap-2 text-xs text-primary animate-pulse flex-shrink-0">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{loadingProgress}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Refresh button */}
            {!isAdmin && clearCacheAndReload && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearCacheAndReload}
                className="h-9 w-9"
                title="Atualizar playlist"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar em toda playlist..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-[140px] sm:w-[200px] lg:w-[280px] pl-9 h-9 text-sm"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
              )}
            </div>

            {/* Sort select for movies */}
            {activeTab === 'movies' && (
              <Select value={movieSortBy} onValueChange={(v) => setMovieSortBy(v as MovieSortOption)}>
                <SelectTrigger className="w-[90px] sm:w-[100px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">A-Z</SelectItem>
                  <SelectItem value="rating">Avaliação</SelectItem>
                  <SelectItem value="year">Ano</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Sort select for series */}
            {activeTab === 'series' && (
              <Select value={seriesSortBy} onValueChange={(v) => setSeriesSortBy(v as SeriesSortOption)}>
                <SelectTrigger className="w-[90px] sm:w-[100px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">A-Z</SelectItem>
                  <SelectItem value="rating">Avaliação</SelectItem>
                  <SelectItem value="year">Ano</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Admin playlist selector */}
            {isAdmin && availableLists.length > 0 && (
              <select
                value={assignedPlaylist?.id || ""}
                onChange={(e) => selectList?.(e.target.value)}
                className="hidden sm:block px-3 py-1.5 rounded-lg bg-background/50 border border-border text-xs text-foreground"
              >
                {availableLists.map((list: any) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            )}

            {/* Client playlist name badge */}
            {!isAdmin && assignedPlaylist && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                <Tv className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{assignedPlaylist.name}</span>
              </div>
            )}

            {/* Settings button - only for admins */}
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard')}
                className="flex-shrink-0"
              >
                <Settings className="w-5 h-5" />
              </Button>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="pt-14 sm:pt-16 pb-24 md:pb-4">
          {/* Home View */}
          {activeTab === 'home' && (
            <>
              {/* Show search results if searching */}
              {isBackendSearchActive ? (
                <div className="px-3 py-4 sm:p-6 lg:p-8">
                  <h2 className="text-xl font-semibold mb-4">
                    {isSearching ? 'Buscando...' : `Resultados para "${searchQuery}"`}
                  </h2>
                  {isSearching ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : filteredChannels.length > 0 ? (
                    <TVContentGrid
                      channels={filteredChannels}
                      isFavorite={isFavorite}
                      onPlay={handlePlay}
                      onToggleFavorite={toggleFavorite}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Nenhum resultado encontrado</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        Tente buscar por outro termo
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {featuredItems.length > 0 && (
                    <TVHeroSection
                      items={featuredItems}
                      onPlay={(item) => {
                        const channel = allChannels.find(ch => ch.id === item.id);
                        if (channel) handlePlay(channel);
                      }}
                      onToggleFavorite={toggleFavorite}
                      isFavorite={isFavorite}
                    />
                  )}
                  
                  <div className="pb-16 space-y-2">
                    {/* Continue Watching - Smart Feature */}
                    <ContinueWatchingRow
                      items={continueWatchingItems}
                      onPlay={(item: WatchProgress) => {
                        // Try to find channel in playlist or just navigate with the data
                        const channel = allChannels.find(ch => ch.id === item.content_id);
                        if (channel) {
                          handlePlay(channel);
                        } else {
                          // Navigate with resume position
                          setPlayerChannel({
                            id: item.content_id,
                            name: item.content_name,
                            tvg_logo: item.content_logo,
                            category_name: item.content_category,
                            stream_url: '', // Will need to be resolved
                          });
                          setShowPlayerDialog(true);
                        }
                      }}
                      onRemove={async (contentId: string) => {
                        await removeContinueWatchingItem(contentId);
                      }}
                      isLoading={loadingContinueWatching}
                    />

                    {/* Top 10 - Smart Feature */}
                    <Top10Row
                      items={trendingItems}
                      title="Top 10 da Semana"
                      onPlay={(item: TrendingItem) => {
                        const channel = allChannels.find(ch => ch.id === item.content_id);
                        if (channel) {
                          handlePlay(channel);
                        }
                      }}
                      onInfo={(item: TrendingItem) => {
                        // For now, just play the content
                        const channel = allChannels.find(ch => ch.id === item.content_id);
                        if (channel) {
                          handlePlay(channel);
                        }
                      }}
                      isLoading={loadingTrending}
                    />

                    {/* Existing category content rows */}
                    {homeContent.map((category) => (
                      <TVContentRow
                        key={category.id}
                        title={category.display_name}
                        itemCount={category.channels.length}
                      >
                        {category.channels.map((channel) => (
                          <TVContentCard
                            key={channel.id}
                            id={channel.id}
                            name={channel.name}
                            logo={channel.tvg_logo || undefined}
                            category={category.display_name}
                            isFavorite={isFavorite(channel.id)}
                            onPlay={() => handlePlay(channel)}
                            onToggleFavorite={() => toggleFavorite(channel.id)}
                          />
                        ))}
                      </TVContentRow>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Favorites View */}
          {activeTab === 'favorites' && (
            <div className="pb-16">
              <TVContentGrid
                channels={filteredChannels}
                isFavorite={isFavorite}
                onPlay={handlePlay}
                onToggleFavorite={toggleFavorite}
                emptyMessage="Adicione canais aos favoritos para vê-los aqui"
              />
            </div>
          )}

          {/* Live TV View - Special layout with EPG, zapping, PIP */}
          {activeTab === 'live' && (
            <div className="px-3 py-2 sm:p-4 lg:p-6 pb-20">
              {isBackendSearchActive ? (
                <>
                  <h2 className="text-xl font-semibold mb-4">
                    {isSearching ? 'Buscando...' : `Resultados para "${searchQuery}"`}
                  </h2>
                  {isSearching ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : filteredChannels.length > 0 ? (
                    <TVContentGrid
                      channels={filteredChannels}
                      isFavorite={isFavorite}
                      onPlay={handlePlay}
                      onToggleFavorite={toggleFavorite}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Nenhum resultado encontrado</p>
                    </div>
                  )}
                </>
              ) : (
                <LiveTVView
                  channels={categorizedContent.live.flatMap(cat => 
                    cat.channels.map(ch => ({ ...ch, category_name: cat.display_name }))
                  )}
                  currentChannel={currentChannel}
                  onChannelChange={changeChannel}
                  onPlay={handlePlay}
                  isFavorite={isFavorite}
                  onToggleFavorite={toggleFavorite}
                />
              )}
            </div>
          )}

          {/* Movies View - Enhanced with TMDB integration */}
          {activeTab === 'movies' && (
            isBackendSearchActive ? (
              <div className="px-3 py-4 sm:p-6 lg:p-8">
                <h2 className="text-xl font-semibold mb-4">
                  {isSearching ? 'Buscando...' : `Resultados para "${searchQuery}"`}
                </h2>
                {isSearching ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : filteredChannels.length > 0 ? (
                  <TVContentGrid
                    channels={filteredChannels}
                    isFavorite={isFavorite}
                    onPlay={handlePlay}
                    onToggleFavorite={toggleFavorite}
                  />
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhum resultado encontrado</p>
                  </div>
                )}
              </div>
            ) : (
              <MoviesView
                categories={categorizedContent.movies}
                onPlay={handlePlay}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
                searchQuery={searchQuery}
                sortBy={movieSortBy}
              />
            )
          )}

          {/* Series View - Enhanced with TMDB integration */}
          {activeTab === 'series' && (
            isBackendSearchActive ? (
              <div className="px-3 py-4 sm:p-6 lg:p-8">
                <h2 className="text-xl font-semibold mb-4">
                  {isSearching ? 'Buscando...' : `Resultados para "${searchQuery}"`}
                </h2>
                {isSearching ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : filteredChannels.length > 0 ? (
                  <TVContentGrid
                    channels={filteredChannels}
                    isFavorite={isFavorite}
                    onPlay={handlePlay}
                    onToggleFavorite={toggleFavorite}
                  />
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhum resultado encontrado</p>
                  </div>
                )}
              </div>
            ) : (
              <SeriesView
                categories={categorizedContent.series}
                onPlay={handlePlay}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
                searchQuery={searchQuery}
                sortBy={seriesSortBy}
              />
            )
          )}
        </div>
      </main>

      {/* YouTube Style Player with Progress Tracking */}
      {showPlayerDialog && playerChannel && (
        <PlayerWithProgressTracking
          channel={playerChannel}
          getStreamUrl={getStreamUrl}
          isFavorite={isFavorite}
          toggleFavorite={toggleFavorite}
          onBack={() => {
            setShowPlayerDialog(false);
            setPlayerChannel(null);
          }}
          onError={(error) => {
            console.error('[IPTV] Player error:', error);
          }}
          refreshContinueWatching={refreshContinueWatching}
        />
      )}
    </div>
  );
}

/**
 * Player wrapper with progress tracking
 */
function PlayerWithProgressTracking({
  channel,
  getStreamUrl,
  isFavorite,
  toggleFavorite,
  onBack,
  onError,
  refreshContinueWatching,
}: {
  channel: any;
  getStreamUrl: (channel: any) => string;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  onBack: () => void;
  onError: (error: any) => void;
  refreshContinueWatching: () => void;
}) {
  const lastSaveTimeRef = useRef<number>(0);
  const currentProgressRef = useRef<number>(0);
  const totalDurationRef = useRef<number>(0);
  const hasStartedRef = useRef<boolean>(false);
  
  // Determine content type from channel data
  const getContentType = (): ContentType => {
    const catName = (channel.category_name || '').toLowerCase();
    if (catName.includes('filme') || catName.includes('movie')) return 'movie';
    if (catName.includes('série') || catName.includes('series')) return 'series';
    return 'live';
  };
  
  const contentType = getContentType();
  
  // Handle time updates - save progress every 30 seconds
  const handleTimeUpdate = useCallback(async (currentTime: number, duration: number) => {
    currentProgressRef.current = currentTime;
    totalDurationRef.current = duration;
    
    const now = Date.now();
    // Only save every 30 seconds
    if (now - lastSaveTimeRef.current < 30000) return;
    
    lastSaveTimeRef.current = now;
    
    // Only save progress for VOD content (not live)
    if (contentType === 'live') return;
    
    try {
      await watchProgressService.updateProgress(
        channel.id,
        contentType,
        channel.name,
        currentTime,
        duration,
        {
          contentLogo: channel.tvg_logo,
          contentCategory: channel.category_name,
        }
      );
      console.log(`[Progress] Saved: ${Math.round(currentTime)}s / ${Math.round(duration)}s`);
    } catch (error) {
      console.error('[Progress] Error saving:', error);
    }
  }, [channel, contentType]);
  
  // Handle playback start
  const handlePlaybackStart = useCallback(async () => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    
    try {
      await analyticsService.trackPlay(channel.id, contentType, {
        category: channel.category_name,
      });
      console.log(`[Analytics] Playback started: ${channel.name}`);
    } catch (error) {
      console.error('[Analytics] Error tracking play:', error);
    }
  }, [channel, contentType]);
  
  // Handle playback complete
  const handlePlaybackComplete = useCallback(async () => {
    if (contentType === 'live') return;
    
    try {
      await watchProgressService.markCompleted(channel.id);
      await watchProgressService.addToHistory(
        channel.id,
        contentType,
        channel.name,
        totalDurationRef.current,
        {
          contentLogo: channel.tvg_logo,
          contentCategory: channel.category_name,
        }
      );
      console.log(`[Progress] Completed: ${channel.name}`);
    } catch (error) {
      console.error('[Progress] Error marking complete:', error);
    }
  }, [channel, contentType]);
  
  // Save progress when closing player
  const handleBack = useCallback(async () => {
    if (contentType !== 'live' && currentProgressRef.current > 0) {
      try {
        await watchProgressService.updateProgress(
          channel.id,
          contentType,
          channel.name,
          currentProgressRef.current,
          totalDurationRef.current,
          {
            contentLogo: channel.tvg_logo,
            contentCategory: channel.category_name,
          }
        );
        console.log(`[Progress] Final save: ${Math.round(currentProgressRef.current)}s`);
        // Refresh continue watching list
        refreshContinueWatching();
      } catch (error) {
        console.error('[Progress] Error final save:', error);
      }
    }
    onBack();
  }, [channel, contentType, onBack, refreshContinueWatching]);
  
  return (
    <YouTubeStylePlayer
      url={getStreamUrl(channel)}
      title={channel.name}
      logo={channel.tvg_logo || undefined}
      category={channel.category_name || 'Geral'}
      autoplay
      isFavorite={isFavorite(channel.id)}
      onToggleFavorite={() => toggleFavorite(channel.id)}
      onBack={handleBack}
      onError={onError}
      onTimeUpdate={handleTimeUpdate}
      onPlaybackStart={handlePlaybackStart}
      onPlaybackComplete={handlePlaybackComplete}
    />
  );
}
