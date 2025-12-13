/**
 * IPTV Channel Import Component
 * Import channels from M3U file or URL - saves directly to iptv_channels
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Upload, Link, FileText, CheckCircle } from 'lucide-react';

interface ImportResult {
  success: boolean;
  inserted?: number;
  skipped?: number;
  total?: number;
  limited?: boolean;
  message?: string;
  error?: string;
}

interface IPTVChannelImportProps {
  onSuccess: () => void;
}

export function IPTVChannelImport({ onSuccess }: IPTVChannelImportProps) {
  const queryClient = useQueryClient();
  const [m3uUrl, setM3uUrl] = useState('');
  const [m3uContent, setM3uContent] = useState('');
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  // Import via URL - saves directly to iptv_channels
  const importUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const { data, error } = await supabase.functions.invoke<ImportResult>('fetch-m3u', {
        body: { url }
      });

      if (error) throw new Error(error.message || 'Erro ao importar M3U');
      if (data?.error) throw new Error(data.error);
      if (!data?.success) throw new Error('Falha na importação');
      
      return data;
    },
    onSuccess: (data) => {
      setLastResult(data);
      toast.success(data.message || `Importados ${data.inserted} canais`);
      setM3uUrl('');
      queryClient.invalidateQueries({ queryKey: ['iptv-channels'] });
      queryClient.invalidateQueries({ queryKey: ['iptv-stats'] });
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Import via pasted content - saves directly to iptv_channels
  const importContentMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase.functions.invoke<ImportResult>('fetch-m3u', {
        body: { content }
      });

      if (error) throw new Error(error.message || 'Erro ao importar M3U');
      if (data?.error) throw new Error(data.error);
      if (!data?.success) throw new Error('Falha na importação');
      
      return data;
    },
    onSuccess: (data) => {
      setLastResult(data);
      toast.success(data.message || `Importados ${data.inserted} canais`);
      setM3uContent('');
      queryClient.invalidateQueries({ queryKey: ['iptv-channels'] });
      queryClient.invalidateQueries({ queryKey: ['iptv-stats'] });
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const isLoading = importUrlMutation.isPending || importContentMutation.isPending;

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
                placeholder="http://exemplo.com/playlist.m3u"
                disabled={isLoading}
              />
              <Button 
                onClick={() => importUrlMutation.mutate(m3uUrl)}
                disabled={!m3uUrl.trim() || isLoading}
              >
                {importUrlMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Suporta HTTP/HTTPS. Portas Xtream comuns (8880, 8000, etc.) usam HTTP automaticamente.
            </p>
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
              disabled={isLoading}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Cole o conteúdo completo do arquivo M3U. Útil quando o servidor bloqueia requisições diretas.
            </p>
            <Button 
              onClick={() => importContentMutation.mutate(m3uContent)}
              disabled={!m3uContent.trim() || isLoading}
            >
              {importContentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Conteúdo
                </>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Import Result */}
      {lastResult && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Importação concluída!</span>
          </div>
          <div className="mt-2 text-sm text-muted-foreground space-y-1">
            <p>Inseridos: {lastResult.inserted}</p>
            {lastResult.skipped && lastResult.skipped > 0 && (
              <p>Duplicados ignorados: {lastResult.skipped}</p>
            )}
            {lastResult.limited && (
              <p className="text-amber-600">Limitado a 50.000 canais por importação</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
