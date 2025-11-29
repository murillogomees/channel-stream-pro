import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VODDownload {
  id: string;
  channel_id: string;
  original_url: string;
  r2_url: string | null;
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed' | 'queued';
  file_size_bytes: number | null;
  segment_count: number;
  segments_downloaded: number;
  download_started_at: string | null;
  download_completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

export interface HostedVOD {
  id: string;
  name: string;
  stream_url: string;
  r2_url: string;
  r2_uploaded_at: string;
  group_title: string | null;
}

export interface VODStatistics {
  total_vods: number;
  vods_uploaded: number;
  vods_pending: number;
  downloads_in_progress: number;
  downloads_failed: number;
  total_storage_bytes: number;
  avg_file_size_mb: number;
}

export interface VODDetectionResult {
  updated_count: number;
  vod_count: number;
  live_count: number;
}

export const useVODManagement = () => {
  // All useState hooks first (stable order)
  const [downloads, setDownloads] = useState<VODDownload[]>([]);
  const [hostedVODs, setHostedVODs] = useState<HostedVOD[]>([]);
  const [statistics, setStatistics] = useState<VODStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Then useRef
  const lastUpdateRef = useRef<number>(0);
  
  // Then other hooks
  const { toast } = useToast();

  // Carregar downloads
  const fetchDownloads = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vod_downloads' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setDownloads((data || []) as unknown as VODDownload[]);
    } catch (error: any) {
      console.error('Error fetching VOD downloads:', error);
    }
  }, []);

  // Carregar VODs hospedados no R2
  const fetchHostedVODs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('m3u_channels')
        .select('id, name, stream_url, r2_url, r2_uploaded_at, group_title')
        .eq('r2_uploaded', true)
        .not('r2_url', 'is', null)
        .order('r2_uploaded_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHostedVODs((data || []) as HostedVOD[]);
    } catch (error: any) {
      console.error('Error fetching hosted VODs:', error);
    }
  }, []);

  // Carregar estatísticas
  const fetchStatistics = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_vod_statistics' as any);
      
      if (error) throw error;
      if (data && Array.isArray(data) && data.length > 0) {
        setStatistics(data[0] as VODStatistics);
      }
    } catch (error: any) {
      console.error('Error fetching VOD statistics:', error);
    }
  }, []);

  // Throttled refresh para evitar muitas chamadas
  const throttledRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current > 1000) { // Max 1 update per second
      lastUpdateRef.current = now;
      fetchDownloads();
      fetchStatistics();
      fetchHostedVODs();
    }
  }, [fetchDownloads, fetchStatistics, fetchHostedVODs]);

  // Detectar VODs automaticamente
  const detectVODs = useCallback(async (): Promise<VODDetectionResult> => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.rpc('detect_vod_channels' as any);
      
      if (error) throw error;
      
      const result = data?.[0] || { updated_count: 0, vod_count: 0, live_count: 0 };
      
      // Atualizar estatísticas após detecção
      await fetchStatistics();
      
      return result as VODDetectionResult;
    } catch (error: any) {
      console.error('Error detecting VODs:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatistics]);

  // Iniciar download de um canal
  const downloadChannel = useCallback(async (channelId: string, channelName: string) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('download-vod', {
        body: { channelId }
      });

      if (error) throw error;

      toast({
        title: 'Download iniciado',
        description: `VOD "${channelName}" está sendo baixado para o R2`,
      });

      // Atualizar lista de downloads
      await fetchDownloads();
      await fetchStatistics();
      
      return data;
    } catch (error: any) {
      toast({
        title: 'Erro ao iniciar download',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast, fetchDownloads, fetchStatistics]);

  // Iniciar download em lote
  const downloadBatch = useCallback(async (channelIds: string[]) => {
    try {
      setIsLoading(true);
      
      let successCount = 0;
      let failCount = 0;

      // Processar downloads em paralelo (máximo 3 simultâneos)
      const batchSize = 3;
      for (let i = 0; i < channelIds.length; i += batchSize) {
        const batch = channelIds.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(channelId => 
            supabase.functions.invoke('download-vod', {
              body: { channelId }
            })
          )
        );

        results.forEach(result => {
          if (result.status === 'fulfilled') {
            successCount++;
          } else {
            failCount++;
          }
        });
      }

      toast({
        title: 'Download em lote iniciado',
        description: `${successCount} downloads iniciados, ${failCount} falharam`,
      });

      await fetchDownloads();
      await fetchStatistics();
    } catch (error: any) {
      toast({
        title: 'Erro no download em lote',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, fetchDownloads, fetchStatistics]);

  // Marcar canal como VOD
  const markAsVOD = useCallback(async (channelId: string, isVOD: boolean) => {
    try {
      const { error } = await supabase
        .from('m3u_channels')
        .update({ 
          is_vod: isVOD,
          content_type: isVOD ? 'vod' : 'live'
        } as any)
        .eq('id', channelId);

      if (error) throw error;

      toast({
        title: isVOD ? 'Canal marcado como VOD' : 'Canal marcado como LIVE',
        description: 'Configuração atualizada com sucesso',
      });

      await fetchStatistics();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar canal',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [toast, fetchStatistics]);

  // Deletar VOD do R2
  const deleteVOD = useCallback(async (channelId: string) => {
    try {
      const { error } = await supabase
        .from('m3u_channels')
        .update({
          r2_uploaded: false,
          r2_url: null,
          r2_uploaded_at: null
        } as any)
        .eq('id', channelId);

      if (error) throw error;

      // Deletar registro de download
      await supabase
        .from('vod_downloads' as any)
        .delete()
        .eq('channel_id', channelId);

      toast({
        title: 'VOD removido',
        description: 'VOD será removido do R2 na próxima limpeza',
      });

      await fetchDownloads();
      await fetchStatistics();
    } catch (error: any) {
      toast({
        title: 'Erro ao deletar VOD',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [toast, fetchDownloads, fetchStatistics]);

  // Subscrição realtime para updates de progresso
  useEffect(() => {
    fetchDownloads();
    fetchStatistics();
    fetchHostedVODs();

    // Canal para updates de vod_downloads
    const downloadsChannel = supabase
      .channel('vod-downloads-realtime')
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'vod_downloads',
        },
        (payload: any) => {
          console.log('[VOD Realtime] Download update:', payload.eventType);
          throttledRefresh();
        }
      )
      .subscribe();

    // Canal para updates de m3u_channels (quando r2_uploaded muda)
    const channelsChannel = supabase
      .channel('vod-channels-realtime')
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'm3u_channels',
          filter: 'is_vod=eq.true',
        },
        (payload: any) => {
          if (payload.new?.r2_uploaded !== payload.old?.r2_uploaded) {
            console.log('[VOD Realtime] Channel R2 status changed');
            throttledRefresh();
          }
        }
      )
      .subscribe();

    // Polling de backup a cada 10 segundos para garantir sincronização
    const pollInterval = setInterval(() => {
      fetchDownloads();
      fetchStatistics();
    }, 10000);

    return () => {
      downloadsChannel.unsubscribe();
      channelsChannel.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [fetchDownloads, fetchStatistics, fetchHostedVODs, throttledRefresh]);

  return {
    downloads,
    hostedVODs,
    statistics,
    isLoading,
    downloadChannel,
    downloadBatch,
    markAsVOD,
    deleteVOD,
    detectVODs,
    refresh: () => {
      fetchDownloads();
      fetchStatistics();
      fetchHostedVODs();
    },
  };
};
