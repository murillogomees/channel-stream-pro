/**
 * IPTV Playlist Categories Management
 * Add/remove categories (all channels in a category) to a playlist
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, FolderPlus, Folder } from 'lucide-react';

interface Playlist {
  id: number;
  name: string;
  channel_count: number;
}

interface CategoryInfo {
  name: string;
  channelCount: number;
  isAdded: boolean;
}

interface IPTVPlaylistCategoriesProps {
  playlist: Playlist;
  onUpdate: () => void;
}

export function IPTVPlaylistCategories({ playlist, onUpdate }: IPTVPlaylistCategoriesProps) {
  const queryClient = useQueryClient();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Fetch all categories with channel counts
  const { data: allCategories, isLoading: loadingCategories } = useQuery({
    queryKey: ['all-categories-with-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iptv_channels')
        .select('category')
        .not('category', 'is', null)
        .eq('is_healthy', true);

      if (error) throw error;

      // Count channels per category
      const counts: Record<string, number> = {};
      for (const ch of data || []) {
        if (ch.category) {
          counts[ch.category] = (counts[ch.category] || 0) + 1;
        }
      }

      return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  // Fetch categories already in playlist
  const { data: playlistCategories, isLoading: loadingPlaylist, refetch } = useQuery({
    queryKey: ['playlist-categories', playlist.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iptv_playlist_channels')
        .select('channel:iptv_channels(category)')
        .eq('playlist_id', playlist.id);

      if (error) throw error;

      // Get unique categories
      const categories = new Set<string>();
      for (const item of data || []) {
        const cat = (item.channel as any)?.category;
        if (cat) categories.add(cat);
      }
      return Array.from(categories);
    },
  });

  // Combine data for display
  const categoryList: CategoryInfo[] = (allCategories || []).map(cat => ({
    name: cat.name,
    channelCount: cat.count,
    isAdded: playlistCategories?.includes(cat.name) || false,
  }));

  // Add categories mutation
  const addCategoriesMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      // Get all channels in these categories
      const { data: channels, error: fetchError } = await supabase
        .from('iptv_channels')
        .select('id')
        .in('category', categories)
        .eq('is_healthy', true);

      if (fetchError) throw fetchError;
      if (!channels || channels.length === 0) {
        throw new Error('Nenhum canal encontrado nestas categorias');
      }

      // Get current max position
      const { data: existing } = await supabase
        .from('iptv_playlist_channels')
        .select('position')
        .eq('playlist_id', playlist.id)
        .order('position', { ascending: false })
        .limit(1);

      const maxPosition = existing?.[0]?.position || 0;

      // Create payload for all channels
      const payload = channels.map((ch, idx) => ({
        playlist_id: playlist.id,
        channel_id: ch.id,
        position: maxPosition + idx + 1,
      }));

      // Insert in batches of 500
      for (let i = 0; i < payload.length; i += 500) {
        const batch = payload.slice(i, i + 500);
        const { error } = await supabase
          .from('iptv_playlist_channels')
          .upsert(batch, { onConflict: 'playlist_id,channel_id', ignoreDuplicates: true });

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

      return channels.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} canais adicionados das categorias selecionadas!`);
      setSelectedCategories([]);
      refetch();
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
      // Get channel IDs in this category
      const { data: channels, error: fetchError } = await supabase
        .from('iptv_channels')
        .select('id')
        .eq('category', category);

      if (fetchError) throw fetchError;
      if (!channels || channels.length === 0) return 0;

      const channelIds = channels.map(ch => ch.id);

      // Delete from playlist
      const { error } = await supabase
        .from('iptv_playlist_channels')
        .delete()
        .eq('playlist_id', playlist.id)
        .in('channel_id', channelIds);

      if (error) throw error;

      // Update channel count
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
      toast.success(`${count} canais removidos da categoria!`);
      refetch();
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

  const isLoading = loadingCategories || loadingPlaylist;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <FolderPlus className="h-5 w-5" />
          Adicionar por Categoria
        </h3>
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

      <div className="grid md:grid-cols-2 gap-4">
        {/* Available Categories */}
        <div className="border rounded-lg">
          <div className="p-3 border-b bg-muted/50">
            <h4 className="text-sm font-medium">Categorias Disponíveis</h4>
          </div>
          <ScrollArea className="h-[400px] p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-1">
                {categoryList.filter(c => !c.isAdded).map((cat) => (
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
                {categoryList.filter(c => !c.isAdded).length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    Todas as categorias já foram adicionadas
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Added Categories */}
        <div className="border rounded-lg">
          <div className="p-3 border-b bg-muted/50">
            <h4 className="text-sm font-medium">Categorias na Playlist</h4>
          </div>
          <ScrollArea className="h-[400px] p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-1">
                {categoryList.filter(c => c.isAdded).map((cat) => (
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
                {categoryList.filter(c => c.isAdded).length === 0 && (
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
