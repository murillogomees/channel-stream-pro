/**
 * IPTV Playlist Form Component
 * Create/Edit playlist - channels are managed via iptv_playlist_channels
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

interface Playlist {
  id?: number;
  name: string;
  slug: string;
  description: string | null;
  is_public: boolean;
}

interface IPTVPlaylistFormProps {
  playlist?: Playlist | null;
  onSuccess: () => void;
}

export function IPTVPlaylistForm({ playlist, onSuccess }: IPTVPlaylistFormProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: playlist?.name || '',
    slug: playlist?.slug || '',
    description: playlist?.description || '',
    is_public: playlist?.is_public ?? false,
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const slug = data.slug || data.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        + '-' + Date.now().toString(36);

      if (playlist?.id) {
        // Update existing playlist
        const { error } = await supabase
          .from('iptv_playlists')
          .update({
            name: data.name,
            slug,
            description: data.description || null,
            is_public: data.is_public,
            updated_at: new Date().toISOString(),
          })
          .eq('id', playlist.id);

        if (error) throw error;
        return playlist.id;
      } else {
        // Create new playlist
        const { data: newPlaylist, error } = await supabase
          .from('iptv_playlists')
          .insert({
            name: data.name,
            slug,
            description: data.description || null,
            is_public: data.is_public,
            channel_count: 0,
          })
          .select()
          .single();

        if (error) throw error;
        return newPlaylist.id;
      }
    },
    onSuccess: () => {
      toast.success(playlist?.id ? 'Playlist atualizada!' : 'Playlist criada!');
      queryClient.invalidateQueries({ queryKey: ['iptv-playlists'] });
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    mutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Ex: Minha Playlist"
          disabled={mutation.isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug (auto-gerado se vazio)</Label>
        <Input
          id="slug"
          value={formData.slug}
          onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
          placeholder="Ex: minha-playlist"
          disabled={mutation.isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Descrição opcional da playlist..."
          rows={3}
          disabled={mutation.isPending}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Playlist Pública</Label>
          <p className="text-sm text-muted-foreground">
            Acessível sem autenticação
          </p>
        </div>
        <Switch
          checked={formData.is_public}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_public: checked }))}
          disabled={mutation.isPending}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {playlist?.id ? 'Salvando...' : 'Criando...'}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {playlist?.id ? 'Salvar' : 'Criar Playlist'}
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Após criar a playlist, você pode adicionar canais da aba "Channels" usando a tabela de junção iptv_playlist_channels.
      </p>
    </form>
  );
}
