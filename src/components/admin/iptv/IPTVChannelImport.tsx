/**
 * IPTV Channel Import Component
 * Import channels from M3U file or URL
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, Upload, Link, FileText } from 'lucide-react';

interface ParsedChannel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
}

interface IPTVChannelImportProps {
  onSuccess: () => void;
}

export function IPTVChannelImport({ onSuccess }: IPTVChannelImportProps) {
  const queryClient = useQueryClient();
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
        // Parse EXTINF line
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
        // This is the URL line
        currentChannel.url = line;
        channels.push(currentChannel as ParsedChannel);
        currentChannel = {};
      }
    }

    return channels;
  };

  // Fetch and parse M3U from URL (via Edge Function to evitar Mixed Content)
  const fetchMutation = useMutation({
    mutationFn: async (url: string) => {
      setIsParsing(true);

      const { data, error } = await supabase.functions.invoke('fetch-m3u', {
        body: { url },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao buscar M3U');
      }

      const content = (data as { content?: string } | null)?.content;
      if (!content) {
        throw new Error('Resposta inválida do servidor');
      }

      return parseM3U(content);
    },
    onSuccess: (channels) => {
      setParsedChannels(channels);
      toast.success(`${channels.length} canais encontrados`);
      setIsParsing(false);
    },
    onError: (error) => {
      toast.error(`Erro ao buscar M3U: ${error.message}`);
      setIsParsing(false);
    },
  });

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

  // Import channels to database via Edge Function (bypasses RLS)
  const importMutation = useMutation({
    mutationFn: async (channels: ParsedChannel[]) => {
      // Convert parsed channels to M3U format for the edge function
      let m3uContent = '#EXTM3U\n';
      for (const ch of channels) {
        const logo = ch.logo ? ` tvg-logo="${ch.logo}"` : '';
        const group = ch.group ? ` group-title="${ch.group}"` : '';
        const tvgId = ch.tvgId ? ` tvg-id="${ch.tvgId}"` : '';
        m3uContent += `#EXTINF:-1${tvgId}${logo}${group},${ch.name}\n${ch.url}\n`;
      }

      const { data, error } = await supabase.functions.invoke('process-m3u-import', {
        body: {
          content: m3uContent,
          sessionId: `import-${Date.now()}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao importar canais');
      }

      const result = data as { success?: boolean; error?: string; data?: { inserted?: number } } | null;
      if (!result?.success) {
        throw new Error(result?.error || 'Erro desconhecido');
      }

      return result.data?.inserted || channels.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} canais importados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['iptv-channels'] });
      queryClient.invalidateQueries({ queryKey: ['iptv-stats'] });
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Erro na importação: ${error.message}`);
    },
  });

  return (
    <div className="space-y-4">
      <Tabs defaultValue="url">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="url">
            <Link className="h-4 w-4 mr-2" />
            URL
          </TabsTrigger>
          <TabsTrigger value="paste">
            <FileText className="h-4 w-4 mr-2" />
            Colar M3U
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="space-y-4">
          <div className="space-y-2">
            <Label>URL do arquivo M3U</Label>
            <div className="flex gap-2">
              <Input
                value={m3uUrl}
                onChange={(e) => setM3uUrl(e.target.value)}
                placeholder="https://example.com/playlist.m3u"
              />
              <Button 
                onClick={() => fetchMutation.mutate(m3uUrl)}
                disabled={!m3uUrl || isParsing}
              >
                {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="paste" className="space-y-4">
          <div className="space-y-2">
            <Label>Conteúdo M3U</Label>
            <Textarea
              value={m3uContent}
              onChange={(e) => setM3uContent(e.target.value)}
              placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-logo=&quot;...&quot; group-title=&quot;...&quot;,Channel Name&#10;http://..."
              rows={8}
            />
            <Button onClick={handleParseContent} disabled={!m3uContent}>
              Analisar
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Parsed Results */}
      {parsedChannels.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{parsedChannels.length} canais encontrados</p>
              <p className="text-sm text-muted-foreground">
                Categorias: {[...new Set(parsedChannels.map(c => c.group).filter(Boolean))].length}
              </p>
            </div>
            <Button
              onClick={() => importMutation.mutate(parsedChannels)}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Todos
                </>
              )}
            </Button>
          </div>

          {importMutation.isPending && (
            <div className="space-y-2">
              <Progress value={importProgress} />
              <p className="text-sm text-center text-muted-foreground">{importProgress}%</p>
            </div>
          )}

          {/* Preview */}
          <div className="max-h-[200px] overflow-y-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="text-left p-2">Nome</th>
                  <th className="text-left p-2">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {parsedChannels.slice(0, 50).map((ch, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2 truncate max-w-[200px]">{ch.name}</td>
                    <td className="p-2 truncate max-w-[100px]">{ch.group || '-'}</td>
                  </tr>
                ))}
                {parsedChannels.length > 50 && (
                  <tr>
                    <td colSpan={2} className="p-2 text-center text-muted-foreground">
                      ... e mais {parsedChannels.length - 50} canais
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
