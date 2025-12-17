/**
 * IPTV Channel Import Component
 * Import channels from M3U file or URL - saves directly to iptv_channels
 * With real-time progress via SSE
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseConfig } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, Upload, Link, FileText, CheckCircle, XCircle } from 'lucide-react';

interface ProgressState {
  status: 'idle' | 'fetching' | 'importing' | 'complete' | 'error';
  total: number;
  processed: number;
  inserted: number;
  skipped: number;
  progress: number;
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
  const [progressState, setProgressState] = useState<ProgressState>({
    status: 'idle',
    total: 0,
    processed: 0,
    inserted: 0,
    skipped: 0,
    progress: 0,
  });
  
  // Ref to track the current abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Cleanup on unmount - abort any running import
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        console.log('[IPTVChannelImport] Cleanup: aborting active import');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const importWithProgress = useCallback(async (payload: { url?: string; content?: string }) => {
    console.log('[IPTVChannelImport] Starting import with payload:', { url: payload.url, hasContent: !!payload.content });
    
    if (!payload.url && !payload.content) {
      console.error('[IPTVChannelImport] No URL or content provided');
      toast.error('Forneça uma URL ou conteúdo M3U');
      return;
    }
    
    setProgressState({
      status: 'fetching',
      total: 0,
      processed: 0,
      inserted: 0,
      skipped: 0,
      progress: 0,
      message: 'Conectando ao servidor e buscando M3U (pode demorar alguns minutos para arquivos grandes)...',
    });

    try {
      // Cancel any existing import before starting new one
      if (abortControllerRef.current) {
        console.log('[IPTVChannelImport] Aborting previous import');
        abortControllerRef.current.abort();
      }
      
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      const timeoutId = setTimeout(() => {
        console.log('[IPTVChannelImport] Request timeout after 5min');
        controller.abort();
      }, 300000); // 5 min timeout

      console.log('[IPTVChannelImport] Invoking edge function via SDK...');

      // Use supabase.functions.invoke for better CORS handling
      const { data, error } = await supabase.functions.invoke('fetch-m3u', {
        body: { ...payload, stream: false }, // Non-streaming mode via SDK
      });

      clearTimeout(timeoutId);
      
      // Check if aborted before processing
      if (controller.signal.aborted) {
        console.log('[IPTVChannelImport] Import was aborted, skipping processing');
        return;
      }

      if (error) {
        throw new Error(error.message || 'Erro ao chamar função de importação');
      }

      console.log('[IPTVChannelImport] Response received:', data);

      // Handle non-streaming response
      if (data?.success) {
        setProgressState({
          status: 'complete',
          total: data.total || 0,
          processed: data.total || 0,
          inserted: data.inserted || 0,
          skipped: data.skipped || 0,
          progress: 100,
          message: `Concluído! ${(data.inserted || 0).toLocaleString()} canais importados`,
        });
        toast.success(`Importados ${(data.inserted || 0).toLocaleString()} canais`);
        queryClient.invalidateQueries({ queryKey: ['iptv-channels'] });
        queryClient.invalidateQueries({ queryKey: ['iptv-stats'] });
        if (payload.url) setM3uUrl('');
        if (payload.content) setM3uContent('');
        onSuccess();
        return;
      } else {
        throw new Error(data?.error || 'Erro desconhecido na importação');
      }
    } catch (error) {
      // Don't show error if it was an intentional abort
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[IPTVChannelImport] Import cancelled by user/cleanup');
        return;
      }
      
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      const friendlyMessage = message === 'Failed to fetch'
        ? `Falha de conexão com o backend (${supabaseConfig.url || 'URL não configurada'}). Verifique se o backend está conectado e tente novamente.`
        : message;

      setProgressState(prev => ({
        ...prev,
        status: 'error',
        error: friendlyMessage,
        message: `Erro: ${friendlyMessage}`,
      }));
      toast.error(`Erro: ${friendlyMessage}`);
    } finally {
      // Clear ref when done
      if (abortControllerRef.current?.signal.aborted === false) {
        abortControllerRef.current = null;
      }
    }
  }, [queryClient, onSuccess]);

  const isLoading = progressState.status === 'fetching' || progressState.status === 'importing';

  const handleReset = () => {
    // Abort any running import
    if (abortControllerRef.current) {
      console.log('[IPTVChannelImport] Reset: aborting active import');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setProgressState({
      status: 'idle',
      total: 0,
      processed: 0,
      inserted: 0,
      skipped: 0,
      progress: 0,
    });
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="url">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="url" disabled={isLoading}>
            <Link className="h-4 w-4 mr-2" />
            URL
          </TabsTrigger>
          <TabsTrigger value="paste" disabled={isLoading}>
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
                onClick={() => importWithProgress({ url: m3uUrl })}
                disabled={!m3uUrl.trim() || isLoading}
              >
                {isLoading ? (
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
              Suporta HTTP/HTTPS. Portas Xtream comuns usam HTTP automaticamente.
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
            <Button 
              onClick={() => importWithProgress({ content: m3uContent })}
              disabled={!m3uContent.trim() || isLoading}
              className="w-full"
            >
              {isLoading ? (
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

      {/* Progress Section */}
      {progressState.status !== 'idle' && (
        <div className={`p-4 rounded-lg border ${
          progressState.status === 'complete' ? 'bg-green-500/10 border-green-500/20' :
          progressState.status === 'error' ? 'bg-red-500/10 border-red-500/20' :
          'bg-muted/50 border-border'
        }`}>
          {/* Progress Bar */}
          {(progressState.status === 'importing' || progressState.status === 'fetching') && (
            <div className="space-y-2 mb-3">
              <Progress value={progressState.progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progressState.processed.toLocaleString()} / {progressState.total.toLocaleString()}</span>
                <span>{progressState.progress}%</span>
              </div>
            </div>
          )}

          {/* Status Icon and Message */}
          <div className="flex items-center gap-2">
            {progressState.status === 'complete' && (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            {progressState.status === 'error' && (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            {isLoading && (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            <span className={`font-medium ${
              progressState.status === 'complete' ? 'text-green-600 dark:text-green-400' :
              progressState.status === 'error' ? 'text-red-600 dark:text-red-400' :
              'text-foreground'
            }`}>
              {progressState.message}
            </span>
          </div>

          {/* Stats */}
          {(progressState.status === 'complete' || progressState.status === 'importing') && (
            <div className="mt-2 text-sm text-muted-foreground grid grid-cols-2 gap-2">
              <div>Inseridos: <span className="font-medium text-foreground">{progressState.inserted.toLocaleString()}</span></div>
              <div>Duplicados: <span className="font-medium text-foreground">{progressState.skipped.toLocaleString()}</span></div>
            </div>
          )}

          {/* Reset Button */}
          {(progressState.status === 'complete' || progressState.status === 'error') && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleReset}
              className="mt-3"
            >
              Nova Importação
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
