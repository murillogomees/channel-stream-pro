import { useState, useEffect, useCallback, useMemo, useRef, startTransition, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Tv, ArrowLeft, Settings, RefreshCw, Database } from 'lucide-react';
import logoWhite from '@/assets/logo-white-nav.webp';
import { Button } from '@/components/ui/button';
import { TVTopSearchBar } from '@/components/iptv/TVTopSearchBar';
import { IptvPlayer } from '@/modules/player/iptv';
import { useIPTVPlayerClient } from '@/hooks/useIPTVPlayerClient';
import { useFavoriteChannels } from '@/hooks/useFavoriteChannels';
import { useBackendSearch } from '@/hooks/useBackendSearch';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { LoadingProgressBar } from '@/components/iptv/LoadingProgressBar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useContinueWatching, useTrending, useRecommendations } from '@/features/player/hooks';
import { useSmartCache } from '@/hooks/useSmartCache';
import { ContinueWatchingRow, Top10Row, LiveTVView, MoviesView, SeriesView, HomeView } from '@/features/player/components';
import type { MovieSortOption, SeriesSortOption } from '@/features/player/components';
import { favoritesService as playerFavoritesService, watchProgressService, analyticsService } from '@/features/player/services';
import type { WatchProgress, TrendingItem, ContentType, RecommendationItem } from '@/features/player/types';
import { AppLayout } from '@/components/layouts/AppLayout';
export default function AppPlayer() {
  const navigate = useNavigate();
  const {
    isAdmin
  } = useAuth();

  // Unified player - same content for admins and clients
  const player = useIPTVPlayerClient();
  const {
    categories,
    currentChannel,
    isLoading: playerLoading,
    loadingProgress,
    changeChannel,
    nextChannel,
    previousChannel
  } = player;

  // Player properties
  const assignedPlaylist = (player as any).assignedPlaylist;
  const hasPlaylist = (player as any).hasPlaylist;
  const totalChannels = (player as any).totalChannels;
  const loadedChannels = (player as any).loadedChannels;
  const isLoadingMore = (player as any).isLoadingMore;
  const isCached = (player as any).isCached;
  const clearCacheAndReload = (player as any).clearCacheAndReload;
  const loadingPercent = (player as any).loadingPercent || 0;
  const {
    isFavorite,
    toggleFavorite,
    isLoading: favoritesLoading
  } = useFavoriteChannels();

  // Backend search hook
  const {
    query: backendQuery,
    results: backendResults,
    isSearching,
    totalResults: backendTotalResults,
    updateQuery: updateBackendSearch,
    clearSearch,
    isActive: isBackendSearchActive
  } = useBackendSearch({
    playlistKey: 'lista-vip',
    debounceMs: 400
  });
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
  const [optimizedStreamUrl, setOptimizedStreamUrl] = useState<string | null>(null);
  const [showPlayerDialog, setShowPlayerDialog] = useState(false);
  const [movieSortBy, setMovieSortBy] = useState<MovieSortOption>('name');
  const [seriesSortBy, setSeriesSortBy] = useState<SeriesSortOption>('name');

  // Smart Cache integration for predictive preloading
  const {
    trackChannelView,
    setChannelList,
    pauseWarming,
    resumeWarming
  } = useSmartCache({
    profileId: undefined,
    // Will be set from auth context if available
    enabled: !isAdmin,
    autoWarm: true
  });

  // Smart features hooks
  const {
    items: continueWatchingItems,
    isLoading: loadingContinueWatching,
    removeItem: removeContinueWatchingItem,
    refresh: refreshContinueWatching
  } = useContinueWatching();
  const {
    items: trendingItems,
    isLoading: loadingTrending
  } = useTrending('weekly');

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
      const isMovie = movieKeywords.some(keyword => combinedText.includes(keyword)) && !seriesKeywords.some(keyword => combinedText.includes(keyword));
      const isSeries = seriesKeywords.some(keyword => combinedText.includes(keyword));
      if (isSeries) {
        series.push(cat);
      } else if (isMovie) {
        movies.push(cat);
      } else {
        live.push(cat);
      }
    });
    return {
      live,
      movies,
      series
    };
  }, [categories]);

  // Content counts - series counts unique series names, not episodes
  const counts = useMemo(() => {
    // Helper to extract series name from episode
    const extractSeriesName = (name: string): string => {
      return name.replace(/\s*S\d{1,2}\s*E\d{1,3}.*/gi, '').replace(/\s*\d{1,2}x\d{1,3}.*/gi, '').replace(/\s*-\s*Temporada\s*\d+.*/gi, '').replace(/\s*Temporada\s*\d+.*/gi, '').replace(/\s*Season\s*\d+.*/gi, '').replace(/\s*T\d+\s*E?\d*.*/gi, '').replace(/\s*Ep[is]*[óo]*d?i?o?\s*\d+.*/gi, '').replace(/\s*\(\d{4}\)/g, '').replace(/\s*\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
    };

    // Count unique series by grouping episodes
    const uniqueSeriesNames = new Set<string>();
    categorizedContent.series.forEach(cat => {
      cat.channels.forEach(ch => {
        uniqueSeriesNames.add(extractSeriesName(ch.name));
      });
    });
    return {
      live: categorizedContent.live.reduce((acc, cat) => acc + cat.channels.length, 0),
      movies: categorizedContent.movies.reduce((acc, cat) => acc + cat.channels.length, 0),
      series: uniqueSeriesNames.size // Count unique series, not episodes
    };
  }, [categorizedContent]);

  // Get all channels for search and favorites
  const allChannels = useMemo(() => categories.flatMap(cat => cat.channels.map(ch => ({
    ...ch,
    category_name: cat.display_name,
    category_id: cat.id
  }))), [categories]);

  // Update smart cache channel list
  useEffect(() => {
    if (allChannels.length > 0) {
      setChannelList(allChannels);
    }
  }, [allChannels, setChannelList]);

  // Recommendations based on watch history (must be after allChannels)
  const {
    recommendationGroups,
    seriesContinuations,
    forYouMix,
    isLoading: loadingRecommendations,
    refresh: refreshRecommendations
  } = useRecommendations({
    allChannels,
    enabled: activeTab === 'home'
  });

  // Featured items for hero
  const featuredItems = useMemo(() => {
    const items = allChannels.filter(ch => ch.tvg_logo).slice(0, 10);
    return items.map(ch => ({
      id: ch.id,
      name: ch.name,
      logo: ch.tvg_logo || undefined,
      category: ch.category_name
    }));
  }, [allChannels]);

  // Get categories for current tab
  const currentTabCategories = useMemo(() => {
    const getCats = () => {
      switch (activeTab) {
        case 'live':
          return categorizedContent.live;
        case 'movies':
          return categorizedContent.movies;
        case 'series':
          return categorizedContent.series;
        default:
          return [];
      }
    };
    return getCats().map(cat => ({
      id: cat.id,
      name: cat.name,
      display_name: cat.display_name,
      channelCount: cat.channels.length
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
        order_position: 0
      }));
    }
    let sourceCategories: typeof categories = [];
    if (activeTab === 'favorites') {
      const favs = allChannels.filter(ch => isFavorite(ch.id));
      if (!searchQuery) return favs;
      // For favorites, still use local filter as fallback
      return favs.filter(ch => ch.name.toLowerCase().includes(searchQuery.toLowerCase()));
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
          order_position: 0
        }));
      }
      return [];
    }
    switch (activeTab) {
      case 'live':
        sourceCategories = categorizedContent.live;
        break;
      case 'movies':
        sourceCategories = categorizedContent.movies;
        break;
      case 'series':
        sourceCategories = categorizedContent.series;
        break;
    }
    if (selectedCategory) {
      sourceCategories = sourceCategories.filter(cat => cat.id === selectedCategory);
    }
    let channels = sourceCategories.flatMap(cat => cat.channels.map(ch => ({
      ...ch,
      category_name: cat.display_name
    })));

    // If we have search but no backend results yet, show loading placeholder
    // Otherwise, the backend results take precedence
    if (searchQuery && !isBackendSearchActive) {
      const query = searchQuery.toLowerCase();
      channels = channels.filter(ch => ch.name.toLowerCase().includes(query));
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
          channels: filteredLive
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
          channels: filteredMovies
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
          channels: filteredSeries
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

  // Use StreamService for proxy URLs (sync version for immediate use)
  const getStreamUrl = useCallback((channel: any) => {
    if (!channel?.stream_url) return '';
    return streamService.getPlayableUrl(channel);
  }, []);

  // Fetch optimized URL when channel is selected
  useEffect(() => {
    if (playerChannel) {
      setOptimizedStreamUrl(null); // Reset while loading
      streamService.getOptimizedUrl(playerChannel).then(result => {
        console.log('[AppPlayer] URL otimizada:', result.url);
        setOptimizedStreamUrl(result.url);
      }).catch(err => {
        console.warn('[AppPlayer] URL optimization failed, using original:', err);
        setOptimizedStreamUrl(playerChannel.stream_url);
      });
    } else {
      setOptimizedStreamUrl(null);
    }
  }, [playerChannel]);

  // Helper to extract series name from episode name
  const extractSeriesName = useCallback((name: string): string => {
    return name.replace(/\s*S\d{1,2}\s*E\d{1,3}.*/gi, '').replace(/\s*\d{1,2}x\d{1,3}.*/gi, '').replace(/\s*-\s*Temporada\s*\d+.*/gi, '').replace(/\s*Temporada\s*\d+.*/gi, '').replace(/\s*Season\s*\d+.*/gi, '').replace(/\s*T\d+\s*E?\d*.*/gi, '').replace(/\s*Ep[is]*[óo]*d?i?o?\s*\d+.*/gi, '').replace(/\s*\(\d{4}\)/g, '').replace(/\s*\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
  }, []);

  // Get related episodes for the current playing channel (for series)
  const relatedSeriesEpisodes = useMemo(() => {
    if (!playerChannel) return [];

    // Check if it's a series by looking at the URL or name pattern
    const isSeries = playerChannel.stream_url?.includes('/series/') || /S\d{1,2}\s*E\d{1,3}/i.test(playerChannel.name) || /\d{1,2}x\d{1,3}/i.test(playerChannel.name) || /Temporada\s*\d+/i.test(playerChannel.name);
    if (!isSeries) return [];
    const seriesName = extractSeriesName(playerChannel.name);
    if (!seriesName) return [];

    // Find all episodes from the same series
    const episodes = allChannels.filter(ch => {
      const chSeriesName = extractSeriesName(ch.name);
      return chSeriesName === seriesName && ch.id !== playerChannel.id;
    });

    // Include current episode and sort
    return [playerChannel, ...episodes].sort((a, b) => {
      const matchA = a.name.match(/S(\d{1,2})[\s]*E(\d{1,3})/i) || a.name.match(/(\d{1,2})x(\d{1,3})/i);
      const matchB = b.name.match(/S(\d{1,2})[\s]*E(\d{1,3})/i) || b.name.match(/(\d{1,2})x(\d{1,3})/i);
      if (matchA && matchB) {
        const seasonDiff = parseInt(matchA[1]) - parseInt(matchB[1]);
        if (seasonDiff !== 0) return seasonDiff;
        return parseInt(matchA[2]) - parseInt(matchB[2]);
      }
      return a.name.localeCompare(b.name);
    });
  }, [playerChannel, allChannels, extractSeriesName]);

  // Handle playing a different episode
  const handlePlayEpisode = useCallback((episode: any) => {
    setPlayerChannel(episode);
    trackChannelView(episode.id, episode.category_id);
  }, [trackChannelView]);

  // Handle play
  const handlePlay = (channel: any) => {
    setPlayerChannel(channel);
    setShowPlayerDialog(true);
    trackChannelView(channel.id, channel.category_id);
    pauseWarming(); // Pause warming during playback
  };

  // Loading state - only show if no content at all
  if ((playerLoading || favoritesLoading) && categories.length === 0) {
    return <AppLayout className="flex items-center justify-center">
        <LoadingProgressBar isLoading={true} isLoadingMore={false} loadedChannels={loadedChannels} totalChannels={totalChannels} loadingPercent={loadingPercent} loadingProgress={loadingProgress} isCached={isCached} />
      </AppLayout>;
  }

  // No playlist state
  if (hasPlaylist === false) {
    return <AppLayout className="flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center">
          <Tv className="w-20 h-20 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-3">Nenhuma playlist disponível</h2>
          <p className="text-muted-foreground mb-8">
            Entre em contato com o suporte para ativar sua playlist IPTV.
          </p>
          {isAdmin && <Button size="lg" onClick={() => navigate('/dashboard')}>
              Voltar ao Dashboard
            </Button>}
        </Card>
      </AppLayout>;
  }
  const tabTitle = {
    home: 'Início',
    live: 'TV ao Vivo',
    movies: 'Filmes',
    series: 'Séries',
    favorites: 'Meus Favoritos'
  }[activeTab];
  return <AppLayout allowScroll>
      {/* Left Navigation Rail */}
      <TVNavRail activeTab={activeTab} onTabChange={handleTabChange} onSettings={() => navigate(isAdmin ? '/dashboard' : '/app/profile')} />

      {/* Main Content Area */}
      <main className="md:ml-[72px] lg:ml-[88px]">
        {/* Top Bar */}
        <header className="fixed top-0 right-0 left-0 md:left-[72px] lg:left-[88px] h-14 sm:h-16 bg-background/95 backdrop-blur-xl border-b border-border z-40 flex items-center justify-between px-3 sm:px-4 lg:px-6 safe-area-top">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            {isAdmin}
            
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {activeTab === 'home' && !isBackendSearchActive ? <img src={logoWhite} alt="IPTVLink" className="h-6 sm:h-7 w-auto object-contain" /> : <h1 className="text-base sm:text-lg font-semibold truncate">
                  {isBackendSearchActive ? 'Busca' : tabTitle}
                </h1>}
              {/* Content count */}
              
            </div>
          </div>
          
          {/* Search bar */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Cache indicator and refresh */}
            {isCached && <Button variant="ghost" size="icon" onClick={clearCacheAndReload} title="Atualizar playlist" className="flex-shrink-0">
                <Database className="w-4 h-4" />
              </Button>}
            
            {/* Loading more indicator - now handled by floating progress bar */}
            
            <TVTopSearchBar value={searchQuery} onChange={handleSearchChange} isSearching={isSearching} placeholder="Buscar..." />
          </div>
        </header>

        {/* Content */}
        <div className="pt-14 sm:pt-16 pb-20 md:pb-4">
          {/* Content based on active tab */}
          {activeTab === 'home' && <div className="py-4">
              {/* Search results */}
              {isBackendSearchActive && filteredChannels.length > 0 ? <div className="px-4 lg:px-6">
                  <TVContentGrid channels={filteredChannels} onPlay={handlePlay} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
                </div> : <HomeView continueWatchingItems={continueWatchingItems} loadingContinueWatching={loadingContinueWatching} onPlayContinue={item => {
            const channel = allChannels.find(ch => ch.id === item.content_id);
            if (channel) handlePlay(channel);
          }} onRemoveContinue={removeContinueWatchingItem} seriesContinuations={seriesContinuations} onPlaySeries={handlePlay} recommendationGroups={recommendationGroups} forYouMix={forYouMix} loadingRecommendations={loadingRecommendations} onPlayRecommendation={item => {
            const channel = allChannels.find(ch => ch.id === item.content_id);
            if (channel) handlePlay(channel);
          }} onPlayChannel={handlePlay} allChannels={allChannels} />}
            </div>}

          {activeTab === 'live' && <div className="px-4 lg:px-6 py-4">
              <TVContentGrid channels={filteredChannels} onPlay={handlePlay} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
            </div>}

          {activeTab === 'movies' && <MoviesView categories={categorizedContent.movies} onPlay={handlePlay} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} sortBy={movieSortBy} />}

          {activeTab === 'series' && <SeriesView categories={categorizedContent.series} onPlay={handlePlay} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} sortBy={seriesSortBy} />}

          {activeTab === 'favorites' && <div className="px-4 lg:px-6 py-4">
              {filteredChannels.length === 0 ? <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Tv className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Nenhum favorito</h3>
                  <p className="text-muted-foreground max-w-md">
                    Adicione canais aos favoritos clicando no ícone de coração para encontrá-los rapidamente aqui.
                  </p>
                </div> : <TVContentGrid channels={filteredChannels} onPlay={handlePlay} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />}
            </div>}
        </div>
      </main>

      {/* Player Dialog - IptvPlayer Modular */}
      {showPlayerDialog && playerChannel && <div className="fixed inset-0 z-50 bg-black">
          <IptvPlayer channelId={playerChannel.id} streamUrl={optimizedStreamUrl || playerChannel.stream_url} channelName={playerChannel.name} channelLogo={playerChannel.tvg_logo} options={{
        preferLowLatency: true,
        maxRetries: 3
      }} onEvent={(evt, data) => {
        if (evt === 'back') {
          setShowPlayerDialog(false);
          setPlayerChannel(null);
          refreshContinueWatching();
          resumeWarming();
        } else if (evt === 'error') {
          console.error('Player error:', data);
        }
      }} className="w-full h-full" />
        </div>}

      {/* Floating background loading progress */}
      <LoadingProgressBar isLoading={false} isLoadingMore={isLoadingMore} loadedChannels={loadedChannels} totalChannels={totalChannels} loadingPercent={loadingPercent} loadingProgress={loadingProgress} isCached={isCached} />
    </AppLayout>;
}