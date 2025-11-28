import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Tv, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import UniversalPlayer from '@/components/app/UniversalPlayer';
import { useIPTVPlayerAdmin } from '@/hooks/useIPTVPlayerAdmin';
import { useFavoriteChannels } from '@/hooks/useFavoriteChannels';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { streamService } from '@/modules/player/services/StreamService';
import { useFocusManagerInit, useBackHandler } from '@/modules/player/hooks/useFocusManager';

export default function AdminIPTVTest() {
  const navigate = useNavigate();
  const {
    categories,
    currentChannel,
    isLoading: playerLoading,
    loadingProgress,
    customListId,
    availableLists,
    totalChannels,
    loadedChannels,
    isLoadingMore,
    changeChannel,
    nextChannel,
    previousChannel,
    selectList,
  } = useIPTVPlayerAdmin();

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

  // Reset category selection when tab changes - use startTransition for smoother UI
  useEffect(() => {
    // Defer state updates to prevent blocking
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

  // Filtered channels based on search and category - with limiting for performance
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

    // Filter by selected category first (most restrictive)
    if (selectedCategory) {
      sourceCategories = sourceCategories.filter(cat => cat.id === selectedCategory);
    }

    // Get all channels from filtered categories
    let channels = sourceCategories.flatMap(cat => 
      cat.channels.map(ch => ({ ...ch, category_name: cat.display_name }))
    );

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      channels = channels.filter(ch => 
        ch.name.toLowerCase().includes(query)
      );
    }

    return channels;
  }, [activeTab, categorizedContent, selectedCategory, searchQuery, allChannels, isFavorite]);

  // Home content (simplified) - with search filtering
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
  useBackHandler(() => {
    if (showPlayerDialog) {
      setShowPlayerDialog(false);
      setPlayerChannel(null);
    } else {
      navigate('/dashboard');
    }
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
  if (availableLists.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 max-w-md text-center">
          <Tv className="w-20 h-20 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-3">Nenhuma playlist disponível</h2>
          <p className="text-muted-foreground mb-8">
            Configure uma lista M3U padrão para começar a assistir.
          </p>
          <Button size="lg" onClick={() => navigate('/admin/m3u')}>
            Configurar M3U
          </Button>
        </Card>
      </div>
    );
  }

  const showSidebar = activeTab !== 'home' && activeTab !== 'favorites';
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
        onSettings={() => navigate('/dashboard')}
      />

      {/* Main Content Area */}
      <main className="md:ml-[72px] lg:ml-[88px]">
        {/* Top Bar */}
        <header className="fixed top-0 right-0 left-0 md:left-[72px] lg:left-[88px] h-14 sm:h-16 bg-background/80 backdrop-blur-xl border-b border-border z-40 flex items-center justify-between px-3 sm:px-4 lg:px-6">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold truncate">{tabTitle}</h1>
              {/* Content count - hide on very small screens */}
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
            {/* Search - responsive width */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[120px] sm:w-[180px] lg:w-[240px] pl-9 h-9 text-sm"
              />
            </div>

            {/* Playlist Selector - hide on mobile */}
            <Select value={customListId || undefined} onValueChange={selectList}>
              <SelectTrigger className="hidden sm:flex w-[140px] lg:w-[180px] h-9">
                <SelectValue placeholder="Playlist" />
              </SelectTrigger>
              <SelectContent>
                {availableLists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* Content */}
        <div className="pt-14 sm:pt-16 pb-20 md:pb-4">
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
              
              <div className="pb-16">
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

          {/* Category Views (Live, Movies, Series) */}
          {showSidebar && (
            <div className="flex min-h-[calc(100vh-4rem)]">
              {/* Category Sidebar */}
              <aside className="hidden lg:block w-[240px] xl:w-[280px] flex-shrink-0 border-r border-border py-4 lg:py-6 px-4">
                <TVCategoryFilter
                  categories={currentTabCategories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  title="Categorias"
                />
              </aside>

              {/* Content Area */}
              <div className="flex-1 pb-16">
                {/* Mobile Category Select */}
                <div className="lg:hidden px-4 lg:px-8 py-4">
                  <Select 
                    value={selectedCategory || "all"} 
                    onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        Todas as categorias ({filteredChannels.length})
                      </SelectItem>
                      {currentTabCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.display_name} ({cat.channelCount})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Results info for search */}
                {searchQuery && (
                  <div className="px-4 lg:px-8 pb-2">
                    <p className="text-sm text-muted-foreground">
                      {filteredChannels.length} resultado{filteredChannels.length !== 1 ? 's' : ''} 
                      {searchQuery && ` para "${searchQuery}"`}
                    </p>
                  </div>
                )}

                <TVContentGrid
                  channels={filteredChannels}
                  isFavorite={isFavorite}
                  onPlay={handlePlay}
                  onToggleFavorite={toggleFavorite}
                  emptyMessage={
                    searchQuery 
                      ? "Nenhum resultado encontrado" 
                      : "Selecione uma categoria para ver o conteúdo"
                  }
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Universal Player - Fullscreen */}
      {showPlayerDialog && playerChannel && (
        <UniversalPlayer
          url={getStreamUrl(playerChannel)}
          title={playerChannel.name}
          logo={playerChannel.tvg_logo || undefined}
          autoplay
          onBack={() => {
            setShowPlayerDialog(false);
            setPlayerChannel(null);
          }}
          onError={(error) => {
            console.error('[IPTV] Player error:', error);
          }}
        />
      )}
    </div>
  );
}
