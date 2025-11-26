import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Heart, Tv, List as ListIcon, Film, Clapperboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoPlayer } from '@/components/app/VideoPlayer';
import { ChannelList } from '@/components/app/ChannelList';
import { ChannelGrid } from '@/components/app/ChannelGrid';
import { IPTVControls } from '@/components/app/IPTVControls';
import { useIPTVPlayerAdmin } from '@/hooks/useIPTVPlayerAdmin';
import { useFavoriteChannels } from '@/hooks/useFavoriteChannels';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const [view, setView] = useState<'player' | 'grid' | 'list'>('grid');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // Categorize content by type
  const categorizedContent = useMemo(() => {
    const live: typeof categories = [];
    const movies: typeof categories = [];
    const series: typeof categories = [];

    categories.forEach(cat => {
      const catName = cat.display_name.toLowerCase();
      const catId = cat.name.toLowerCase();
      
      // Detect content type based on category name
      if (catName.includes('filme') || catName.includes('movie') || 
          catId.includes('filme') || catId.includes('movie') ||
          catName.includes('vod') && !catName.includes('série') && !catName.includes('series')) {
        movies.push(cat);
      } else if (catName.includes('série') || catName.includes('series') || 
                 catName.includes('novela') || catId.includes('serie')) {
        series.push(cat);
      } else {
        live.push(cat);
      }
    });

    return { live, movies, series };
  }, [categories]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== 'player') return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          previousChannel();
          break;
        case 'ArrowDown':
          e.preventDefault();
          nextChannel();
          break;
        case 'i':
        case 'I':
          setShowInfo(prev => !prev);
          break;
        case 'Escape':
          setShowInfo(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, nextChannel, previousChannel]);

  // Get available categories for current content type
  const availableCategories = useMemo(() => {
    const cats = contentType === 'live' ? categorizedContent.live :
                 contentType === 'movies' ? categorizedContent.movies :
                 categorizedContent.series;
    return cats.map(cat => ({ id: cat.id, name: cat.display_name }));
  }, [contentType, categorizedContent]);

  // Reset selected category when content type changes
  useEffect(() => {
    setSelectedCategory(null);
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

  const allFilteredChannels = currentCategories.flatMap(cat => cat.channels);

  // Build stream URL with proxy
  const getStreamUrl = useCallback((channel: typeof currentChannel) => {
    if (!channel || !customListId) return '';
    
    const proxyUrl = 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/stream-proxy';
    const encodedUrl = encodeURIComponent(channel.stream_url);
    
    return `${proxyUrl}?url=${encodedUrl}&list=${customListId}`;
  }, [customListId]);

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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-background border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold hidden sm:block">IPTV Player - Teste Admin</h1>
          </div>

          {/* Playlist Selector */}
          <div className="flex items-center gap-2">
            <ListIcon className="w-4 h-4 text-muted-foreground hidden sm:block" />
            <Select value={customListId || undefined} onValueChange={selectList}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione playlist" />
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
        </div>
      </div>

      {/* Content Type Tabs */}
      <div className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4">
          <Tabs value={contentType} onValueChange={(v) => setContentType(v as any)} className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
              <TabsTrigger 
                value="live" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                <Tv className="w-4 h-4 mr-2" />
                TV ao Vivo
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                  {categorizedContent.live.reduce((sum, cat) => sum + cat.channels.length, 0)}
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="movies"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                <Film className="w-4 h-4 mr-2" />
                Filmes
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                  {categorizedContent.movies.reduce((sum, cat) => sum + cat.channels.length, 0)}
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="series"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                <Clapperboard className="w-4 h-4 mr-2" />
                Séries
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                  {categorizedContent.series.reduce((sum, cat) => sum + cat.channels.length, 0)}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Controls and Category Filter */}
      <div className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4">
          <IPTVControls
            view={view}
            onViewChange={setView}
            showFavoritesOnly={showFavoritesOnly}
            onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onNextChannel={nextChannel}
            onPreviousChannel={previousChannel}
            onToggleInfo={() => setShowInfo(!showInfo)}
            showInfo={showInfo}
          />
          
          {/* Category Filter */}
          {availableCategories.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground hidden sm:inline">Categoria:</span>
              <Select value={selectedCategory || 'all'} onValueChange={(v) => setSelectedCategory(v === 'all' ? null : v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {view === 'player' && currentChannel && (
          <div className="h-full flex flex-col lg:flex-row">
            {/* Video Player */}
            <div className="flex-1 bg-black relative">
              <VideoPlayer
                url={getStreamUrl(currentChannel)}
                title={currentChannel.name}
                logo={currentChannel.tvg_logo || undefined}
                className="h-full"
              />

              {/* Channel Info Overlay */}
              {showInfo && (
                <div className="absolute bottom-20 left-4 right-4 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-4 animate-in slide-in-from-bottom-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {currentChannel.tvg_logo && (
                          <img
                            src={currentChannel.tvg_logo}
                            alt={currentChannel.name}
                            className="w-12 h-12 object-contain rounded"
                          />
                        )}
                        <div>
                          <h3 className="text-lg font-bold">{currentChannel.name}</h3>
                          {currentChannel.category_name && (
                            <p className="text-sm text-muted-foreground">
                              {currentChannel.category_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use as setas ↑↓ para mudar de canal • Pressione 'i' para info
                      </p>
                      <p className="text-xs text-orange-500 mt-2">
                        ⚠️ Modo teste para administradores
                      </p>
                    </div>

                    <Button
                      variant={isFavorite(currentChannel.id) ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => toggleFavorite(currentChannel.id)}
                    >
                      <Heart
                        className={isFavorite(currentChannel.id) ? 'fill-current' : ''}
                      />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Channel List Sidebar */}
            <div className="lg:w-96 border-l border-border bg-background overflow-y-auto">
              <ChannelList
                channels={allFilteredChannels}
                categories={currentCategories.map(c => c.display_name)}
                selectedChannel={currentChannel.id}
                selectedCategory={selectedCategory}
                onChannelSelect={changeChannel}
                onCategorySelect={setSelectedCategory}
                tvMode={false}
              />
            </div>
          </div>
        )}

        {view === 'grid' && (
          <div className="h-full overflow-y-auto">
            <ChannelGrid
              channels={allFilteredChannels}
              onChannelSelect={(channel) => {
                changeChannel(channel as any);
                setView('player');
              }}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
            />
          </div>
        )}

        {!currentChannel && view === 'player' && (
          <div className="h-full flex items-center justify-center">
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
                Selecione outra playlist ou adicione conteúdo à lista atual.
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
