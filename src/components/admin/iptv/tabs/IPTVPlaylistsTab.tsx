/**
 * IPTV Playlists Tab - Embedded playlist management
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Search, RefreshCw, Trash2, Edit, Copy, List, Users, Loader2, Eye, Download, Settings } from 'lucide-react';
import { IPTVPlaylistForm } from '@/components/admin/iptv/IPTVPlaylistForm';
import { IPTVPlaylistChannels } from '@/components/admin/iptv/IPTVPlaylistChannels';

interface Playlist {
  id: number;
  user_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  channel_count: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function IPTVPlaylistsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isChannelsOpen, setIsChannelsOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  const { data: playlists, isLoading, refetch } = useQuery({
    queryKey: ['iptv-playlists', search],
    queryFn: async () => {
      let query = supabase.from('iptv_playlists').select('*').order('created_at', { ascending: false });
      if (search) query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as Playlist[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['iptv-playlist-stats'],
    queryFn: async () => {
      const [total, publicCount] = await Promise.all([
        supabase.from('iptv_playlists').select('id', { count: 'exact', head: true }),
        supabase.from('iptv_playlists').select('id', { count: 'exact', head: true }).eq('is_public', true),
      ]);
      return {
        total: total.count || 0,
        public: publicCount.count || 0,
        private: (total.count || 0) - (publicCount.count || 0),
      };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await supabase.functions.invoke('iptv-admin', {
        body: { action: 'delete-playlist', data: { id } },
      });
      if (error) throw new Error(error.message);
      if (!(data as { success?: boolean })?.success) throw new Error((data as { error?: string })?.error || 'Erro');
    },
    onSuccess: () => {
      toast.success('Playlist excluída');
      queryClient.invalidateQueries({ queryKey: ['iptv-playlists'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const togglePublicMutation = useMutation({
    mutationFn: async ({ id, isPublic }: { id: number; isPublic: boolean }) => {
      const { data, error } = await supabase.functions.invoke('iptv-admin', {
        body: { action: 'update-playlist', data: { id, is_public: isPublic, name: '', slug: '' } },
      });
      if (error) throw new Error(error.message);
      if (!(data as { success?: boolean })?.success) throw new Error((data as { error?: string })?.error || 'Erro');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['iptv-playlists'] }),
  });

  const getM3UUrl = (playlist: Playlist) => {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/iptv-m3u-generator?playlist_id=${playlist.id}`;
  };

  const copyM3UUrl = (playlist: Playlist) => {
    navigator.clipboard.writeText(getM3UUrl(playlist));
    toast.success('URL copiada');
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{stats?.total || 0}</p>
              </div>
              <List className="h-6 w-6 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Públicas</p>
                <p className="text-xl font-bold text-green-500">{stats?.public || 0}</p>
              </div>
              <Eye className="h-6 w-6 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Privadas</p>
                <p className="text-xl font-bold text-orange-500">{stats?.private || 0}</p>
              </div>
              <Users className="h-6 w-6 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Dialog open={isFormOpen} onOpenChange={(open) => {
                setIsFormOpen(open);
                if (!open) setEditingPlaylist(null);
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Nova
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingPlaylist ? 'Editar' : 'Nova Playlist'}</DialogTitle>
                  </DialogHeader>
                  <IPTVPlaylistForm 
                    playlist={editingPlaylist}
                    onSuccess={() => { setIsFormOpen(false); setEditingPlaylist(null); refetch(); }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Playlists Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : playlists?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma playlist encontrada
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {playlists?.map((playlist) => (
            <Card key={playlist.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{playlist.name}</CardTitle>
                    <CardDescription className="truncate">{playlist.slug}</CardDescription>
                  </div>
                  <Badge variant={playlist.is_public ? 'default' : 'secondary'}>
                    {playlist.is_public ? 'Pública' : 'Privada'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <List className="h-4 w-4 text-muted-foreground" />
                    <span>{playlist.channel_count} canais</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={playlist.is_public}
                      onCheckedChange={(checked) => togglePublicMutation.mutate({ id: playlist.id, isPublic: checked })}
                    />
                    <span className="text-xs text-muted-foreground">Pública</span>
                  </div>

                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => copyM3UUrl(playlist)} title="Copiar URL">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => window.open(getM3UUrl(playlist), '_blank')} title="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Dialog open={isChannelsOpen && selectedPlaylist?.id === playlist.id} onOpenChange={(open) => {
                      setIsChannelsOpen(open);
                      if (!open) setSelectedPlaylist(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedPlaylist(playlist)} title="Canais">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh]">
                        <DialogHeader>
                          <DialogTitle>Canais: {playlist.name}</DialogTitle>
                        </DialogHeader>
                        <IPTVPlaylistChannels playlist={playlist} onUpdate={() => refetch()} />
                      </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="icon" onClick={() => { setEditingPlaylist(playlist); setIsFormOpen(true); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm('Excluir playlist?')) deleteMutation.mutate(playlist.id);
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
