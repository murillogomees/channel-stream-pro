/**
 * IPTV Playlist Categories Management
 * Add/remove categories (all channels in a category) to a playlist
 * Optimized queries using database-level filtering with indexes
 */

import { useState, useEffect } from 'react';
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

export function IPTVPlaylistCategories({ playlist, onUpdate }: IPTVPlaylistCategoriesProps) {
  const queryClient = useQueryClient();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [autoLinkDone, setAutoLinkDone] = useState(false);

  // 1) Categorias DISPONÍVEIS: canais que NÃO estão nesta playlist específica
  const {
    data: availableCategories = [],
    isLoading: loadingAvailable,
    refetch: refetchAvailable,
  } = useQuery({
    queryKey: ['available-categories-for-playlist', playlist.id],
    queryFn: async () => {
      // Buscar todos os vínculos de canais com playlists
      const { data: playlistChannels, error: linkedError } = await supabase
        .from('iptv_playlist_channels')
        .select('channel_id, playlist_id, channel:iptv_channels!inner(category)');

      if (linkedError) throw linkedError;

      const linkedIdsAnyPlaylist = new Set<number>();
      const existingCategoryNamesCurrent = new Set<string>();

      for (const item of playlistChannels || []) {
        linkedIdsAnyPlaylist.add(item.channel_id as number);
        const cat = (item as any).channel?.category as string | null;
        if (!cat) continue;

        if (item.playlist_id === playlist.id) {
          // Categorias que já existem nesta playlist NÃO devem aparecer como disponíveis
          existingCategoryNamesCurrent.add(cat.toLowerCase().trim());
        }
      }

      // Buscar todos os canais com categoria
      const { data: allChannels, error: allError } = await supabase
        .from('iptv_channels')
        .select('id, category')
        .not('category', 'is', null)
        .order('category', { ascending: true });

      if (allError) throw allError;

      // Categorias disponíveis = canais que NÃO estão em NENHUMA playlist
      // e cuja categoria ainda não existe nesta playlist
      const counts = new Map<string, number>();
      for (const ch of allChannels || []) {
        if (!ch.category) continue;
        if (linkedIdsAnyPlaylist.has(ch.id)) continue;

        const catKey = ch.category.toLowerCase().trim();
        if (existingCategoryNamesCurrent.has(catKey)) continue;

        counts.set(ch.category, (counts.get(ch.category) || 0) + 1);
      }

      return Array.from(counts.entries())
        .map(([name, count]) => ({ name, channelCount: count }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 0,
    gcTime: 0,
  });

  // 2) Categorias NESTA PLAYLIST: categorias dos canais vinculados a esta playlist
  const {
    data: playlistCategories = [],
    isLoading: loadingPlaylist,
    refetch: refetchPlaylist,
  } = useQuery({
    queryKey: ['playlist-categories', playlist.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iptv_playlist_channels')
        .select('channel:iptv_channels!inner(category)')
        .eq('playlist_id', playlist.id)
        .not('channel.category', 'is', null);

      if (error) throw error;

      const counts = new Map<string, number>();
      for (const item of data || []) {
        const cat = (item.channel as any)?.category as string;
        if (cat) counts.set(cat, (counts.get(cat) || 0) + 1);
      }

      return Array.from(counts.entries())
        .map(([name, count]) => ({ name, channelCount: count }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 0,
    gcTime: 0,
  });

  // 3) Auto-unificar: categorias disponíveis com mesmo nome de categorias já na playlist
  const autoLinkMutation = useMutation({
    mutationFn: async () => {
      // 1. Buscar categorias que JÁ existem nesta playlist
      const { data: playlistChannelsData } = await supabase
        .from('iptv_playlist_channels')
        .select('channel_id, channel:iptv_channels!inner(category)')
        .eq('playlist_id', playlist.id);

      if (!playlistChannelsData || playlistChannelsData.length === 0) return 0;

      // Extrair categorias únicas já na playlist
      const existingCategories = new Set<string>();
      const linkedIds = new Set<number>();
      
      for (const item of playlistChannelsData) {
        linkedIds.add(item.channel_id);
        const cat = (item.channel as any)?.category as string;
        if (cat) existingCategories.add(cat.toLowerCase().trim());
      }

      if (existingCategories.size === 0) return 0;

      // 2. Buscar TODOS os canais que têm essas mesmas categorias mas não estão na playlist
      const { data: allChannelsWithCategories } = await supabase
        .from('iptv_channels')
        .select('id, category')
        .not('category', 'is', null);

      if (!allChannelsWithCategories) return 0;

      // Filtrar canais que:
      // - Têm categoria que já existe na playlist
      // - Ainda não estão vinculados a esta playlist
      const newChannels = allChannelsWithCategories.filter(ch => {
        if (!ch.category) return false;
        if (linkedIds.has(ch.id)) return false;
        return existingCategories.has(ch.category.toLowerCase().trim());
      });

      if (newChannels.length === 0) return 0;

      // 3. Obter posição máxima atual
      const { data: existing } = await supabase
        .from('iptv_playlist_channels')
        .select('position')
        .eq('playlist_id', playlist.id)
        .order('position', { ascending: false })
        .limit(1);

      const maxPosition = existing?.[0]?.position || 0;

      // 4. Inserir em batches
      for (let i = 0; i < newChannels.length; i += 500) {
        const batch = newChannels.slice(i, i + 500).map((ch, idx) => ({
          playlist_id: playlist.id,
          channel_id: ch.id,
          position: maxPosition + i + idx + 1,
        }));

        await supabase
          .from('iptv_playlist_channels')
          .upsert(batch, {
            onConflict: 'playlist_id,channel_id',
            ignoreDuplicates: true,
          });
      }

      // 5. Atualizar contagem
      const { count } = await supabase
        .from('iptv_playlist_channels')
        .select('*', { count: 'exact', head: true })
        .eq('playlist_id', playlist.id);

      await supabase
        .from('iptv_playlists')
        .update({ channel_count: count || 0 })
        .eq('id', playlist.id);

      return newChannels.length;
    },
    onSuccess: (count) => {
      if (count > 0) {
        toast.success(`Unificados ${count} canais de categorias existentes`);
        refetchAvailable();
        refetchPlaylist();
        queryClient.invalidateQueries({ queryKey: ['iptv-playlists'] });
        onUpdate();
      }
      setAutoLinkDone(true);
    },
    onError: (err) => {
      console.error('[IPTVPlaylistCategories] Auto-link error:', err);
      setAutoLinkDone(true);
    },
  });

  // Executar auto-unificação ao montar o componente e ao trocar de playlist
  useEffect(() => {
    if (!autoLinkDone && !autoLinkMutation.isPending) {
      autoLinkMutation.mutate();
    }
  }, [playlist.id, autoLinkDone, autoLinkMutation.isPending]);

  // Sempre que trocar de playlist, resetar flag para reexecutar auto-unificação
  useEffect(() => {
    setAutoLinkDone(false);
  }, [playlist.id]);

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
      refetchAvailable();
      refetchPlaylist();
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
      refetchAvailable();
      refetchPlaylist();
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
    refetchAvailable();
    refetchPlaylist();
  };

  const isLoading = loadingAvailable || loadingPlaylist;

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
              Categorias com canais não vinculados a nenhuma playlist
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
                  <label
                    key={cat.name}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
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
                  </label>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Categorias na Playlist */}
        <div className="border rounded-lg">
          <div className="p-3 border-b bg-muted/50">
            <h4 className="text-sm font-medium">
              Categorias na Playlist ({playlistCategories.length})
            </h4>
          </div>
          <ScrollArea className="h-[400px] p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : playlistCategories.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Nenhuma categoria adicionada
              </p>
            ) : (
              <div className="space-y-1">
                {playlistCategories.map((cat) => (
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
