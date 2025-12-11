/**
 * IPTV Playlist Form Component
 * Create/Edit playlist with M3U URL import
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Link, FileText, Upload, CheckCircle2 } from 'lucide-react';

interface ParsedChannel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
}

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
  
  // M3U Import state
  const [m3uUrl, setM3uUrl] = useState('');
  const [m3uContent, setM3uContent] = useState('');
  const [parsedChannels, setParsedChannels] = useState<ParsedChannel[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);

  // Parse M3U content
  const parseM3U = (content: string): ParsedChannel[] => {
    const lines = content.split('\n');
    const channels: ParsedChannel[] = [];
    let currentChannel: Partial<ParsedChannel> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXTINF:')) {
        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        const groupMatch = line.match(/group-title="([^"]+)"/);
        const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
        const nameMatch = line.match(/,(.+)$/);

        currentChannel = {
          logo: logoMatch?.[1],
          group: groupMatch?.[1],
          tvgId: tvgIdMatch?.[1],
          name: nameMatch?.[1]?.trim() || 'Unknown',
        };
      } else if (line && !line.startsWith('#') && currentChannel.name) {
        currentChannel.url = line;
        channels.push(currentChannel as ParsedChannel);
        currentChannel = {};
      }
    }

    return channels;
  };

  // Fetch M3U from URL
  const fetchM3U = async () => {
    if (!m3uUrl.trim()) {
      toast.error('Insira uma URL M3U');
      return;
    }

    setIsParsing(true);
    try {
      const response = await fetch(m3uUrl);
      if (!response.ok) throw new Error('Falha ao buscar M3U');
      const content = await response.text();
      const channels = parseM3U(content);
      setParsedChannels(channels);
      toast.success(`${channels.length} canais encontrados`);
      
      // Auto-fill name if empty
      if (!formData.name && channels.length > 0) {
        const urlObj = new URL(m3uUrl);
        const suggestedName = urlObj.pathname.split('/').pop()?.replace(/\.(m3u8?|txt)$/i, '') || 'Playlist Importada';
        setFormData(prev => ({ ...prev, name: suggestedName }));
      }
    } catch (error) {
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Falha ao buscar M3U'}`);
    } finally {
      setIsParsing(false);
    }
  };

  // Parse pasted content
  const handleParseContent = () => {
    if (!m3uContent.trim()) {
      toast.error('Cole o conteúdo M3U');
      return;
    }
    const channels = parseM3U(m3uContent);
    setParsedChannels(channels);
    toast.success(`${channels.length} canais encontrados`);
  };

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const slug = data.slug || data.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const payload = {
        name: data.name,
        slug,
        description: data.description || null,
        is_public: data.is_public,
        user_id: user?.id,
        channel_count: parsedChannels.length,
      };

      let playlistId: number;

      if (playlist?.id) {
        const { error } = await supabase
          .from('iptv_playlists')
          .update(payload)
          .eq('id', playlist.id);
        if (error) throw error;
        playlistId = playlist.id;
      } else {
        const { data: newPlaylist, error } = await supabase
          .from('iptv_playlists')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        playlistId = newPlaylist.id;
      }

      // Import channels if we have parsed channels
      if (parsedChannels.length > 0) {
        // First, insert channels to iptv_channels table
        const batchSize = 100;
        const channelIds: number[] = [];

        for (let i = 0; i < parsedChannels.length; i += batchSize) {
          const batch = parsedChannels.slice(i, i + batchSize);
          
          const channelPayload = batch.map((ch, idx) => ({
            name: ch.name,
            slug: `${ch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now()}-${i + idx}`,
            original_url: ch.url,
            logo_url: ch.logo || null,
            category: ch.group || null,
            content_type: 'live',
          }));

          const { data: insertedChannels, error } = await supabase
            .from('iptv_channels')
            .insert(channelPayload)
            .select('id');

          if (error) {
            console.error('Channel insert error:', error);
          } else if (insertedChannels) {
            channelIds.push(...insertedChannels.map(c => c.id));
          }

          setImportProgress(Math.round(((i + batch.length) / parsedChannels.length) * 50));
        }

        // Now link channels to playlist
        if (channelIds.length > 0) {
          const playlistChannels = channelIds.map((channelId, idx) => ({
            playlist_id: playlistId,
            channel_id: channelId,
            position: idx,
          }));

          for (let i = 0; i < playlistChannels.length; i += batchSize) {
            const batch = playlistChannels.slice(i, i + batchSize);
            
            const { error } = await supabase
              .from('iptv_playlist_channels')
              .insert(batch);

            if (error) {
              console.error('Playlist channel link error:', error);
            }

            setImportProgress(50 + Math.round(((i + batch.length) / playlistChannels.length) * 50));
          }
        }

        // Update channel count
        await supabase
          .from('iptv_playlists')
          .update({ channel_count: channelIds.length })
          .eq('id', playlistId);
      }

      return playlistId;
    },
    onSuccess: () => {
      toast.success(playlist?.id ? 'Playlist atualizada!' : 'Playlist criada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['iptv-playlists'] });
      queryClient.invalidateQueries({ queryKey: ['iptv-playlist-stats'] });
      queryClient.invalidateQueries({ queryKey: ['iptv-channels'] });
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
          rows={2}
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
        />
      </div>

      {/* M3U Import Section */}
      {!playlist?.id && (
        <div className="border-t pt-4 space-y-3">
          <Label className="text-base font-medium">Importar Canais (Opcional)</Label>
          
          <Tabs defaultValue="url" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="url" className="text-xs">
                <Link className="h-3 w-3 mr-1" />
                URL M3U
              </TabsTrigger>
              <TabsTrigger value="paste" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                Colar M3U
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-2 mt-2">
              <div className="flex gap-2">
                <Input
                  value={m3uUrl}
                  onChange={(e) => setM3uUrl(e.target.value)}
                  placeholder="https://exemplo.com/playlist.m3u"
                  className="text-sm"
                />
                <Button 
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchM3U}
                  disabled={!m3uUrl || isParsing}
                >
                  {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="paste" className="space-y-2 mt-2">
              <Textarea
                value={m3uContent}
                onChange={(e) => setM3uContent(e.target.value)}
                placeholder="#EXTM3U&#10;#EXTINF:-1,Canal 1&#10;http://..."
                rows={4}
                className="text-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleParseContent} disabled={!m3uContent}>
                Analisar
              </Button>
            </TabsContent>
          </Tabs>

          {/* Parsed Results */}
          {parsedChannels.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{parsedChannels.length} canais prontos para importar</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Categorias: {[...new Set(parsedChannels.map(c => c.group).filter(Boolean))].length}
              </p>
              <div className="max-h-24 overflow-y-auto text-xs text-muted-foreground border rounded p-2 bg-background">
                {parsedChannels.slice(0, 5).map((ch, idx) => (
                  <div key={idx} className="truncate">{ch.name}</div>
                ))}
                {parsedChannels.length > 5 && (
                  <div className="text-center mt-1">... +{parsedChannels.length - 5} mais</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      {mutation.isPending && parsedChannels.length > 0 && (
        <div className="space-y-2">
          <Progress value={importProgress} />
          <p className="text-xs text-center text-muted-foreground">Importando... {importProgress}%</p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {parsedChannels.length > 0 ? (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Criar e Importar {parsedChannels.length} Canais
            </>
          ) : (
            playlist?.id ? 'Salvar' : 'Criar Playlist'
          )}
        </Button>
      </div>
    </form>
  );
}