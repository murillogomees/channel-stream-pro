/**
 * IPTV Home - Netflix-style IPTV browsing experience
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { iptvService, IPTVChannel, ChannelGroup } from '@/services/iptvService';
import { Loader2, Search, Heart, Tv, Film, Radio, Grid3X3, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { TVContentRow } from '@/components/iptv/TVContentRow';
import { TVHeroSection } from '@/components/iptv/TVHeroSection';
import { TVSearchOverlay } from '@/components/iptv/TVSearchOverlay';
import { TVContentCard } from '@/components/iptv/TVContentCard';
import { NetflixContentGrid } from '@/components/iptv/NetflixContentGrid';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X } from 'lucide-react';

export default function IPTVHome() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'vod' | 'series' | 'favorites'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'rows' | 'grid'>('rows');
  const [favorites, setFavorites] = useLocalStorage<string[]>('iptv-favorites', []);

  // Fetch grouped channels
  const { data: channelGroups, isLoading } = useQuery({
    queryKey: ['iptv-channels-grouped', activeTab],
    queryFn: async () => {
      const contentType = activeTab === 'all' || activeTab === 'favorites' ? undefined : activeTab;
      return iptvService.getChannelsGrouped({ 
        healthyOnly: true,
        contentType 
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['iptv-categories'],
    queryFn: () => iptvService.getCategories(),
    staleTime: 10 * 60 * 1000,
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

  // Filter by favorites
  const displayGroups = useMemo(() => {
    if (!channelGroups) return [];
    
    if (activeTab === 'favorites') {
      const favChannels = channelGroups
        .flatMap(g => g.channels)
        .filter(c => favorites.includes(String(c.id)));
      
      if (favChannels.length === 0) return [];
      return [{ name: 'Meus Favoritos', channels: favChannels }];
    }

    if (selectedCategory) {
      return channelGroups.filter(g => g.name === selectedCategory);
    }

    return channelGroups;
  }, [channelGroups, activeTab, selectedCategory, favorites]);

  // All channels flat for grid view
  const allChannels = useMemo(() => {
    return displayGroups.flatMap(g => g.channels).map(ch => ({
      id: String(ch.id),
      name: ch.name,
      tvg_logo: ch.logo_url || undefined,
      category_name: ch.category || undefined,
    }));
  }, [displayGroups]);

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
      {heroItems.length > 0 && viewMode === 'rows' && !selectedCategory && (
        <TVHeroSection
          items={heroItems}
          onPlay={(item) => handlePlay({ id: item.id })}
          onToggleFavorite={handleToggleFavorite}
          isFavorite={isFavorite}
        />
      )}

      {/* Navigation Bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setSelectedCategory(null); }}>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="all" className="gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Todos</span>
                </TabsTrigger>
                <TabsTrigger value="live" className="gap-2">
                  <Tv className="h-4 w-4" />
                  <span className="hidden sm:inline">Ao Vivo</span>
                </TabsTrigger>
                <TabsTrigger value="vod" className="gap-2">
                  <Film className="h-4 w-4" />
                  <span className="hidden sm:inline">Filmes</span>
                </TabsTrigger>
                <TabsTrigger value="series" className="gap-2">
                  <Radio className="h-4 w-4" />
                  <span className="hidden sm:inline">Séries</span>
                </TabsTrigger>
                <TabsTrigger value="favorites" className="gap-2">
                  <Heart className="h-4 w-4" />
                  <span className="hidden sm:inline">Favoritos</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Actions */}
            <div className="flex items-center gap-2 w-full lg:w-auto">
              {/* Category Filter */}
              {categories.length > 0 && (
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedCategory || 'all'}
                    onValueChange={(value) => setSelectedCategory(value === 'all' ? null : value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        <SelectValue placeholder="Categoria" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedCategory && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCategory(null)}
                      className="gap-1 h-8"
                    >
                      <X className="h-3 w-3" />
                      Limpar
                    </Button>
                  )}
                </div>
              )}

              {/* View Mode Toggle */}
              <div className="hidden md:flex items-center border rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === 'rows' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('rows')}
                  className="rounded-none"
                >
                  Linhas
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-none"
                >
                  Grade
                </Button>
              </div>

              {/* Search */}
              <Button variant="outline" size="icon" onClick={() => setIsSearchOpen(true)}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
                : 'Tente mudar o filtro ou categoria'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <NetflixContentGrid
            channels={allChannels}
            isFavorite={isFavorite}
            onPlay={(ch) => navigate(`/app/player/${ch.id}`)}
            onToggleFavorite={(id) => handleToggleFavorite(id)}
            initialLimit={48}
          />
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

      {/* Search Results (when search is open and has query) */}
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
