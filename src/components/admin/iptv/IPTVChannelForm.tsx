/**
 * IPTV Channel Form Component
 * Create/Edit channel with validation
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Channel {
  id?: number;
  slug: string;
  name: string;
  original_url: string;
  logo_url: string | null;
  category: string | null;
  content_type: string;
  is_healthy?: boolean;
  priority?: number;
}

interface IPTVChannelFormProps {
  channel?: Channel | null;
  onSuccess: () => void;
}

export function IPTVChannelForm({ channel, onSuccess }: IPTVChannelFormProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    slug: channel?.slug || '',
    name: channel?.name || '',
    original_url: channel?.original_url || '',
    logo_url: channel?.logo_url || '',
    category: channel?.category || '',
    content_type: channel?.content_type || 'live',
    priority: channel?.priority || 0,
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Generate slug if empty
      const slug = data.slug || data.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const payload = {
        ...data,
        slug,
        logo_url: data.logo_url || null,
        category: data.category || null,
      };

      if (channel?.id) {
        const { error } = await supabase
          .from('iptv_channels')
          .update(payload)
          .eq('id', channel.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('iptv_channels')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(channel?.id ? 'Canal atualizado!' : 'Canal criado!');
      queryClient.invalidateQueries({ queryKey: ['iptv-channels'] });
      queryClient.invalidateQueries({ queryKey: ['iptv-stats'] });
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
    if (!formData.original_url.trim()) {
      toast.error('URL é obrigatória');
      return;
    }

    mutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Globo HD"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug (auto-gerado se vazio)</Label>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
            placeholder="Ex: globo-hd"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="original_url">URL do Stream *</Label>
        <Input
          id="original_url"
          value={formData.original_url}
          onChange={(e) => setFormData(prev => ({ ...prev, original_url: e.target.value }))}
          placeholder="http://... ou https://..."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="logo_url">URL do Logo</Label>
          <Input
            id="logo_url"
            value={formData.logo_url}
            onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoria</Label>
          <Input
            id="category"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            placeholder="Ex: Esportes, Filmes, etc."
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="content_type">Tipo de Conteúdo</Label>
          <Select
            value={formData.content_type}
            onValueChange={(value) => setFormData(prev => ({ ...prev, content_type: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="vod">VOD</SelectItem>
              <SelectItem value="series">Séries</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Prioridade</Label>
          <Input
            id="priority"
            type="number"
            value={formData.priority}
            onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
            placeholder="0"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {channel?.id ? 'Salvar' : 'Criar Canal'}
        </Button>
      </div>
    </form>
  );
}
