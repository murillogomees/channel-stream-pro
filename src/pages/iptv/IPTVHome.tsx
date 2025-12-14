/**
 * IPTV Home - Netflix-style IPTV browsing experience
 * - Aba "Todos": 4 fileiras aleatórias
 * - Aba "Ao Vivo": playlist slug "live"
 * - Aba "Filmes": playlist slug "movies"
 * - Aba "Séries": playlist slug "series"
 * - Aba "Favoritos": localStorage favorites
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { iptvService, IPTVChannel, ChannelGroup } from '@/services/iptvService';
import { Loader2, Search, Heart, Tv, Film, Radio, Grid3X3, Star, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TVContentRow } from '@/components/iptv/TVContentRow';
import { TVHeroSection } from '@/components/iptv/TVHeroSection';
import { TVSearchOverlay } from '@/components/iptv/TVSearchOverlay';
import { TVContentCard } from '@/components/iptv/TVContentCard';
import { NetflixContentGrid } from '@/components/iptv/NetflixContentGrid';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from 'sonner';

type TabType = 'all' | 'live' | 'vod' | 'series' | 'favorites';

// Playlist slug mapping
const PLAYLIST_SLUGS: Record<string, string> = {
  live: 'live',
  vod: 'movies',
  series: 'series',
};

export default function IPTVHome() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useLocalStorage<string[]>('iptv-favorites', []);

  // Fetch random channels for "Todos" tab (4 groups with random selection)
  const { data: randomGroups, isLoading: loadingRandom } = useQuery({
    queryKey: ['iptv-random-groups'],
    queryFn: async () => {
      // Get all categories
      const { data: categories } = await supabase
        .from('iptv_channels')
        .select('category')
        .not('category', 'is', null)
        .eq('is_healthy', true);

      const uniqueCategories = [...new Set(categories?.map(c => c.category) || [])];
      
      // Shuffle and take 4 random categories
      const shuffled = uniqueCategories.sort(() => Math.random() - 0.5);
      const selectedCats = shuffled.slice(0, 4);

      // Fetch channels for each category (limit 20 each, randomized)
      const groups: ChannelGroup[] = [];
      for (const cat of selectedCats) {
        const { data: channels } = await supabase
          .from('iptv_channels')
          .select('*')
          .eq('category', cat)
          .eq('is_healthy', true)
          .limit(50);

        if (channels && channels.length > 0) {
          // Shuffle and take max 20
          const shuffledChannels = channels.sort(() => Math.random() - 0.5).slice(0, 20);
          groups.push({
            name: cat || 'Sem Categoria',
            channels: shuffledChannels as IPTVChannel[],
          });
        }
      }

      return groups;
    },
    staleTime: 30 * 1000, // 30 seconds (so it refreshes more often for variety)
    enabled: activeTab === 'all',
  });

  // Fetch playlist channels by slug for other tabs
  const { data: playlistChannels, isLoading: loadingPlaylist } = useQuery({
    queryKey: ['iptv-playlist-by-slug', activeTab],
    queryFn: async () => {
      const slug = PLAYLIST_SLUGS[activeTab];
      if (!slug) return null;

      // Find playlist by slug
      const { data: playlist } = await supabase
        .from('iptv_playlists')
        .select('id, name')
        .eq('slug', slug)
        .single();

      if (!playlist) return null;

      // Get channels from playlist
      const { data: channels } = await supabase
        .from('iptv_playlist_channels')
        .select(`
          position,
          channel:iptv_channels(*)
        `)
        .eq('playlist_id', playlist.id)
        .order('position');

      if (!channels) return null;

      // Group by category
      const groups: Record<string, IPTVChannel[]> = {};
      for (const item of channels) {
        const ch = item.channel as any as IPTVChannel;
        if (!ch) continue;
        const cat = ch.category || 'Sem Categoria';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(ch);
      }

      return Object.entries(groups).map(([name, chs]) => ({ name, channels: chs }));
    },
    staleTime: 5 * 60 * 1000,
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
      return randomGroups || [];
    }
    
    if (activeTab === 'favorites') {
      if (!allChannelsForFavorites || allChannelsForFavorites.length === 0) return [];
      return [{ name: 'Meus Favoritos', channels: allChannelsForFavorites }];
    }

    return playlistChannels || [];
  }, [activeTab, randomGroups, playlistChannels, allChannelsForFavorites]);

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

  const isLoading = (activeTab === 'all' && loadingRandom) || 
                    (activeTab !== 'all' && activeTab !== 'favorites' && loadingPlaylist);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando canais...</p>
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
            <TabsList className="w-full h-12 sm:h-14 md:h-16 lg:h-18 xl:h-20 bg-muted/30 rounded-none grid grid-cols-5 p-0">
              <TabsTrigger 
                value="all" 
                className="h-full flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] sm:text-xs md:text-sm lg:text-base px-1 sm:px-2 md:px-4"
              >
                <Grid3X3 className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 shrink-0" />
                <span className="truncate">Todos</span>
              </TabsTrigger>
              <TabsTrigger 
                value="live" 
                className="h-full flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] sm:text-xs md:text-sm lg:text-base px-1 sm:px-2 md:px-4"
              >
                <Tv className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 shrink-0" />
                <span className="truncate">Ao Vivo</span>
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
        {displayGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
            <Star className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {activeTab === 'favorites' ? 'Nenhum favorito ainda' : 'Nenhum canal encontrado'}
            </h2>
            <p className="text-muted-foreground">
              {activeTab === 'favorites' 
                ? 'Adicione canais aos favoritos para vê-los aqui'
                : activeTab === 'all' 
                  ? 'Importe canais M3U para começar'
                  : `Crie uma playlist com slug "${PLAYLIST_SLUGS[activeTab] || activeTab}" para exibir conteúdo aqui`}
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
