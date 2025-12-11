/**
 * IPTV Playlist Form Component
 * Create/Edit playlist
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
import { Loader2 } from 'lucide-react';

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
      const { data: { user } } = await supabase.auth.getUser();
      
      // Generate slug if empty
      const slug = data.slug || data.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const payload = {
        name: data.name,
        slug,
        description: data.description || null,
        is_public: data.is_public,
        user_id: user?.id,
      };

      if (playlist?.id) {
        const { error } = await supabase
          .from('iptv_playlists')
          .update(payload)
          .eq('id', playlist.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('iptv_playlists')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(playlist?.id ? 'Playlist atualizada!' : 'Playlist criada!');
      queryClient.invalidateQueries({ queryKey: ['iptv-playlists'] });
      queryClient.invalidateQueries({ queryKey: ['iptv-playlist-stats'] });
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
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug (auto-gerado se vazio)</Label>
        <Input
          id="slug"
          value={formData.slug}
          onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
          placeholder="Ex: minha-playlist"
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
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Playlist Pública</Label>
          <p className="text-sm text-muted-foreground">
            Playlists públicas podem ser acessadas sem autenticação
          </p>
        </div>
        <Switch
          checked={formData.is_public}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_public: checked }))}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {playlist?.id ? 'Salvar' : 'Criar Playlist'}
        </Button>
      </div>
    </form>
  );
}
