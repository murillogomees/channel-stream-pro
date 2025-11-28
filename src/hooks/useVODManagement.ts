import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VODDownload {
  id: string;
  channel_id: string;
  original_url: string;
  r2_url: string | null;
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed';
  file_size_bytes: number | null;
  segment_count: number;
  segments_downloaded: number;
  download_started_at: string | null;
  download_completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
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
  const { toast } = useToast();
  const [downloads, setDownloads] = useState<VODDownload[]>([]);
  const [statistics, setStatistics] = useState<VODStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar downloads
  const fetchDownloads = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vod_downloads' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setDownloads((data || []) as unknown as VODDownload[]);
    } catch (error: any) {
      console.error('Error fetching VOD downloads:', error);
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

    const channel = supabase
      .channel('vod-downloads-changes')
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'vod_downloads',
        },
        () => {
          fetchDownloads();
          fetchStatistics();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchDownloads, fetchStatistics]);

  return {
    downloads,
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
    },
  };
};
