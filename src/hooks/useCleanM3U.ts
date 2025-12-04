import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface CleanM3UOptions {
  skipProbe?: boolean;
  maxChannels?: number;
  probeTimeoutMs?: number;
  concurrency?: number;
  save?: boolean;
  retentionDays?: number;
}

export interface QuarantinedChannel {
  url: string;
  title: string;
  reason: 'probe-failed' | 'invalid-url' | 'unsupported-protocol' | 'duplicate' | 'parse-error';
  details?: string;
}

export interface CleanM3UStats {
  inChannels: number;
  uniqueChannels: number;
  cleanedChannels: number;
  quarantinedCount: number;
  quarantined: QuarantinedChannel[];
  generatedAt: string;
  processingTimeMs: number;
}

export interface CleanM3UResult {
  cleaned: string;
  stats: CleanM3UStats;
  storageUrl?: string;
  playlistId?: string;
}

export interface CleaningProgress {
  phase: 'idle' | 'uploading' | 'processing' | 'probing' | 'saving' | 'done' | 'error';
  percent: number;
  message: string;
}

const DEFAULT_OPTIONS: CleanM3UOptions = {
  skipProbe: false,
  maxChannels: 2000,
  probeTimeoutMs: 4000,
  concurrency: 10,
  save: false,
  retentionDays: 30,
};

export function useCleanM3U() {
  const [isCleaning, setIsCleaning] = useState(false);
  const [progress, setProgress] = useState<CleaningProgress>({
    phase: 'idle',
    percent: 0,
    message: '',
  });
  const [lastResult, setLastResult] = useState<CleanM3UResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setProgress({ phase: 'idle', percent: 0, message: '' });
    setLastResult(null);
    setError(null);
  }, []);

  const buildQueryParams = (options: CleanM3UOptions) => {
    const params = new URLSearchParams();
    if (options.skipProbe) params.set('skipProbe', 'true');
    if (options.maxChannels) params.set('maxChannels', options.maxChannels.toString());
    if (options.probeTimeoutMs) params.set('probeTimeoutMs', options.probeTimeoutMs.toString());
    if (options.concurrency) params.set('concurrency', options.concurrency.toString());
    if (options.save) params.set('save', 'true');
    if (options.retentionDays) params.set('retentionDays', options.retentionDays.toString());
    return params.toString();
  };

  const cleanFromUrl = useCallback(async (
    url: string,
    options: CleanM3UOptions = {}
  ): Promise<CleanM3UResult | null> => {
    setIsCleaning(true);
    setError(null);
    setProgress({ phase: 'uploading', percent: 10, message: 'Conectando ao servidor...' });

    try {
      const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
      const queryParams = buildQueryParams(mergedOptions);

      setProgress({ phase: 'processing', percent: 30, message: 'Processando playlist...' });

      const { data, error: fnError } = await supabase.functions.invoke(`clean-m3u?${queryParams}`, {
        body: { url },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data || !data.cleaned) throw new Error('Resposta inválida do servidor');

      setProgress({ phase: 'done', percent: 100, message: 'Limpeza concluída!' });
      setLastResult(data);

      toast({
        title: 'Playlist limpa com sucesso',
        description: `${data.stats.cleanedChannels} canais válidos de ${data.stats.inChannels} totais`,
      });

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      setProgress({ phase: 'error', percent: 0, message });
      toast({
        title: 'Erro ao limpar playlist',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsCleaning(false);
    }
  }, []);

  const cleanFromContent = useCallback(async (
    m3u: string,
    options: CleanM3UOptions = {}
  ): Promise<CleanM3UResult | null> => {
    setIsCleaning(true);
    setError(null);
    setProgress({ phase: 'uploading', percent: 10, message: 'Enviando conteúdo...' });

    try {
      const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
      const queryParams = buildQueryParams(mergedOptions);

      setProgress({ phase: 'processing', percent: 30, message: 'Processando playlist...' });

      const { data, error: fnError } = await supabase.functions.invoke(`clean-m3u?${queryParams}`, {
        body: { m3u },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data || !data.cleaned) throw new Error('Resposta inválida do servidor');

      setProgress({ phase: 'done', percent: 100, message: 'Limpeza concluída!' });
      setLastResult(data);

      toast({
        title: 'Playlist limpa com sucesso',
        description: `${data.stats.cleanedChannels} canais válidos de ${data.stats.inChannels} totais`,
      });

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      setProgress({ phase: 'error', percent: 0, message });
      toast({
        title: 'Erro ao limpar playlist',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsCleaning(false);
    }
  }, []);

  const cleanFromFile = useCallback(async (
    file: File,
    options: CleanM3UOptions = {}
  ): Promise<CleanM3UResult | null> => {
    setIsCleaning(true);
    setError(null);
    setProgress({ phase: 'uploading', percent: 10, message: 'Lendo arquivo...' });

    try {
      const content = await file.text();
      setProgress({ phase: 'uploading', percent: 20, message: 'Enviando arquivo...' });
      
      return await cleanFromContent(content, options);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao ler arquivo';
      setError(message);
      setProgress({ phase: 'error', percent: 0, message });
      toast({
        title: 'Erro ao ler arquivo',
        description: message,
        variant: 'destructive',
      });
      return null;
    }
  }, [cleanFromContent]);

  const downloadCleanedM3U = useCallback((result: CleanM3UResult, filename?: string) => {
    const blob = new Blob([result.cleaned], { type: 'audio/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `playlist-cleaned-${Date.now()}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: 'Download iniciado' });
  }, []);

  return {
    isCleaning,
    progress,
    lastResult,
    error,
    cleanFromUrl,
    cleanFromContent,
    cleanFromFile,
    downloadCleanedM3U,
    reset,
  };
}
