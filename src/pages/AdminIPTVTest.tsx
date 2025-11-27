import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, X, Tv, Film, Clapperboard, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoPlayer } from '@/components/app/VideoPlayer';
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { TVNavRail } from '@/components/iptv/TVNavRail';
import { TVHeroSection } from '@/components/iptv/TVHeroSection';
import { TVContentRow } from '@/components/iptv/TVContentRow';
import { TVContentCard } from '@/components/iptv/TVContentCard';
import { TVSearchOverlay } from '@/components/iptv/TVSearchOverlay';

export default function AdminIPTVTest() {
  const navigate = useNavigate();
  const {
    categories,
    currentChannel,
    isLoading: playerLoading,
    loadingProgress,
    customListId,
    availableLists,
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
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [playerChannel, setPlayerChannel] = useState<any>(null);
  const [showPlayerDialog, setShowPlayerDialog] = useState(false);

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

  // Filter by search
  const filteredCategories = useMemo(() => {
    const filterCats = (cats: typeof categories) => {
      if (!searchQuery) return cats;
      
      return cats.map(cat => ({
        ...cat,
        channels: cat.channels.filter(ch => 
          ch.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.channels.length > 0);
    };

    return {
      live: filterCats(categorizedContent.live),
      movies: filterCats(categorizedContent.movies),
      series: filterCats(categorizedContent.series),
    };
  }, [categorizedContent, searchQuery]);

  // Current content based on tab
  const currentContent = useMemo(() => {
    if (activeTab === 'favorites') {
      const favoriteChannels = allChannels.filter(ch => isFavorite(ch.id));
      return [{
        id: 'favorites',
        name: 'favorites',
        display_name: 'Meus Favoritos',
        icon: null,
        channels: favoriteChannels
      }];
    }
    
    if (activeTab === 'home') {
      // Mix of all content for home
      const homeSections = [];
      
      if (filteredCategories.live.length > 0) {
        homeSections.push({
          ...filteredCategories.live[0],
          display_name: `📺 ${filteredCategories.live[0].display_name}`
        });
      }
      if (filteredCategories.movies.length > 0) {
        homeSections.push({
          ...filteredCategories.movies[0],
          display_name: `🎬 ${filteredCategories.movies[0].display_name}`
        });
      }
      if (filteredCategories.series.length > 0) {
        homeSections.push({
          ...filteredCategories.series[0],
          display_name: `📺 ${filteredCategories.series[0].display_name}`
        });
      }
      
      // Add more categories
      filteredCategories.live.slice(1, 3).forEach(cat => homeSections.push(cat));
      filteredCategories.movies.slice(1, 2).forEach(cat => homeSections.push(cat));
      
      return homeSections;
    }

    switch (activeTab) {
      case 'live': return filteredCategories.live;
      case 'movies': return filteredCategories.movies;
      case 'series': return filteredCategories.series;
      default: return [];
    }
  }, [activeTab, filteredCategories, allChannels, isFavorite]);

  // Search result count
  const searchResultCount = useMemo(() => {
    if (!searchQuery) return 0;
    return currentContent.reduce((acc, cat) => acc + cat.channels.length, 0);
  }, [currentContent, searchQuery]);

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

  // Build stream URL with proxy
  const getStreamUrl = useCallback((channel: any) => {
    if (!channel || !customListId) return '';
    const proxyUrl = 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/stream-proxy';
    const encodedUrl = encodeURIComponent(channel.stream_url);
    return `${proxyUrl}?url=${encodedUrl}&list=${customListId}`;
  }, [customListId]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Left Navigation Rail */}
      <TVNavRail
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={counts}
        onSearch={() => setShowSearch(true)}
        onSettings={() => navigate('/admin/dashboard')}
      />

      {/* Main Content Area */}
      <main className="ml-[72px] lg:ml-[88px]">
        {/* Top Bar */}
        <header className="fixed top-0 right-0 left-[72px] lg:left-[88px] h-16 bg-background/80 backdrop-blur-xl border-b border-border z-40 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin/dashboard')}
              className="lg:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            <h1 className="text-lg font-semibold hidden sm:block">
              {activeTab === 'home' && 'Início'}
              {activeTab === 'live' && 'TV ao Vivo'}
              {activeTab === 'movies' && 'Filmes'}
              {activeTab === 'series' && 'Séries'}
              {activeTab === 'favorites' && 'Meus Favoritos'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Playlist Selector */}
            <Select value={customListId || undefined} onValueChange={selectList}>
              <SelectTrigger className="w-[160px] lg:w-[200px] h-9">
                <SelectValue placeholder="Selecionar Playlist" />
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
        <div className="pt-16">
          {/* Hero Section (only on home) */}
          {activeTab === 'home' && featuredItems.length > 0 && (
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

          {/* Content Rows */}
          <div className={cn(
            "pb-16",
            activeTab !== 'home' && "pt-8"
          )}>
            {currentContent.length === 0 ? (
              <div className="flex items-center justify-center min-h-[50vh] px-4">
                <Card className="p-8 max-w-md text-center">
                  {activeTab === 'live' && <Tv className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />}
                  {activeTab === 'movies' && <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />}
                  {activeTab === 'series' && <Clapperboard className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />}
                  {activeTab === 'favorites' && (
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-3xl">❤️</span>
                    </div>
                  )}
                  <h2 className="text-xl font-bold mb-2">
                    {activeTab === 'favorites' ? 'Nenhum favorito' : 'Nenhum conteúdo'}
                  </h2>
                  <p className="text-muted-foreground">
                    {activeTab === 'favorites' 
                      ? 'Adicione canais aos favoritos para vê-los aqui'
                      : 'Selecione outra categoria ou playlist'}
                  </p>
                </Card>
              </div>
            ) : (
              <div className="space-y-2">
                {currentContent.map((category) => (
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
            )}
          </div>
        </div>
      </main>

      {/* Search Overlay */}
      <TVSearchOverlay
        isOpen={showSearch}
        onClose={() => {
          setShowSearch(false);
          setSearchQuery('');
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        resultCount={searchResultCount}
      />

      {/* Video Player Dialog */}
      <Dialog open={showPlayerDialog} onOpenChange={setShowPlayerDialog}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full p-0 bg-black border-0 rounded-xl overflow-hidden">
          <DialogTitle className="sr-only">
            {playerChannel?.name || 'Player'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Reproduzindo {playerChannel?.name}
          </DialogDescription>
          
          {playerChannel && (
            <div className="relative w-full h-full">
              <VideoPlayer
                url={getStreamUrl(playerChannel)}
                title={playerChannel.name}
                logo={playerChannel.tvg_logo || undefined}
                className="w-full h-full"
              />

              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full z-20 h-12 w-12"
                onClick={() => {
                  setShowPlayerDialog(false);
                  setPlayerChannel(null);
                }}
              >
                <X className="w-6 h-6" />
              </Button>

              {/* Bottom Info */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6 lg:p-8 z-10">
                <h2 className="text-2xl lg:text-3xl font-bold mb-2">{playerChannel.name}</h2>
                {playerChannel.category_name && (
                  <p className="text-muted-foreground mb-4">
                    {playerChannel.category_name}
                  </p>
                )}
                <Button
                  variant={isFavorite(playerChannel.id) ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => toggleFavorite(playerChannel.id)}
                  className="gap-2"
                >
                  {isFavorite(playerChannel.id) ? '❤️ Favoritado' : '🤍 Adicionar aos favoritos'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
