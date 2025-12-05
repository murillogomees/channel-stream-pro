/**
 * M3U Ingest Hook
 * 
 * React hook for streaming M3U imports with progress tracking
 * and automatic fallback handling.
 * 
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// =============================================
// TYPES
// =============================================

export interface IngestProgress {
  status: 'idle' | 'connecting' | 'downloading' | 'uploading' | 'processing' | 'complete' | 'error';
  percent: number;
  bytes: number;
  message: string;
  method?: 'stream' | 'signed_url' | 'fallback';
}

export interface IngestResult {
  success: boolean;
  objectKey?: string;
  cdnUrl?: string;
  bytes?: number;
  durationMs?: number;
  method?: string;
  traceId?: string;
  error?: string;
}

export interface IngestOptions {
  sourceId?: string;
  forceSignedUrl?: boolean;
  metadata?: Record<string, string>;
  onProgress?: (progress: IngestProgress) => void;
}

// =============================================
// HOOK
// =============================================

export function useM3UIngest() {
  const [progress, setProgress] = useState<IngestProgress>({
    status: 'idle',
    percent: 0,
    bytes: 0,
    message: '',
  });
  const [isIngesting, setIsIngesting] = useState(false);

  const updateProgress = useCallback((update: Partial<IngestProgress>) => {
    setProgress(prev => {
      const next = { ...prev, ...update };
      return next;
    });
  }, []);

  /**
   * Start M3U ingest from URL
   */
  const ingestFromUrl = useCallback(async (
    originUrl: string,
    options: IngestOptions = {}
  ): Promise<IngestResult> => {
    const { sourceId, forceSignedUrl, metadata, onProgress } = options;

    setIsIngesting(true);
    updateProgress({
      status: 'connecting',
      percent: 5,
      bytes: 0,
      message: 'Conectando ao servidor...',
    });

    try {
      // Validate URL
      try {
        new URL(originUrl);
      } catch {
        throw new Error('URL inválida');
      }

      updateProgress({
        status: 'downloading',
        percent: 10,
        message: 'Iniciando download stream-safe...',
      });

      // Call the ingest Edge Function
      const { data, error } = await supabase.functions.invoke('m3u-ingest', {
        body: {
          originUrl,
          sourceId,
          forceSignedUrl,
          metadata,
        },
      });

      if (error) {
        throw new Error(error.message || 'Falha no ingest');
      }

      if (!data.success) {
        throw new Error(data.error || 'Ingest falhou');
      }

      updateProgress({
        status: 'complete',
        percent: 100,
        bytes: data.bytes || 0,
        message: `Concluído! ${formatBytes(data.bytes || 0)} transferidos`,
        method: data.method,
      });

      onProgress?.({
        status: 'complete',
        percent: 100,
        bytes: data.bytes || 0,
        message: `Concluído! ${formatBytes(data.bytes || 0)} transferidos`,
        method: data.method,
      });

      return {
        success: true,
        objectKey: data.objectKey,
        cdnUrl: data.cdnUrl,
        bytes: data.bytes,
        durationMs: data.durationMs,
        method: data.method,
        traceId: data.traceId,
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      
      updateProgress({
        status: 'error',
        percent: 0,
        message: `Erro: ${message}`,
      });

      onProgress?.({
        status: 'error',
        percent: 0,
        bytes: 0,
        message: `Erro: ${message}`,
      });

      toast.error('Falha no ingest M3U', {
        description: message,
      });

      return {
        success: false,
        error: message,
      };

    } finally {
      setIsIngesting(false);
    }
  }, [updateProgress]);

  /**
   * Get ingest job status
   */
  const getJobStatus = useCallback(async (objectKey: string) => {
    const { data, error } = await (supabase as any)
      .from('m3u_ingest_jobs')
      .select('*')
      .eq('object_key', objectKey)
      .single();

    if (error) {
      console.error('[useM3UIngest] Failed to get job status:', error);
      return null;
    }

    return data;
  }, []);

  /**
   * Get ingest metrics summary
   */
  const getMetricsSummary = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('vw_ingest_metrics_summary')
      .select('*')
      .limit(24);

    if (error) {
      console.error('[useM3UIngest] Failed to get metrics:', error);
      return [];
    }

    return data || [];
  }, []);

  /**
   * Reset progress state
   */
  const reset = useCallback(() => {
    setProgress({
      status: 'idle',
      percent: 0,
      bytes: 0,
      message: '',
    });
    setIsIngesting(false);
  }, []);

  return {
    progress,
    isIngesting,
    ingestFromUrl,
    getJobStatus,
    getMetricsSummary,
    reset,
  };
}

// =============================================
// HELPERS
// =============================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
