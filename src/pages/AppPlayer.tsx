import { useState, useEffect, useCallback, useMemo, startTransition, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tv, Database, Loader2 } from 'lucide-react';
import logoWhite from '@/assets/logo-white-nav.webp';
import { Button } from '@/components/ui/button';
import { TVTopSearchBar } from '@/components/iptv/TVTopSearchBar';
import { IptvPlayer } from '@/modules/player/iptv';
import { useHybridPlaylist } from '@/hooks/useHybridPlaylist';
import { useFavoriteChannels } from '@/hooks/useFavoriteChannels';
import { useUltraFastSearch } from '@/hooks/useUltraFastSearch';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { LoadingProgressBar } from '@/components/iptv/LoadingProgressBar';
import { TVNavRail } from '@/components/iptv/TVNavRail';
import { TVContentGrid } from '@/components/iptv/TVContentGrid';
import { ContentSkeleton } from '@/components/iptv/ContentSkeleton';
import { useFocusManagerInit, useBackHandler } from '@/modules/player/hooks/useFocusManager';
// Smart features imports
import { useContinueWatching, useRecommendations } from '@/features/player/hooks';
import { useSmartCache } from '@/hooks/useSmartCache';
import { MoviesView, SeriesView, HomeView } from '@/features/player/components';
import type { MovieSortOption, SeriesSortOption } from '@/features/player/components';
import { AppLayout } from '@/components/layouts/AppLayout';
import { SubscriptionExpiredModal } from '@/components/iptv/SubscriptionExpiredModal';
import { streamService } from '@/modules/player/services/StreamService';
import { VirtualChannelList } from '@/components/app/VirtualChannelList';
import { toast } from 'sonner';

export default function AppPlayer() {
  const navigate = useNavigate();
  const {
    isAdmin,
    user
  } = useAuth();

  // Check subscription status - admins bypass this check
  const isSubscriptionExpired = !isAdmin && user?.isExpired === true;
  const isTrial = user?.isTrial || false;
  const planName = user?.clienteData?.plano || 'Teste';

  // Hybrid playlist - metadata from CDN, stream URL resolved on-demand
  const {
    categories,
    isLoading: playerLoading,
    loadingProgress,
    totalChannels,
    loadedChannels,
    hasPlaylist,
    resolveChannel,
    isResolvingStream,
    refresh: refreshPlaylist,
  } = useHybridPlaylist();

  // Current channel for playback (with resolved stream_url)
  const [currentChannel, setCurrentChannel] = useState<any>(null);
  
  // Player state
  const [isLoadingMore] = useState(false);
  const [isCached] = useState(false);
  const [loadingPercent] = useState(0);

  // Adapt LightChannel to Channel format for existing components
  const adaptedCategories = useMemo(() => {
    return categories.map(cat => ({
      ...cat,
      channels: cat.channels.map(ch => ({
        id: ch.id,
        name: ch.name,
        stream_url: '', // Resolved on-demand
        tvg_logo: ch.logo,
        tvg_id: null,
        category_id: cat.id,
        category_name: cat.name,
        order_position: ch.seq,
      })),
    }));
  }, [categories]);

  const {
    isFavorite,
    toggleFavorite,
    isLoading: favoritesLoading
  } = useFavoriteChannels();

  // Ultra-fast database search using GIN full-text index
  const {
    query: backendQuery,
    results: backendResults,
    isSearching,
    totalCount: backendTotalResults,
    updateQuery: updateBackendSearch,
    clearSearch
  } = useUltraFastSearch(100);
  
  // Derived state for search active
  const isBackendSearchActive = backendQuery.length >= 2 && backendResults.length > 0;
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

  // Track if player is active to pause background operations
  const isPlayerActive = showPlayerDialog && playerChannel;

  // Smart Cache integration for predictive preloading
  // Paused during playback to reduce requests
  const {
    trackChannelView,
    setChannelList,
    pauseWarming,
    resumeWarming
  } = useSmartCache({
    profileId: undefined,
    enabled: !isAdmin && !isPlayerActive,
    autoWarm: !isPlayerActive,
    paused: !!isPlayerActive, // Stop stats polling during playback
  });

  // Smart features hooks
  const {
    items: continueWatchingItems,
    isLoading: loadingContinueWatching,
    removeItem: removeContinueWatchingItem,
    refresh: refreshContinueWatching
  } = useContinueWatching();

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

  // Categorize content by type - use any[] to avoid type conflicts
  const categorizedContent = useMemo(() => {
    const live: any[] = [];
    const movies: any[] = [];
    const series: any[] = [];
    adaptedCategories.forEach(cat => {
      const catName = (cat.display_name || cat.name || '').toLowerCase();
      const catId = (cat.name || '').toLowerCase();
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
    return { live, movies, series };
  }, [adaptedCategories]);

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
  const allChannels = useMemo(() => adaptedCategories.flatMap(cat => cat.channels.map(ch => ({
    ...ch,
    category_name: cat.display_name || cat.name,
    category_id: cat.id
  }))), [adaptedCategories]);

  // Update smart cache channel list - skip during playback
  useEffect(() => {
    if (allChannels.length > 0 && !isPlayerActive) {
      // Smart cache expects stream_url - skip for light channels
      // setChannelList(allChannels);
    }
  }, [allChannels, isPlayerActive]);

  // Recommendations based on watch history (must be after allChannels)
  // Disabled during playback to prevent requests
  const {
    recommendationGroups,
    seriesContinuations,
    forYouMix,
    isLoading: loadingRecommendations,
    refresh: refreshRecommendations
  } = useRecommendations({
    allChannels,
    enabled: activeTab === 'home' && !isPlayerActive
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
        name: r.title,
        stream_url: r.stream_url,
        tvg_logo: r.tvg_logo,
        tvg_id: r.tvg_id,
        category_id: 'search',
        category_name: r.group_title || 'Busca',
        order_position: 0
      }));
    }
    
    if (activeTab === 'favorites') {
      const favs = allChannels.filter(ch => isFavorite(ch.id));
      if (!searchQuery) return favs;
      return favs.filter(ch => ch.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    if (activeTab === 'home') {
      if (isBackendSearchActive) {
        return backendResults.map(r => ({
          id: r.id,
          name: r.title,
          stream_url: r.stream_url,
          tvg_logo: r.tvg_logo,
          tvg_id: r.tvg_id,
          category_id: 'search',
          category_name: r.group_title || 'Busca',
          order_position: 0
        }));
      }
      return [];
    }
    
    // Get source categories based on tab - use any to avoid type conflicts
    let sourceCats: any[] = [];
    
    switch (activeTab) {
      case 'live':
        sourceCats = categorizedContent.live;
        break;
      case 'movies':
        sourceCats = categorizedContent.movies;
        break;
      case 'series':
        sourceCats = categorizedContent.series;
        break;
    }
    
    if (selectedCategory) {
      sourceCats = sourceCats.filter(cat => cat.id === selectedCategory);
    }
    
    let channels = sourceCats.flatMap(cat => cat.channels.map((ch: any) => ({
      ...ch,
      category_name: cat.display_name || cat.name
    })));

    if (searchQuery && !isBackendSearchActive) {
      const query = searchQuery.toLowerCase();
      channels = channels.filter((ch: any) => ch.name.toLowerCase().includes(query));
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

  // REMOVED: Duplicate URL optimization - IptvPlayer/useVideoJs handles this internally
  // This was causing double optimization calls. The player already optimizes URLs.

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

  // Handle play - resolve stream URL on-demand (LAZY LOADING)
  const handlePlay = useCallback(async (channel: any) => {
    // If channel already has stream_url, use it directly
    if (channel.stream_url) {
      setPlayerChannel(channel);
      setShowPlayerDialog(true);
      trackChannelView(channel.id, channel.category_id);
      pauseWarming();
      return;
    }
    
    // Otherwise, resolve stream URL on-demand
    toast.loading('Conectando ao stream...', { id: 'stream-resolve' });
    
    const resolved = await resolveChannel(channel.id);
    
    if (!resolved) {
      toast.error('Não foi possível conectar ao stream', { id: 'stream-resolve' });
      return;
    }
    
    toast.dismiss('stream-resolve');
    
    // Create channel with resolved stream_url
    const channelWithStream = {
      ...channel,
      id: resolved.id,
      name: resolved.name || channel.name,
      stream_url: resolved.stream_url,
      tvg_logo: resolved.logo || channel.logo,
      category_name: resolved.category || channel.cat,
    };
    
    setPlayerChannel(channelWithStream);
    setShowPlayerDialog(true);
    trackChannelView(channel.id, channel.category_id || 'unknown');
    pauseWarming();
  }, [resolveChannel, trackChannelView, pauseWarming]);

  // Loading state - show skeleton to prevent CLS
  if ((playerLoading || favoritesLoading) && categories.length === 0) {
    return <AppLayout allowScroll>
        {/* NavRail skeleton space */}
        <div className="hidden md:block md:w-[72px] lg:w-[88px] fixed left-0 top-0 bottom-0 bg-card border-r border-border" />
        
        <main className="md:ml-[72px] lg:ml-[88px]">
          {/* Header skeleton */}
          <header className="fixed top-0 right-0 left-0 md:left-[72px] lg:left-[88px] h-14 sm:h-16 bg-background/95 backdrop-blur-xl border-b border-border z-40 flex items-center justify-between px-3 sm:px-4 lg:px-6">
            <div className="h-7 w-32 bg-muted rounded animate-pulse" />
            <div className="h-9 w-48 bg-muted rounded-lg animate-pulse" />
          </header>
          
          <div className="pt-14 sm:pt-16 pb-20 md:pb-4">
            {/* Hero skeleton */}
            <ContentSkeleton variant="hero" />
            
            {/* Content rows skeleton */}
            <div className="py-6">
              <ContentSkeleton variant="row" count={3} />
            </div>
            
            {/* Progress indicator */}
            <LoadingProgressBar 
              isLoading={true} 
              isLoadingMore={false} 
              loadedChannels={loadedChannels} 
              totalChannels={totalChannels} 
              loadingPercent={loadingPercent} 
              loadingProgress={loadingProgress} 
              isCached={isCached} 
            />
          </div>
        </main>
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
            {/* Refresh button */}
            <Button variant="ghost" size="icon" onClick={refreshPlaylist} title="Atualizar playlist" className="flex-shrink-0">
              <Database className="w-4 h-4" />
            </Button>
            
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
                  <TVContentGrid channels={filteredChannels as any[]} onPlay={handlePlay} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
                </div> : <HomeView continueWatchingItems={continueWatchingItems} loadingContinueWatching={loadingContinueWatching} onPlayContinue={item => {
            const channel = allChannels.find(ch => ch.id === item.content_id);
            if (channel) handlePlay(channel);
          }} onRemoveContinue={removeContinueWatchingItem} seriesContinuations={seriesContinuations} onPlaySeries={handlePlay} recommendationGroups={recommendationGroups} forYouMix={forYouMix} loadingRecommendations={loadingRecommendations} onPlayRecommendation={item => {
            const channel = allChannels.find(ch => ch.id === item.content_id);
            if (channel) handlePlay(channel);
          }} onPlayChannel={handlePlay} allChannels={allChannels as any[]} />}
            </div>}

          {activeTab === 'live' && <div className="px-4 lg:px-6 py-4 h-[calc(100vh-120px)]">
              <VirtualChannelList 
                channels={filteredChannels as any[]} 
                currentChannelId={playerChannel?.id}
                onChannelSelect={handlePlay}
                isFavorite={isFavorite}
                onFavoriteToggle={toggleFavorite}
              />
            </div>}

          {activeTab === 'movies' && <MoviesView categories={categorizedContent.movies as any[]} onPlay={handlePlay} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} sortBy={movieSortBy} />}

          {activeTab === 'series' && <SeriesView categories={categorizedContent.series as any[]} onPlay={handlePlay} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} sortBy={seriesSortBy} />}

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
          <IptvPlayer channelId={playerChannel.id} streamUrl={streamService.getPlayableUrl(playerChannel)} channelName={playerChannel.name} channelLogo={playerChannel.tvg_logo} options={{
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

      {/* Subscription Expired Modal - blocks content when subscription expires */}
      <SubscriptionExpiredModal 
        isOpen={isSubscriptionExpired} 
        isTrial={isTrial}
        planName={planName}
        daysRemaining={user?.daysRemaining || 0}
      />
    </AppLayout>;
}