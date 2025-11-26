import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, X, Search, Tv, Film, Clapperboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoPlayer } from '@/components/app/VideoPlayer';
import { ContentCarousel } from '@/components/app/ContentCarousel';
import { ContentCard } from '@/components/app/ContentCard';
import { useIPTVPlayerAdmin } from '@/hooks/useIPTVPlayerAdmin';
import { useFavoriteChannels } from '@/hooks/useFavoriteChannels';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
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

export default function AdminIPTVTest() {
  const navigate = useNavigate();
  const {
    categories,
    currentChannel,
    isLoading: playerLoading,
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

  const [contentType, setContentType] = useState<'live' | 'movies' | 'series'>('live');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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
      
      // Keywords for movies
      const movieKeywords = [
        'filme', 'movie', 'cinema', 'vod filme', 'filmes',
        'movies', 'film', 'peliculas', 'pelicula'
      ];
      
      // Keywords for series
      const seriesKeywords = [
        'série', 'series', 'seriado', 'novela', 'temporada',
        'season', 'episódio', 'episode', 'miniserie', 'sitcom',
        'serie', 'séries', 'drama', 'dorama'
      ];
      
      // Keywords for live TV
      const liveKeywords = [
        'ao vivo', 'live', 'tv', 'canal', 'channel', 'hd',
        'sd', 'fhd', '4k', 'aberto', 'fechado', 'esporte',
        'sport', 'notícia', 'news', 'infantil', 'kids',
        'documentário', 'documentary', 'variedade', 'variety',
        'religioso', 'religious', 'música', 'music'
      ];
      
      // Check for movies
      const isMovie = movieKeywords.some(keyword => combinedText.includes(keyword)) &&
                      !seriesKeywords.some(keyword => combinedText.includes(keyword));
      
      // Check for series
      const isSeries = seriesKeywords.some(keyword => combinedText.includes(keyword));
      
      // Check for live TV
      const isLive = liveKeywords.some(keyword => combinedText.includes(keyword)) ||
                     (!isMovie && !isSeries); // Default to live if not identified
      
      if (isSeries) {
        series.push(cat);
      } else if (isMovie) {
        movies.push(cat);
      } else if (isLive) {
        live.push(cat);
      }
    });

    return { live, movies, series };
  }, [categories]);

  // Keyboard navigation for player
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

  // Get available categories for current content type
  const availableCategories = useMemo(() => {
    const cats = contentType === 'live' ? categorizedContent.live :
                 contentType === 'movies' ? categorizedContent.movies :
                 categorizedContent.series;
    return cats.map(cat => ({ id: cat.id, name: cat.display_name }));
  }, [contentType, categorizedContent]);

  // Reset filters when content type changes
  useEffect(() => {
    setSelectedCategory(null);
    setSearchQuery('');
  }, [contentType]);

  // Filter channels based on content type
  const getFilteredCategories = useCallback((cats: typeof categories) => {
    return cats.map(cat => ({
      ...cat,
      channels: cat.channels.filter(ch => {
        const matchesSearch = ch.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = !selectedCategory || cat.id === selectedCategory;
        const matchesFavorites = !showFavoritesOnly || isFavorite(ch.id);
        return matchesSearch && matchesCategory && matchesFavorites;
      })
    })).filter(cat => cat.channels.length > 0);
  }, [searchQuery, selectedCategory, showFavoritesOnly, isFavorite]);

  const currentCategories = useMemo(() => {
    switch (contentType) {
      case 'live':
        return getFilteredCategories(categorizedContent.live);
      case 'movies':
        return getFilteredCategories(categorizedContent.movies);
      case 'series':
        return getFilteredCategories(categorizedContent.series);
      default:
        return [];
    }
  }, [contentType, categorizedContent, getFilteredCategories]);

  // Build stream URL with proxy
  const getStreamUrl = useCallback((channel: any) => {
    if (!channel || !customListId) {
      console.error('[AdminIPTVTest] Missing channel or customListId:', { channel: !!channel, customListId });
      return '';
    }
    
    const proxyUrl = 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/stream-proxy';
    const encodedUrl = encodeURIComponent(channel.stream_url);
    const finalUrl = `${proxyUrl}?url=${encodedUrl}&list=${customListId}`;
    
    console.log('[AdminIPTVTest] Building stream URL:', {
      channelName: channel.name,
      originalUrl: channel.stream_url,
      proxyUrl: finalUrl
    });
    
    return finalUrl;
  }, [customListId]);

  // Handle play
  const handlePlay = (channel: any) => {
    setPlayerChannel(channel);
    setShowPlayerDialog(true);
  };

  if (playerLoading || favoritesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg text-muted-foreground">Carregando playlist...</p>
        </div>
      </div>
    );
  }

  if (availableLists.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 max-w-md text-center">
          <Tv className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Nenhuma playlist disponível</h2>
          <p className="text-muted-foreground mb-6">
            Crie uma lista M3U customizada primeiro.
          </p>
          <Button onClick={() => navigate('/admin/m3u/custom')}>
            Ir para M3U Manager
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Netflix Style */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-background via-background/95 to-transparent backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 md:px-16 py-4">
          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/dashboard')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>

            <div className="flex items-center gap-2">
              <Tv className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold hidden sm:block">IPTV Player</h1>
            </div>
          </div>

          {/* Playlist Selector */}
          <Select value={customListId || undefined} onValueChange={selectList}>
            <SelectTrigger className="w-[180px] md:w-[220px]">
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

        {/* Navigation Tabs - Netflix Style Full Width */}
        <div className="w-full">
          <Tabs value={contentType} onValueChange={(v) => setContentType(v as any)} className="w-full">
            <TabsList className="w-full bg-transparent border-b-2 border-border h-auto p-0 rounded-none gap-8 justify-start px-6 md:px-16">
              <TabsTrigger 
                value="live" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-4 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-bold rounded-none pb-3 px-0 transition-all text-muted-foreground text-base md:text-lg hover:text-foreground border-b-4 border-transparent -mb-[2px]"
              >
                <Tv className="w-5 h-5 mr-2" />
                TV ao Vivo
              </TabsTrigger>
              <TabsTrigger 
                value="movies"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-4 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-bold rounded-none pb-3 px-0 transition-all text-muted-foreground text-base md:text-lg hover:text-foreground border-b-4 border-transparent -mb-[2px]"
              >
                <Film className="w-5 h-5 mr-2" />
                Filmes
              </TabsTrigger>
              <TabsTrigger 
                value="series"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-4 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-bold rounded-none pb-3 px-0 transition-all text-muted-foreground text-base md:text-lg hover:text-foreground border-b-4 border-transparent -mb-[2px]"
              >
                <Clapperboard className="w-5 h-5 mr-2" />
                Séries
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="fixed top-[136px] left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-6 md:px-16 py-4 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background/50 border-muted-foreground/20"
            />
          </div>

          {availableCategories.length > 0 && (
            <Select value={selectedCategory || 'all'} onValueChange={(v) => setSelectedCategory(v === 'all' ? null : v)}>
              <SelectTrigger className="w-[200px] bg-background/50 border-muted-foreground/20">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {availableCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Main Content - Netflix Style Carousels */}
      <div className="pt-[200px] pb-12">
        {currentCategories.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px] px-4">
            <Card className="p-8 max-w-md text-center">
              {contentType === 'live' && <Tv className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />}
              {contentType === 'movies' && <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />}
              {contentType === 'series' && <Clapperboard className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />}
              <h2 className="text-2xl font-bold mb-2">
                {contentType === 'live' && 'Nenhum canal disponível'}
                {contentType === 'movies' && 'Nenhum filme disponível'}
                {contentType === 'series' && 'Nenhuma série disponível'}
              </h2>
              <p className="text-muted-foreground">
                Selecione outra playlist ou adicione conteúdo.
              </p>
            </Card>
          </div>
        ) : (
          currentCategories.map((category) => (
            <ContentCarousel
              key={category.id}
              title={category.display_name}
              itemCount={category.channels.length}
            >
              {category.channels.map((channel) => (
                <ContentCard
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
            </ContentCarousel>
          ))
        )}
      </div>

      {/* Video Player Dialog */}
      <Dialog open={showPlayerDialog} onOpenChange={setShowPlayerDialog}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full p-0 bg-black border-0">
          <DialogTitle className="sr-only">
            {playerChannel?.name || 'Player'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Reproduzindo canal {playerChannel?.name}
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
                className="absolute top-4 right-4 bg-background/80 hover:bg-background/95 backdrop-blur-sm rounded-full z-20"
                onClick={() => {
                  setShowPlayerDialog(false);
                  setPlayerChannel(null);
                }}
              >
                <X className="w-6 h-6" />
              </Button>

              {/* Info Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/80 to-transparent p-6 z-10">
                <h2 className="text-2xl font-bold mb-2">{playerChannel.name}</h2>
                {playerChannel.category_name && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {playerChannel.category_name}
                  </p>
                )}
                <Button
                  variant={isFavorite(playerChannel.id) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleFavorite(playerChannel.id)}
                  className="gap-2"
                >
                  {isFavorite(playerChannel.id) ? '❤️ Favorito' : '🤍 Adicionar aos favoritos'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
