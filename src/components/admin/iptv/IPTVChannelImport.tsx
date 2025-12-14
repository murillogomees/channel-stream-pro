/**
 * IPTV Channel Import Component
 * Import channels from M3U file or URL - saves directly to iptv_channels
 * With real-time progress via SSE
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseConfig, getFunctionUrl } from '@/integrations/supabase/client';
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
      // Get the Supabase session
      console.log('[IPTVChannelImport] Getting session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('[IPTVChannelImport] Session error:', sessionError);
        throw new Error('Erro de autenticação: ' + sessionError.message);
      }
      
      const functionUrl = getFunctionUrl('fetch-m3u');
      console.log('[IPTVChannelImport] Calling edge function:', functionUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[IPTVChannelImport] Request timeout after 5min');
        controller.abort();
      }, 300000); // 5 min timeout

      const requestBody = JSON.stringify({ ...payload, stream: true });
      console.log('[IPTVChannelImport] Request body length:', requestBody.length);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || supabaseConfig.anonKey}`,
          'apikey': supabaseConfig.anonKey,
        },
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('[IPTVChannelImport] Response received:', response.status, response.headers.get('content-type'));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Não foi possível ler a resposta');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'start') {
                setProgressState(prev => ({
                  ...prev,
                  status: 'importing',
                  total: data.total,
                  message: `Importando ${data.total.toLocaleString()} canais...`,
                }));
              } else if (data.type === 'progress') {
                setProgressState(prev => ({
                  ...prev,
                  processed: data.processed,
                  inserted: data.inserted,
                  skipped: data.skipped,
                  progress: data.progress,
                  message: `${data.processed.toLocaleString()} de ${data.total.toLocaleString()} (${data.progress}%)`,
                }));
              } else if (data.type === 'complete') {
                setProgressState({
                  status: 'complete',
                  total: data.total,
                  processed: data.total,
                  inserted: data.inserted,
                  skipped: data.skipped,
                  progress: 100,
                  message: data.message,
                });
                toast.success(data.message);
                queryClient.invalidateQueries({ queryKey: ['iptv-channels'] });
                queryClient.invalidateQueries({ queryKey: ['iptv-stats'] });
                if (payload.url) setM3uUrl('');
                if (payload.content) setM3uContent('');
                onSuccess();
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      setProgressState(prev => ({
        ...prev,
        status: 'error',
        error: message,
        message: `Erro: ${message}`,
      }));
      toast.error(`Erro: ${message}`);
    }
  }, [queryClient, onSuccess]);

  const isLoading = progressState.status === 'fetching' || progressState.status === 'importing';

  const handleReset = () => {
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
