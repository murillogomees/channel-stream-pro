import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Heart, Tv, List as ListIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoPlayer } from '@/components/app/VideoPlayer';
import { ChannelList } from '@/components/app/ChannelList';
import { ChannelGrid } from '@/components/app/ChannelGrid';
import { IPTVControls } from '@/components/app/IPTVControls';
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

  const [view, setView] = useState<'player' | 'grid' | 'list'>('player');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

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

  // Filter channels
  const filteredCategories = categories.map(cat => ({
    ...cat,
    channels: cat.channels.filter(ch => {
      const matchesSearch = ch.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || cat.id === selectedCategory;
      const matchesFavorites = !showFavoritesOnly || isFavorite(ch.id);
      return matchesSearch && matchesCategory && matchesFavorites;
    })
  })).filter(cat => cat.channels.length > 0);

  const allFilteredChannels = filteredCategories.flatMap(cat => cat.channels);

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

      {/* Controls */}
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
                categories={filteredCategories.map(c => c.display_name)}
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
              <Tv className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-bold mb-2">Nenhum canal disponível</h2>
              <p className="text-muted-foreground">
                Selecione outra playlist ou adicione canais à lista atual.
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
