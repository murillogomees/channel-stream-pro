import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Tv, ArrowLeft, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import YouTubeStylePlayer from '@/components/app/YouTubeStylePlayer';
import { useIPTVPlayerClient } from '@/hooks/useIPTVPlayerClient';
import { useIPTVPlayerAdmin } from '@/hooks/useIPTVPlayerAdmin';
import { useFavoriteChannels } from '@/hooks/useFavoriteChannels';
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
  
  // Admin-specific
  const availableLists = isAdmin ? (adminPlayer as any).availableLists : [];
  const selectList = isAdmin ? (adminPlayer as any).selectList : undefined;

  const {
    isFavorite,
    toggleFavorite,
    isLoading: favoritesLoading,
  } = useFavoriteChannels();

  const [activeTab, setActiveTab] = useState<'home' | 'live' | 'movies' | 'series' | 'favorites'>('home');
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

  // Reset category selection when tab changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSelectedCategory(null);
      setSearchQuery('');
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [activeTab]);

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
  const filteredChannels = useMemo(() => {
    let sourceCategories: typeof categories = [];
    
    if (activeTab === 'favorites') {
      const favs = allChannels.filter(ch => isFavorite(ch.id));
      if (!searchQuery) return favs;
      return favs.filter(ch => 
        ch.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (activeTab === 'home') {
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

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      channels = channels.filter(ch => 
        ch.name.toLowerCase().includes(query)
      );
    }

    return channels;
  }, [activeTab, categorizedContent, selectedCategory, searchQuery, allChannels, isFavorite]);

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
        onTabChange={setActiveTab}
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
              <h1 className="text-base sm:text-lg font-semibold truncate">{tabTitle}</h1>
              {/* Content count */}
              <span className="hidden sm:inline text-sm text-muted-foreground flex-shrink-0">
                {activeTab === 'home' && `${allChannels.length.toLocaleString()} itens`}
                {activeTab === 'live' && `${counts.live.toLocaleString()} canais`}
                {activeTab === 'movies' && `${counts.movies.toLocaleString()} filmes`}
                {activeTab === 'series' && `${counts.series.toLocaleString()} séries`}
                {activeTab === 'favorites' && `${allChannels.filter(ch => isFavorite(ch.id)).length.toLocaleString()} favoritos`}
              </span>
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
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[120px] sm:w-[180px] lg:w-[240px] pl-9 h-9 text-sm"
              />
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
            </div>
          )}

          {/* Movies View - Enhanced with TMDB integration */}
          {activeTab === 'movies' && (
            <MoviesView
              categories={categorizedContent.movies}
              onPlay={handlePlay}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              searchQuery={searchQuery}
              sortBy={movieSortBy}
            />
          )}

          {/* Series View - Enhanced with TMDB integration */}
          {activeTab === 'series' && (
            <SeriesView
              categories={categorizedContent.series}
              onPlay={handlePlay}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              searchQuery={searchQuery}
              sortBy={seriesSortBy}
            />
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
