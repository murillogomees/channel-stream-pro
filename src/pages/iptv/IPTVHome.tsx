/**
 * IPTV Home - Netflix-style IPTV browsing experience
 * OTIMIZADO: Usa views materializadas + IA para recomendações
 * FILTRADO: Apenas filmes e séries (sem live)
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { iptvService, IPTVChannel, ChannelGroup } from '@/services/iptvService';
import { useRandomCategoryGroups, useCategoryStats, useSeriesCatalog, useAIRecommendations } from '@/hooks/useIPTVOptimized';
import { Loader2, Search, Heart, Film, Radio, Star, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TVContentRow } from '@/components/iptv/TVContentRow';
import { TVHeroSection } from '@/components/iptv/TVHeroSection';
import { TVSearchOverlay } from '@/components/iptv/TVSearchOverlay';
import { TVContentCard } from '@/components/iptv/TVContentCard';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from 'sonner';

type TabType = 'all' | 'vod' | 'series' | 'favorites';

export default function IPTVHome() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useLocalStorage<string[]>('iptv-favorites', []);

  // Recomendações de IA para aba "Todos"
  const { data: aiRecommendations, isLoading: loadingAI } = useAIRecommendations(favorites);

  // Fallback: categorias aleatórias (apenas filmes/séries)
  const { data: randomGroups, isLoading: loadingRandom } = useRandomCategoryGroups(4);

  // Helper para agrupar séries pelo primeiro episódio
  const groupSeriesByFirstEpisode = (channels: any[]) => {
    const seriesMap = new Map<string, any>();
    const nonSeriesItems: any[] = [];

    for (const ch of channels) {
      if (!ch.is_series || !ch.series_name) {
        nonSeriesItems.push(ch);
        continue;
      }

      const existing = seriesMap.get(ch.series_name);
      
      if (!existing) {
        seriesMap.set(ch.series_name, { ...ch, name: ch.series_name });
      } else {
        const existingSeason = existing.season_number || 999;
        const existingEpisode = existing.episode_number || 999;
        const currentSeason = ch.season_number || 999;
        const currentEpisode = ch.episode_number || 999;

        if (currentSeason < existingSeason || 
            (currentSeason === existingSeason && currentEpisode < existingEpisode)) {
          seriesMap.set(ch.series_name, { ...ch, name: ch.series_name });
        }
      }
    }

    return [...nonSeriesItems, ...seriesMap.values()];
  };

  // Fetch channels by playlist (movie/series only - live excluded, series grouped)
  const { data: contentTypeChannels, isLoading: loadingContentType } = useQuery({
    queryKey: ['iptv-content-exclude-live-grouped', activeTab],
    queryFn: async () => {
      if (activeTab === 'all' || activeTab === 'favorites') return null;

      // Buscar ID da playlist "live" para EXCLUIR
      const { data: livePlaylist } = await supabase
        .from('iptv_playlists')
        .select('id')
        .eq('slug', 'live')
        .single();

      // Buscar TODOS os IDs dos canais da playlist "live"
      const { data: liveChannels } = await supabase
        .from('iptv_playlist_channels')
        .select('channel_id')
        .eq('playlist_id', livePlaylist?.id || 0);

      const liveChannelIds = new Set((liveChannels || []).map(pc => pc.channel_id));

      // Buscar a playlist correspondente (movie ou series)
      const playlistSlug = activeTab === 'series' ? 'series' : 'movie';
      
      const { data: playlist } = await supabase
        .from('iptv_playlists')
        .select('id')
        .eq('slug', playlistSlug)
        .single();

      if (!playlist) return [];

      // Buscar IDs dos canais da playlist específica
      const { data: playlistChannels } = await supabase
        .from('iptv_playlist_channels')
        .select('channel_id')
        .eq('playlist_id', playlist.id)
        .limit(2000);

      if (!playlistChannels || playlistChannels.length === 0) return [];

      // Filtrar excluindo canais que também estão na playlist live
      const channelIds = playlistChannels
        .map(pc => pc.channel_id)
        .filter(id => !liveChannelIds.has(id));

      if (channelIds.length === 0) return [];

      // Buscar detalhes dos canais COM dados de série
      const { data: channels } = await supabase
        .from('iptv_channels')
        .select('id, name, logo_url, category, content_type, is_series, series_name, season_number, episode_number')
        .in('id', channelIds)
        .eq('is_healthy', true);

      if (!channels) return [];

      // Agrupar séries pelo primeiro episódio
      const groupedChannels = groupSeriesByFirstEpisode(channels);

      // Agrupar por categoria
      const groups: Record<string, IPTVChannel[]> = {};
      for (const ch of groupedChannels) {
        const cat = ch.category || (activeTab === 'series' ? 'Séries' : 'Filmes');
        if (!groups[cat]) groups[cat] = [];
        if (groups[cat].length < 20) {
          groups[cat].push(ch as unknown as IPTVChannel);
        }
      }

      return Object.entries(groups)
        .slice(0, 6)
        .map(([name, chs]) => ({ name, channels: chs }));
    },
    staleTime: 2 * 60 * 1000,
    enabled: activeTab !== 'all' && activeTab !== 'favorites',
  });

  // Fetch all channels for favorites
  const { data: allChannelsForFavorites } = useQuery({
    queryKey: ['iptv-all-for-favorites', favorites],
    queryFn: async () => {
      if (favorites.length === 0) return [];
      
      const { data } = await supabase
        .from('iptv_channels')
        .select('*')
        .in('id', favorites.map(Number));

      return data as IPTVChannel[] || [];
    },
    enabled: activeTab === 'favorites' && favorites.length > 0,
  });

  // Search results
  const { data: searchResults } = useQuery({
    queryKey: ['iptv-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const { channels } = await iptvService.getChannels({
        search: searchQuery,
        limit: 50,
        healthyOnly: true,
      });
      return channels;
    },
    enabled: searchQuery.length >= 2,
  });

  // Display groups based on active tab
  const displayGroups = useMemo(() => {
    if (activeTab === 'all') {
      // Priorizar recomendações de IA, fallback para categorias aleatórias
      if (aiRecommendations && aiRecommendations.length > 0) {
        return aiRecommendations;
      }
      return randomGroups || [];
    }
    
    if (activeTab === 'favorites') {
      if (!allChannelsForFavorites || allChannelsForFavorites.length === 0) return [];
      return [{ name: '❤️ Meus Favoritos', channels: allChannelsForFavorites }];
    }

    return contentTypeChannels || [];
  }, [activeTab, aiRecommendations, randomGroups, contentTypeChannels, allChannelsForFavorites]);

  // Hero featured items
  const heroItems = useMemo(() => {
    const channels = displayGroups.flatMap(g => g.channels).slice(0, 5);
    return channels.map(ch => ({
      id: String(ch.id),
      name: ch.name,
      logo: ch.logo_url || undefined,
      category: ch.category || undefined,
    }));
  }, [displayGroups]);

  // Actions
  const handlePlay = useCallback((channel: { id: string } | IPTVChannel) => {
    const channelId = 'id' in channel ? channel.id : channel;
    navigate(`/app/player/${channelId}`);
  }, [navigate]);

  const handleToggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const isFav = prev.includes(id);
      if (isFav) {
        toast.success('Removido dos favoritos');
        return prev.filter(f => f !== id);
      } else {
        toast.success('Adicionado aos favoritos');
        return [...prev, id];
      }
    });
  }, [setFavorites]);

  const isFavorite = useCallback((id: string) => {
    return favorites.includes(id);
  }, [favorites]);

  const isLoading = (activeTab === 'all' && (loadingAI || loadingRandom)) || 
                    (activeTab !== 'all' && activeTab !== 'favorites' && loadingContentType);

  const isUsingAI = activeTab === 'all' && aiRecommendations && aiRecommendations.length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">
            {loadingAI ? 'IA selecionando os melhores conteúdos...' : 'Carregando filmes e séries...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      {heroItems.length > 0 && (
        <TVHeroSection
          items={heroItems}
          onPlay={(item) => handlePlay({ id: item.id })}
          onToggleFavorite={handleToggleFavorite}
          isFavorite={isFavorite}
        />
      )}

      {/* Navigation Bar - Full Width Responsive */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center w-full">
          {/* Tabs - Responsive without horizontal scroll */}
          <Tabs 
            value={activeTab} 
            onValueChange={(v) => setActiveTab(v as TabType)}
            className="flex-1"
          >
            <TabsList className="w-full h-12 sm:h-14 md:h-16 lg:h-18 xl:h-20 bg-muted/30 rounded-none grid grid-cols-4 p-0">
              <TabsTrigger 
                value="all" 
                className="h-full flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] sm:text-xs md:text-sm lg:text-base px-1 sm:px-2 md:px-4"
              >
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 shrink-0" />
                <span className="truncate">Para Você</span>
              </TabsTrigger>
              <TabsTrigger 
                value="vod" 
                className="h-full flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] sm:text-xs md:text-sm lg:text-base px-1 sm:px-2 md:px-4"
              >
                <Film className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 shrink-0" />
                <span className="truncate">Filmes</span>
              </TabsTrigger>
              <TabsTrigger 
                value="series" 
                className="h-full flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] sm:text-xs md:text-sm lg:text-base px-1 sm:px-2 md:px-4"
              >
                <Radio className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 shrink-0" />
                <span className="truncate">Séries</span>
              </TabsTrigger>
              <TabsTrigger 
                value="favorites" 
                className="h-full flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] sm:text-xs md:text-sm lg:text-base px-1 sm:px-2 md:px-4"
              >
                <Heart className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 shrink-0" />
                <span className="truncate">Favoritos</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search Icon */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsSearchOpen(true)}
            className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 lg:h-18 lg:w-18 xl:h-20 xl:w-20 rounded-none hover:bg-primary/10 shrink-0"
          >
            <Search className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <main className="pb-20">
        {/* AI Badge quando ativo */}
        {isUsingAI && (
          <div className="flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm text-primary font-medium">Recomendado pela IA para você</span>
          </div>
        )}

        {displayGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
            <Star className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {activeTab === 'favorites' ? 'Nenhum favorito ainda' : 'Nenhum conteúdo encontrado'}
            </h2>
            <p className="text-muted-foreground">
              {activeTab === 'favorites' 
                ? 'Adicione filmes e séries aos favoritos para vê-los aqui'
                : activeTab === 'all' 
                  ? 'Aguarde enquanto preparamos as melhores recomendações'
                  : `Nenhum conteúdo disponível nesta categoria`}
            </p>
          </div>
        ) : (
          <div className="space-y-2 lg:space-y-4 pt-4">
            {displayGroups.map((group) => (
              <TVContentRow
                key={group.name}
                title={group.name}
                itemCount={group.channels.length}
              >
                {group.channels.map(ch => (
                  <TVContentCard
                    key={ch.id}
                    id={String(ch.id)}
                    name={ch.name}
                    logo={ch.logo_url || undefined}
                    category={ch.category || undefined}
                    isFavorite={isFavorite(String(ch.id))}
                    onPlay={() => navigate(`/app/player/${ch.id}`)}
                    onToggleFavorite={() => handleToggleFavorite(String(ch.id))}
                  />
                ))}
              </TVContentRow>
            ))}
          </div>
        )}
      </main>

      {/* Search Overlay */}
      <TVSearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        resultCount={searchResults?.length}
      />

      {/* Search Results */}
      {isSearchOpen && searchQuery.length >= 2 && searchResults && searchResults.length > 0 && (
        <div className="fixed inset-0 z-50 pt-48 px-4 bg-background/95 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {searchResults.map(ch => (
                <TVContentCard
                  key={ch.id}
                  id={String(ch.id)}
                  name={ch.name}
                  logo={ch.logo_url || undefined}
                  category={ch.category || undefined}
                  isFavorite={isFavorite(String(ch.id))}
                  onPlay={() => {
                    navigate(`/app/player/${ch.id}`);
                    setIsSearchOpen(false);
                  }}
                  onToggleFavorite={() => handleToggleFavorite(String(ch.id))}
                  fillContainer
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
