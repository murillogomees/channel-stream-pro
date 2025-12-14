/**
 * IPTV Playlist Categories Management
 * Add/remove categories (all channels in a category) to a playlist
 * Only shows categories not linked to ANY playlist
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, FolderPlus, Folder, RefreshCw } from 'lucide-react';

interface Playlist {
  id: number;
  name: string;
  channel_count: number;
}

interface CategoryInfo {
  name: string;
  channelCount: number;
}

interface IPTVPlaylistCategoriesProps {
  playlist: Playlist;
  onUpdate: () => void;
}

const PAGE_SIZE = 1000;

export function IPTVPlaylistCategories({ playlist, onUpdate }: IPTVPlaylistCategoriesProps) {
  const queryClient = useQueryClient();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Fetch ALL categories with channel counts using pagination
  const fetchAllCategories = useCallback(async () => {
    const allChannels: { category: string | null }[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('iptv_channels')
        .select('category')
        .not('category', 'is', null)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        allChannels.push(...data);
        hasMore = data.length === PAGE_SIZE;
        page++;
      } else {
        hasMore = false;
      }
    }

    // Count channels per category
    const counts: Record<string, number> = {};
    for (const ch of allChannels) {
      if (ch.category) {
        counts[ch.category] = (counts[ch.category] || 0) + 1;
      }
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, channelCount: count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const { data: allCategories, isLoading: loadingCategories, refetch: refetchCategories } = useQuery({
    queryKey: ['all-categories-paginated'],
    queryFn: fetchAllCategories,
    staleTime: 60000,
  });

  // Fetch categories already in THIS playlist
  const { data: thisPlaylistCategories, isLoading: loadingThisPlaylist, refetch: refetchThisPlaylist } = useQuery({
    queryKey: ['playlist-categories', playlist.id],
    queryFn: async () => {
      const categories = new Set<string>();
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('iptv_playlist_channels')
          .select('channel:iptv_channels(category)')
          .eq('playlist_id', playlist.id)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          for (const item of data) {
            const cat = (item.channel as any)?.category;
            if (cat) categories.add(cat);
          }
          hasMore = data.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      return Array.from(categories);
    },
  });

  // Fetch categories linked to OTHER playlists (not this one)
  const { data: linkedToOtherPlaylists, isLoading: loadingOther, refetch: refetchOther } = useQuery({
    queryKey: ['categories-linked-to-other-playlists', playlist.id],
    queryFn: async () => {
      const categories = new Set<string>();
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('iptv_playlist_channels')
          .select('channel:iptv_channels(category), playlist_id')
          .neq('playlist_id', playlist.id)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          for (const item of data) {
            const cat = (item.channel as any)?.category;
            if (cat) categories.add(cat);
          }
          hasMore = data.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      return Array.from(categories);
    },
  });

  // Available categories = all categories NOT linked to ANY playlist
  const availableCategories: CategoryInfo[] = (allCategories || []).filter(
    cat => !linkedToOtherPlaylists?.includes(cat.name) && !thisPlaylistCategories?.includes(cat.name)
  );

  // Categories in this playlist
  const categoriesInPlaylist: CategoryInfo[] = (allCategories || []).filter(
    cat => thisPlaylistCategories?.includes(cat.name)
  );

  // Add categories mutation
  const addCategoriesMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      let totalAdded = 0;
      
      for (const category of categories) {
        // Get all channels in this category with pagination
        let allChannelIds: number[] = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const { data: channels, error: fetchError } = await supabase
            .from('iptv_channels')
            .select('id')
            .eq('category', category)
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

          if (fetchError) throw fetchError;

          if (channels && channels.length > 0) {
            allChannelIds.push(...channels.map(ch => ch.id));
            hasMore = channels.length === PAGE_SIZE;
            page++;
          } else {
            hasMore = false;
          }
        }

        if (allChannelIds.length === 0) continue;

        // Get current max position
        const { data: existing } = await supabase
          .from('iptv_playlist_channels')
          .select('position')
          .eq('playlist_id', playlist.id)
          .order('position', { ascending: false })
          .limit(1);

        const maxPosition = existing?.[0]?.position || 0;

        // Create payload and insert in batches
        for (let i = 0; i < allChannelIds.length; i += 500) {
          const batch = allChannelIds.slice(i, i + 500).map((id, idx) => ({
            playlist_id: playlist.id,
            channel_id: id,
            position: maxPosition + i + idx + 1,
          }));

          const { error } = await supabase
            .from('iptv_playlist_channels')
            .upsert(batch, { onConflict: 'playlist_id,channel_id', ignoreDuplicates: true });

          if (error) throw error;
        }

        totalAdded += allChannelIds.length;
      }

      // Update channel count
      const { count } = await supabase
        .from('iptv_playlist_channels')
        .select('*', { count: 'exact', head: true })
        .eq('playlist_id', playlist.id);

      await supabase
        .from('iptv_playlists')
        .update({ channel_count: count || 0 })
        .eq('id', playlist.id);

      return totalAdded;
    },
    onSuccess: (count) => {
      toast.success(`${count} canais adicionados das categorias selecionadas!`);
      setSelectedCategories([]);
      refetchThisPlaylist();
      refetchOther();
      queryClient.invalidateQueries({ queryKey: ['playlist-channels'] });
      onUpdate();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Remove category mutation
  const removeCategoryMutation = useMutation({
    mutationFn: async (category: string) => {
      // Get all channel IDs in this category with pagination
      let allChannelIds: number[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: channels, error: fetchError } = await supabase
          .from('iptv_channels')
          .select('id')
          .eq('category', category)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (fetchError) throw fetchError;

        if (channels && channels.length > 0) {
          allChannelIds.push(...channels.map(ch => ch.id));
          hasMore = channels.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      if (allChannelIds.length === 0) return 0;

      // Delete in batches
      for (let i = 0; i < allChannelIds.length; i += 500) {
        const batch = allChannelIds.slice(i, i + 500);
        const { error } = await supabase
          .from('iptv_playlist_channels')
          .delete()
          .eq('playlist_id', playlist.id)
          .in('channel_id', batch);

        if (error) throw error;
      }

      // Update channel count
      const { count } = await supabase
        .from('iptv_playlist_channels')
        .select('*', { count: 'exact', head: true })
        .eq('playlist_id', playlist.id);

      await supabase
        .from('iptv_playlists')
        .update({ channel_count: count || 0 })
        .eq('id', playlist.id);

      return allChannelIds.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} canais removidos da categoria!`);
      refetchThisPlaylist();
      refetchOther();
      queryClient.invalidateQueries({ queryKey: ['playlist-channels'] });
      onUpdate();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const toggleCategory = (name: string) => {
    setSelectedCategories(prev =>
      prev.includes(name)
        ? prev.filter(c => c !== name)
        : [...prev, name]
    );
  };

  const handleRefresh = () => {
    refetchCategories();
    refetchThisPlaylist();
    refetchOther();
  };

  const isLoading = loadingCategories || loadingThisPlaylist || loadingOther;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <FolderPlus className="h-5 w-5" />
          Adicionar por Categoria
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {selectedCategories.length > 0 && (
            <Button
              onClick={() => addCategoriesMutation.mutate(selectedCategories)}
              disabled={addCategoriesMutation.isPending}
              size="sm"
            >
              {addCategoriesMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Adicionar {selectedCategories.length} categoria(s)
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Available Categories (not linked to any playlist) */}
        <div className="border rounded-lg">
          <div className="p-3 border-b bg-muted/50">
            <h4 className="text-sm font-medium">
              Categorias Disponíveis ({availableCategories.length})
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Categorias sem vínculo com nenhuma playlist
            </p>
          </div>
          <ScrollArea className="h-[400px] p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-1">
                {availableCategories.map((cat) => (
                  <div
                    key={cat.name}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleCategory(cat.name)}
                  >
                    <Checkbox
                      checked={selectedCategories.includes(cat.name)}
                      onCheckedChange={() => toggleCategory(cat.name)}
                    />
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{cat.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {cat.channelCount} canais
                    </Badge>
                  </div>
                ))}
                {availableCategories.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    Todas as categorias já estão vinculadas a uma playlist
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Categories in this playlist */}
        <div className="border rounded-lg">
          <div className="p-3 border-b bg-muted/50">
            <h4 className="text-sm font-medium">
              Categorias na Playlist ({categoriesInPlaylist.length})
            </h4>
          </div>
          <ScrollArea className="h-[400px] p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-1">
                {categoriesInPlaylist.map((cat) => (
                  <div
                    key={cat.name}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group"
                  >
                    <Folder className="h-4 w-4 text-primary" />
                    <span className="flex-1 text-sm truncate">{cat.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {cat.channelCount} canais
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={() => removeCategoryMutation.mutate(cat.name)}
                      disabled={removeCategoryMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {categoriesInPlaylist.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    Nenhuma categoria adicionada
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
