/**
 * IPTV Playlist Channels Management
 * Add/remove/reorder channels in a playlist with full pagination
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  Search, Plus, Trash2, Loader2,
  ChevronUp, ChevronDown, Tv, RefreshCw
} from 'lucide-react';

interface Playlist {
  id: number;
  name: string;
  channel_count: number;
}

interface Channel {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  category: string | null;
  is_healthy: boolean;
}

interface PlaylistChannel {
  channel_id: number;
  position: number;
  channel: Channel;
}

interface IPTVPlaylistChannelsProps {
  playlist: Playlist;
  onUpdate: () => void;
}

const PAGE_SIZE = 1000;
const DISPLAY_LIMIT = 200;

export function IPTVPlaylistChannels({ playlist, onUpdate }: IPTVPlaylistChannelsProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedToAdd, setSelectedToAdd] = useState<number[]>([]);

  // Fetch ALL current playlist channels with pagination
  const fetchPlaylistChannels = useCallback(async () => {
    const allChannels: PlaylistChannel[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('iptv_playlist_channels')
        .select(`
          channel_id,
          position,
          channel:iptv_channels(id, name, slug, logo_url, category, is_healthy)
        `)
        .eq('playlist_id', playlist.id)
        .order('position', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allChannels.push(...(data as unknown as PlaylistChannel[]));
        hasMore = data.length === PAGE_SIZE;
        page++;
      } else {
        hasMore = false;
      }
    }

    return allChannels;
  }, [playlist.id]);

  const { data: playlistChannels, isLoading: loadingPlaylist, refetch } = useQuery({
    queryKey: ['playlist-channels', playlist.id],
    queryFn: fetchPlaylistChannels,
  });

  // Fetch available channels (not in playlist) with pagination
  const fetchAvailableChannels = useCallback(async () => {
    // Get current channel IDs
    const currentIds = new Set(playlistChannels?.map(pc => pc.channel_id) || []);
    
    const availableChannels: Channel[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore && availableChannels.length < 500) {
      let query = supabase
        .from('iptv_channels')
        .select('id, name, slug, logo_url, category, is_healthy')
        .order('name')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search) {
        query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        // Filter out channels already in playlist
        const filtered = data.filter(ch => !currentIds.has(ch.id));
        availableChannels.push(...filtered);
        hasMore = data.length === PAGE_SIZE;
        page++;
      } else {
        hasMore = false;
      }
    }

    return availableChannels;
  }, [playlistChannels, search]);

  const { data: availableChannels, isLoading: loadingAvailable, refetch: refetchAvailable } = useQuery({
    queryKey: ['available-channels', playlist.id, search, playlistChannels?.length],
    queryFn: fetchAvailableChannels,
    enabled: !!playlistChannels,
  });

  // Add channels mutation
  const addMutation = useMutation({
    mutationFn: async (channelIds: number[]) => {
      const maxPosition = playlistChannels?.length 
        ? Math.max(...playlistChannels.map(pc => pc.position)) 
        : 0;

      // Insert in batches
      for (let i = 0; i < channelIds.length; i += 500) {
        const batch = channelIds.slice(i, i + 500).map((id, idx) => ({
          playlist_id: playlist.id,
          channel_id: id,
          position: maxPosition + i + idx + 1,
        }));

        const { error } = await supabase
          .from('iptv_playlist_channels')
          .insert(batch);

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
    },
    onSuccess: () => {
      toast.success('Canais adicionados!');
      setSelectedToAdd([]);
      refetch();
      refetchAvailable();
      onUpdate();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Remove channel mutation
  const removeMutation = useMutation({
    mutationFn: async (channelId: number) => {
      const { error } = await supabase
        .from('iptv_playlist_channels')
        .delete()
        .eq('playlist_id', playlist.id)
        .eq('channel_id', channelId);

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
    },
    onSuccess: () => {
      toast.success('Canal removido!');
      refetch();
      refetchAvailable();
      onUpdate();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Move channel mutation
  const moveMutation = useMutation({
    mutationFn: async ({ channelId, direction }: { channelId: number; direction: 'up' | 'down' }) => {
      if (!playlistChannels) return;

      const currentIndex = playlistChannels.findIndex(pc => pc.channel_id === channelId);
      if (currentIndex === -1) return;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= playlistChannels.length) return;

      const current = playlistChannels[currentIndex];
      const swap = playlistChannels[newIndex];

      // Swap positions
      await Promise.all([
        supabase
          .from('iptv_playlist_channels')
          .update({ position: swap.position })
          .eq('playlist_id', playlist.id)
          .eq('channel_id', current.channel_id),
        supabase
          .from('iptv_playlist_channels')
          .update({ position: current.position })
          .eq('playlist_id', playlist.id)
          .eq('channel_id', swap.channel_id),
      ]);
    },
    onSuccess: () => {
      refetch();
    },
  });

  const toggleSelectToAdd = (channelId: number) => {
    setSelectedToAdd(prev => 
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  };

  const handleRefresh = () => {
    refetch();
    refetchAvailable();
  };

  // Display first N channels for performance
  const displayedPlaylistChannels = playlistChannels?.slice(0, DISPLAY_LIMIT) || [];
  const hasMorePlaylist = (playlistChannels?.length || 0) > DISPLAY_LIMIT;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Gerenciar Canais</h3>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loadingPlaylist}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingPlaylist ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4 h-[500px]">
        {/* Current Channels */}
        <div className="border rounded-lg flex flex-col">
          <div className="p-3 border-b bg-muted/50">
            <h3 className="font-medium">
              Canais na Playlist ({playlistChannels?.length || 0})
            </h3>
            {hasMorePlaylist && (
              <p className="text-xs text-muted-foreground mt-1">
                Exibindo primeiros {DISPLAY_LIMIT} canais
              </p>
            )}
          </div>
          <ScrollArea className="flex-1 p-2">
            {loadingPlaylist ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : playlistChannels?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum canal adicionado
              </p>
            ) : (
              <div className="space-y-1">
                {displayedPlaylistChannels.map((pc, idx) => (
                  <div 
                    key={pc.channel_id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group"
                  >
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => moveMutation.mutate({ channelId: pc.channel_id, direction: 'up' })}
                        disabled={idx === 0}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => moveMutation.mutate({ channelId: pc.channel_id, direction: 'down' })}
                        disabled={idx === displayedPlaylistChannels.length - 1}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <div className="flex-shrink-0">
                      {pc.channel.logo_url ? (
                        <img 
                          src={pc.channel.logo_url} 
                          alt="" 
                          className="w-8 h-8 rounded object-cover"
                          onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                          <Tv className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{pc.channel.name}</p>
                      <p className="text-xs text-muted-foreground">{pc.channel.category || '-'}</p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={() => removeMutation.mutate(pc.channel_id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Available Channels */}
        <div className="border rounded-lg flex flex-col">
          <div className="p-3 border-b bg-muted/50 space-y-2">
            <h3 className="font-medium">
              Adicionar Canais ({availableChannels?.length || 0} disponíveis)
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar canais..."
                className="pl-9 h-8"
              />
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-2">
            {loadingAvailable ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : availableChannels?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum canal disponível
              </p>
            ) : (
              <div className="space-y-1">
                {availableChannels?.slice(0, DISPLAY_LIMIT).map((channel) => (
                  <div 
                    key={channel.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleSelectToAdd(channel.id)}
                  >
                    <Checkbox 
                      checked={selectedToAdd.includes(channel.id)}
                      onCheckedChange={() => toggleSelectToAdd(channel.id)}
                    />
                    
                    <div className="flex-shrink-0">
                      {channel.logo_url ? (
                        <img 
                          src={channel.logo_url} 
                          alt="" 
                          className="w-8 h-8 rounded object-cover"
                          onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                          <Tv className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{channel.name}</p>
                      <p className="text-xs text-muted-foreground">{channel.category || '-'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {selectedToAdd.length > 0 && (
            <div className="p-3 border-t">
              <Button 
                className="w-full"
                onClick={() => addMutation.mutate(selectedToAdd)}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Adicionar {selectedToAdd.length} canal(is)
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
