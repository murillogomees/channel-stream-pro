/**
 * IPTV Playlist Categories Management
 * Add/remove categories (all channels in a category) to a playlist
 * Only shows categories not linked to ANY other playlist
 */

import { useState } from 'react';
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

const CATEGORY_PAGE_SIZE = 5000;

export function IPTVPlaylistCategories({ playlist, onUpdate }: IPTVPlaylistCategoriesProps) {
  const queryClient = useQueryClient();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // 1) Buscar TODAS as categorias com contagem em UMA query agregada (leve)
  const {
    data: allCategories,
    isLoading: loadingCategories,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ['all-iptv-categories'],
    queryFn: async () => {
      const counts = new Map<string, number>();
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('iptv_channels')
          .select('category')
          .not('category', 'is', null)
          .order('category', { ascending: true })
          .range(page * CATEGORY_PAGE_SIZE, (page + 1) * CATEGORY_PAGE_SIZE - 1);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        for (const row of data as any[]) {
          const cat = row.category as string | null;
          if (!cat) continue;
          counts.set(cat, (counts.get(cat) || 0) + 1);
        }

        hasMore = data.length === CATEGORY_PAGE_SIZE;
        page++;
      }

      const mapped: CategoryInfo[] = Array.from(counts.entries()).map(([name, count]) => ({
        name,
        channelCount: count,
      }));

      return mapped;
    },
    staleTime: 60000,
  });

  // 2) Categorias já nesta playlist
  const {
    data: thisPlaylistCategories,
    isLoading: loadingThisPlaylist,
    refetch: refetchThisPlaylist,
  } = useQuery({
    queryKey: ['playlist-categories-list', playlist.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iptv_playlist_channels')
        .select('channel:iptv_channels(category)')
        .eq('playlist_id', playlist.id);

      if (error) throw error;

      const categories = new Set<string>();
      for (const item of data || []) {
        const cat = (item.channel as any)?.category;
        if (cat) categories.add(cat);
      }
      return Array.from(categories);
    },
  });

  // 3) Categorias ligadas a OUTRAS playlists (exceto a atual)
  const {
    data: otherPlaylistCategories,
    isLoading: loadingOther,
    refetch: refetchOther,
  } = useQuery({
    queryKey: ['other-playlist-categories', playlist.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iptv_playlist_channels')
        .select('channel:iptv_channels(category)')
        .neq('playlist_id', playlist.id);

      if (error) throw error;

      const categories = new Set<string>();
      for (const item of data || []) {
        const cat = (item.channel as any)?.category;
        if (cat) categories.add(cat);
      }
      return Array.from(categories);
    },
  });

  // Disponíveis = todas - (presentes NESTA playlist apenas)
  const availableCategories = (allCategories || []).filter(
    (cat) => !thisPlaylistCategories?.includes(cat.name)
  );

  // Categorias desta playlist
  const categoriesInPlaylist = (allCategories || []).filter((cat) =>
    thisPlaylistCategories?.includes(cat.name)
  );

  // Adicionar categorias (todos os canais da categoria)
  const addCategoriesMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      let totalAdded = 0;

      for (const category of categories) {
        const { data: channels, error: fetchError } = await supabase
          .from('iptv_channels')
          .select('id')
          .eq('category', category);

        if (fetchError) throw fetchError;
        if (!channels || channels.length === 0) continue;

        const { data: existing } = await supabase
          .from('iptv_playlist_channels')
          .select('position')
          .eq('playlist_id', playlist.id)
          .order('position', { ascending: false })
          .limit(1);

        const maxPosition = existing?.[0]?.position || 0;

        for (let i = 0; i < channels.length; i += 500) {
          const batch = channels.slice(i, i + 500).map((ch, idx) => ({
            playlist_id: playlist.id,
            channel_id: ch.id,
            position: maxPosition + i + idx + 1,
          }));

          const { error } = await supabase
            .from('iptv_playlist_channels')
            .upsert(batch, {
              onConflict: 'playlist_id,channel_id',
              ignoreDuplicates: true,
            });

          if (error) throw error;
        }

        totalAdded += channels.length;
      }

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
      toast.success(`${count} canais adicionados!`);
      setSelectedCategories([]);
      refetchThisPlaylist();
      refetchOther();
      queryClient.invalidateQueries({ queryKey: ['playlist-channels'] });
      queryClient.invalidateQueries({ queryKey: ['iptv-stats'] });
      onUpdate();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Remover categoria (todos os canais dessa categoria desta playlist)
  const removeCategoryMutation = useMutation({
    mutationFn: async (category: string) => {
      const { data: channels, error: fetchError } = await supabase
        .from('iptv_channels')
        .select('id')
        .eq('category', category);

      if (fetchError) throw fetchError;
      if (!channels || channels.length === 0) return 0;

      const channelIds = channels.map((ch) => ch.id);

      for (let i = 0; i < channelIds.length; i += 500) {
        const batch = channelIds.slice(i, i + 500);
        const { error } = await supabase
          .from('iptv_playlist_channels')
          .delete()
          .eq('playlist_id', playlist.id)
          .in('channel_id', batch);

        if (error) throw error;
      }

      const { count } = await supabase
        .from('iptv_playlist_channels')
        .select('*', { count: 'exact', head: true })
        .eq('playlist_id', playlist.id);

      await supabase
        .from('iptv_playlists')
        .update({ channel_count: count || 0 })
        .eq('id', playlist.id);

      return channelIds.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} canais removidos!`);
      refetchThisPlaylist();
      refetchOther();
      queryClient.invalidateQueries({ queryKey: ['playlist-channels'] });
      queryClient.invalidateQueries({ queryKey: ['iptv-stats'] });
      onUpdate();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const toggleCategory = (name: string) => {
    setSelectedCategories((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
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
        {/* Categorias Disponíveis */}
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
            ) : availableCategories.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Todas as categorias já estão vinculadas
              </p>
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
                      {cat.channelCount}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Categorias na Playlist */}
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
            ) : categoriesInPlaylist.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Nenhuma categoria adicionada
              </p>
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
                      {cat.channelCount}
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
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
