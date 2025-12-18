/**
 * IPTV Channel Import Component
 * Import channels from M3U file or URL - saves directly to iptv_channels
 * With real-time progress via SSE and detailed logging
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, Upload, Link, FileText, CheckCircle, XCircle, Terminal, Clock, AlertTriangle } from 'lucide-react';

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

interface LogEntry {
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'warn';
  message: string;
}

interface IPTVChannelImportProps {
  onSuccess: () => void;
}

export function IPTVChannelImport({ onSuccess }: IPTVChannelImportProps) {
  const queryClient = useQueryClient();
  const [m3uUrl, setM3uUrl] = useState('');
  const [m3uContent, setM3uContent] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [progressState, setProgressState] = useState<ProgressState>({
    status: 'idle',
    total: 0,
    processed: 0,
    inserted: 0,
    skipped: 0,
    progress: 0,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { timestamp: new Date(), type, message }]);
  }, []);

  const startTimer = useCallback(() => {
    setElapsedTime(0);
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [stopTimer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const importWithProgress = useCallback(async (payload: { url?: string; content?: string }) => {
    if (!payload.url && !payload.content) {
      toast.error('Forneça uma URL ou conteúdo M3U');
      return;
    }
    
    // Reset logs and start timer
    setLogs([]);
    setShowLogs(true);
    startTimer();

    const endpoint = `${supabaseConfig.url}/functions/v1/fetch-m3u`;
    addLog('info', `🚀 Iniciando importação M3U`);
    addLog('info', `📡 Endpoint: ${endpoint}`);
    if (payload.url) {
      addLog('info', `🔗 URL M3U: ${payload.url.substring(0, 60)}...`);
    }
    if (payload.content) {
      addLog('info', `📄 Conteúdo M3U: ${payload.content.length.toLocaleString()} caracteres`);
    }

    setProgressState({
      status: 'fetching',
      total: 0,
      processed: 0,
      inserted: 0,
      skipped: 0,
      progress: 0,
      message: 'Conectando ao servidor...',
    });

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      const controller = new AbortController();
      abortControllerRef.current = controller;

      addLog('info', `⏱️ Timeout configurado: 30 minutos`);
      addLog('info', `🔄 Modo: Streaming (SSE)`);

      const timeoutId = setTimeout(() => {
        addLog('error', '⏱️ Timeout atingido (30 min)');
        controller.abort();
      }, 1800000); // 30 min

      // Use direct fetch with SSE for better progress tracking
      const fetchUrl = `${supabaseConfig.url}/functions/v1/fetch-m3u`;
      addLog('info', `📤 Enviando requisição para Edge Function...`);

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'apikey': supabaseConfig.anonKey,
        },
        body: JSON.stringify({ ...payload, stream: true }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      addLog('info', `📥 Resposta recebida: HTTP ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        addLog('error', `❌ Erro HTTP: ${response.status} - ${errorText.substring(0, 200)}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Check if SSE response
      const contentType = response.headers.get('content-type') || '';
      addLog('info', `📋 Content-Type: ${contentType}`);

      if (contentType.includes('text/event-stream')) {
        addLog('success', `✅ Streaming SSE iniciado`);
        setProgressState(prev => ({
          ...prev,
          status: 'importing',
          message: 'Processando stream...',
        }));

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'progress') {
                  setProgressState({
                    status: 'importing',
                    total: data.total || 0,
                    processed: data.processed || 0,
                    inserted: data.inserted || 0,
                    skipped: data.skipped || 0,
                    progress: data.total > 0 ? Math.round((data.processed / data.total) * 100) : 0,
                    message: data.message || 'Processando...',
                  });
                } else if (data.type === 'complete') {
                  addLog('success', `✅ Importação concluída: ${data.inserted} inseridos, ${data.skipped} duplicados`);
                  stopTimer();
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
                } else if (data.type === 'error') {
                  addLog('error', `❌ Erro no stream: ${data.error}`);
                  throw new Error(data.error);
                } else if (data.type === 'start') {
                  addLog('info', `📊 Total estimado: ${data.total || 'calculando...'}`);
                }
              } catch (e) {
                // Ignore JSON parse errors for partial data
              }
            }
          }
        }
      } else {
        // JSON response
        addLog('info', `📄 Resposta JSON recebida`);
        const data = await response.json();

        if (data.success) {
          addLog('success', `✅ Importação concluída: ${data.inserted} inseridos`);
          stopTimer();
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
        } else {
          throw new Error(data.error || 'Erro desconhecido');
        }
      }
    } catch (error) {
      stopTimer();
      
       if (error instanceof Error && error.name === 'AbortError') {
         const reason = 'Timeout/cancelamento da importação';
         addLog('warn', `⚠️ ${reason}`);
         setProgressState(prev => ({
           ...prev,
           status: 'error',
           error: reason,
           message: `Erro: ${reason}`,
         }));
         toast.error(reason);
         return;
       }
      
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      
      // Detailed error logging
      if (message === 'Failed to fetch') {
        addLog('error', `❌ Falha de conexão com Edge Function`);
        addLog('error', `📡 URL: ${supabaseConfig.url}/functions/v1/fetch-m3u`);
        addLog('error', `💡 Possíveis causas:`);
        addLog('error', `   • CPU Time exceeded (arquivo muito grande)`);
        addLog('error', `   • Timeout da Edge Function`);
        addLog('error', `   • Conexão de rede instável`);
        addLog('error', `   • CORS bloqueado`);
      } else {
        addLog('error', `❌ Erro: ${message}`);
      }

      const friendlyMessage = message === 'Failed to fetch'
        ? 'Falha de conexão com a Edge Function. O arquivo M3U pode ser muito grande ou o servidor atingiu timeout. Verifique os logs detalhados.'
        : message;

      setProgressState(prev => ({
        ...prev,
        status: 'error',
        error: friendlyMessage,
        message: `Erro: ${friendlyMessage}`,
      }));
      toast.error(`Erro: ${friendlyMessage}`);
    } finally {
      if (abortControllerRef.current?.signal.aborted === false) {
        abortControllerRef.current = null;
      }
    }
  }, [queryClient, onSuccess, addLog, startTimer, stopTimer]);

  const isLoading = progressState.status === 'fetching' || progressState.status === 'importing';

  const handleReset = () => {
    stopTimer();
    if (abortControllerRef.current) {
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
    setLogs([]);
    setShowLogs(false);
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
          {/* Timer */}
          {isLoading && (
            <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Tempo decorrido: {formatTime(elapsedTime)}</span>
            </div>
          )}

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

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            {(progressState.status === 'complete' || progressState.status === 'error') && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Nova Importação
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowLogs(!showLogs)}
            >
              <Terminal className="h-4 w-4 mr-2" />
              {showLogs ? 'Ocultar Logs' : 'Ver Logs'}
            </Button>
          </div>
        </div>
      )}

      {/* Detailed Logs Panel */}
      {showLogs && logs.length > 0 && (
        <div className="border rounded-lg bg-muted/30">
          <div className="px-3 py-2 border-b bg-muted/50 flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <span className="font-medium text-sm">Logs Detalhados</span>
            <span className="text-xs text-muted-foreground ml-auto">{logs.length} entradas</span>
          </div>
          <ScrollArea className="h-48">
            <div className="p-2 font-mono text-xs space-y-1">
              {logs.map((log, i) => (
                <div 
                  key={i} 
                  className={`flex gap-2 ${
                    log.type === 'error' ? 'text-red-500' :
                    log.type === 'success' ? 'text-green-500' :
                    log.type === 'warn' ? 'text-yellow-500' :
                    'text-muted-foreground'
                  }`}
                >
                  <span className="text-muted-foreground shrink-0">
                    [{log.timestamp.toLocaleTimeString()}]
                  </span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Warning for large files */}
      {progressState.status === 'idle' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Arquivos grandes:</span> Para listas M3U com mais de 50.000 canais, 
            a importação pode levar vários minutos. Use modo streaming para melhor performance.
          </div>
        </div>
      )}
    </div>
  );
}
