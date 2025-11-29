import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VODDownload {
  id: string;
  channel_id: string;
  original_url: string;
  r2_url: string | null;
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed' | 'queued' | 'paused';
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
  downloads_paused: number;
  total_storage_bytes: number;
  avg_file_size_mb: number;
  blocked_hosts: number;
  active_downloads: number;
}

export interface VODDetectionResult {
  updated_count: number;
  vod_count: number;
  live_count: number;
}

export interface HostStatus {
  host: string;
  consecutive_failures: number;
  total_failures: number;
  total_successes: number;
  blocked_until: string | null;
  health_status: 'healthy' | 'warning' | 'blocked';
  avg_speed_mbps: number | null;
  vod_count: number;
}

export const useVODManagement = () => {
  // All useState hooks first (stable order)
  const [downloads, setDownloads] = useState<VODDownload[]>([]);
  const [hostedVODs, setHostedVODs] = useState<HostedVOD[]>([]);
  const [statistics, setStatistics] = useState<VODStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [channelNames, setChannelNames] = useState<Record<string, string>>({});
  
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
      const downloadsList = (data || []) as unknown as VODDownload[];
      setDownloads(downloadsList);
      
      // Buscar nomes dos canais para os downloads
      const channelIds = [...new Set(downloadsList.map(d => d.channel_id))];
      if (channelIds.length > 0) {
        const { data: channelsData } = await supabase
          .from('m3u_channels')
          .select('id, name')
          .in('id', channelIds);
        
        if (channelsData) {
          const namesMap: Record<string, string> = {};
          channelsData.forEach((ch: any) => {
            namesMap[ch.id] = ch.name;
          });
          setChannelNames(prev => ({ ...prev, ...namesMap }));
        }
      }
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

  // Detectar VODs automaticamente a partir das entradas CDN
  const detectVODs = useCallback(async (): Promise<VODDetectionResult> => {
    try {
      setIsLoading(true);
      
      // Usar a nova função que detecta a partir das entradas CDN (m3u_sync_entries)
      const { data, error } = await supabase.rpc('detect_vod_from_sync_entries' as any);
      
      if (error) throw error;
      
      const result = data?.[0] || { updated_count: 0, vod_count: 0, live_count: 0 };
      
      // Atualizar estatísticas após detecção
      await fetchStatistics();
      
      return result as VODDetectionResult;
    } catch (error: any) {
      console.error('Error detecting VODs from CDN entries:', error);
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

      // Verificar respostas de duplicidade (retornadas no data mesmo com status 409)
      if (data?.alreadyUploaded) {
        toast({
          title: 'VOD já enviado',
          description: `"${channelName}" já foi enviado ao R2`,
          variant: 'default',
        });
        return data;
      }

      if (data?.existingDownload) {
        toast({
          title: 'Download em andamento',
          description: `"${channelName}" já está sendo processado (${data.status})`,
          variant: 'default',
        });
        return data;
      }

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
      // Também verificar no erro se é duplicidade
      const errorData = error?.context?.json;
      if (errorData?.alreadyUploaded || errorData?.existingDownload) {
        toast({
          title: errorData?.alreadyUploaded ? 'VOD já enviado' : 'Download em andamento',
          description: `"${channelName}" ${errorData?.alreadyUploaded ? 'já foi enviado ao R2' : 'já está sendo processado'}`,
          variant: 'default',
        });
        return errorData;
      }
      
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

  // Resetar downloads órfãos (travados há mais de 2 minutos sem progresso ou 5 min com progresso)
  const resetOrphanedDownloads = useCallback(async () => {
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      // Downloads sem progresso (0 bytes) há mais de 2 minutos - deletar
      const { data: noProgress, error: noProgressError } = await supabase
        .from('vod_downloads' as any)
        .select('id')
        .in('status', ['downloading', 'processing', 'queued'])
        .eq('file_size_bytes', 0)
        .lt('updated_at', twoMinutesAgo);

      let deletedCount = 0;
      if (!noProgressError && noProgress && noProgress.length > 0) {
        const ids = noProgress.map((d: any) => d.id);
        await supabase.from('vod_downloads' as any).delete().in('id', ids);
        deletedCount = ids.length;
        console.log(`[VOD] Deletados ${deletedCount} downloads sem progresso`);
      }
      
      // Downloads com progresso travados há mais de 5 minutos - marcar como failed
      const { data: stuck100 } = await supabase
        .from('vod_downloads' as any)
        .select('id, channel_id, segment_count, segments_downloaded')
        .in('status', ['downloading', 'processing'])
        .gt('file_size_bytes', 0)
        .lt('updated_at', fiveMinutesAgo);
      
      if (stuck100) {
        const stuckAt100 = (stuck100 as any[]).filter(d => 
          d.segment_count > 0 && d.segments_downloaded >= d.segment_count
        );
        
        for (const download of stuckAt100) {
          await supabase
            .from('vod_downloads' as any)
            .update({ 
              status: 'failed', 
              error_message: 'Download travou em 100%' 
            })
            .eq('id', download.id);
        }
      }
      
      // Outros downloads com progresso travados
      const { data: orphaned } = await supabase
        .from('vod_downloads' as any)
        .update({ status: 'failed', error_message: 'Timeout automático' })
        .in('status', ['downloading', 'processing', 'queued'])
        .gt('file_size_bytes', 0)
        .lt('updated_at', fiveMinutesAgo)
        .select('id');

      const totalReset = deletedCount + (orphaned?.length || 0);
      
      if (totalReset > 0) {
        toast({
          title: 'Downloads limpos',
          description: `${deletedCount} deletados, ${orphaned?.length || 0} marcados como falhos`,
        });
      } else {
        toast({
          title: 'Nenhum download órfão',
          description: 'Não há downloads travados',
        });
      }

      await fetchDownloads();
      await fetchStatistics();
      
      return totalReset;
    } catch (error: any) {
      toast({
        title: 'Erro ao resetar downloads',
        description: error.message,
        variant: 'destructive',
      });
      return 0;
    }
  }, [toast, fetchDownloads, fetchStatistics]);

  // Cancelar/deletar um download específico
  const cancelDownload = useCallback(async (downloadId: string) => {
    try {
      const { error } = await supabase
        .from('vod_downloads' as any)
        .delete()
        .eq('id', downloadId);

      if (error) throw error;

      toast({
        title: 'Download cancelado',
        description: 'Download removido da fila',
      });

      await fetchDownloads();
      await fetchStatistics();
    } catch (error: any) {
      toast({
        title: 'Erro ao cancelar',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [toast, fetchDownloads, fetchStatistics]);

  // Retry de um download específico
  const retryDownload = useCallback(async (downloadId: string) => {
    try {
      // Buscar o download
      const { data: downloadData, error: fetchError } = await supabase
        .from('vod_downloads' as any)
        .select('channel_id')
        .eq('id', downloadId)
        .maybeSingle();

      const download = downloadData as unknown as { channel_id: string } | null;
      if (fetchError || !download) throw new Error('Download não encontrado');

      // Resetar flag r2_uploaded do canal para permitir retry
      await supabase
        .from('m3u_channels')
        .update({ r2_uploaded: false, r2_url: null } as any)
        .eq('id', download.channel_id);

      // Deletar o registro antigo
      await supabase
        .from('vod_downloads' as any)
        .delete()
        .eq('id', downloadId);

      // Iniciar novo download
      const { data, error } = await supabase.functions.invoke('download-vod', {
        body: { channelId: download.channel_id }
      });

      if (error) throw error;

      toast({
        title: 'Retry iniciado',
        description: 'Download reiniciado com sucesso',
      });

      await fetchDownloads();
    } catch (error: any) {
      toast({
        title: 'Erro no retry',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [toast, fetchDownloads]);

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

    // Polling de backup a cada 5 segundos para garantir sincronização fluida
    const pollInterval = setInterval(() => {
      fetchDownloads();
      fetchStatistics();
    }, 5000);

    return () => {
      downloadsChannel.unsubscribe();
      channelsChannel.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [fetchDownloads, fetchStatistics, fetchHostedVODs, throttledRefresh]);

  // Cleanup de downloads duplicados
  const cleanupDuplicates = useCallback(async () => {
    try {
      // Buscar todos os downloads ativos agrupados por channel_id
      const { data: allDownloads, error } = await supabase
        .from('vod_downloads' as any)
        .select('id, channel_id, status, created_at')
        .in('status', ['queued', 'downloading', 'processing', 'paused', 'pending'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Agrupar por channel_id e identificar duplicados
      const byChannel = new Map<string, Array<{ id: string; created_at: string }>>();
      
      for (const download of ((allDownloads || []) as unknown as Array<{ id: string; channel_id: string; created_at: string }>)) {
        if (!byChannel.has(download.channel_id)) {
          byChannel.set(download.channel_id, []);
        }
        byChannel.get(download.channel_id)!.push({ id: download.id, created_at: download.created_at });
      }

      // Identificar duplicados (manter apenas o mais recente de cada channel)
      const duplicateIds: string[] = [];
      
      for (const [channelId, downloads] of byChannel) {
        if (downloads.length > 1) {
          // Ordenar por data (mais recente primeiro) e remover todos exceto o primeiro
          downloads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const toRemove = downloads.slice(1).map(d => d.id);
          duplicateIds.push(...toRemove);
          console.log(`[VOD Cleanup] Canal ${channelId}: removendo ${toRemove.length} duplicados`);
        }
      }

      if (duplicateIds.length === 0) {
        toast({
          title: 'Sem duplicados',
          description: 'Não há downloads duplicados para remover',
        });
        return 0;
      }

      // Deletar duplicados
      const { error: deleteError } = await supabase
        .from('vod_downloads' as any)
        .delete()
        .in('id', duplicateIds);

      if (deleteError) throw deleteError;

      toast({
        title: 'Duplicados removidos',
        description: `${duplicateIds.length} downloads duplicados foram removidos`,
      });

      await fetchDownloads();
      await fetchStatistics();
      
      return duplicateIds.length;
    } catch (error: any) {
      toast({
        title: 'Erro ao limpar duplicados',
        description: error.message,
        variant: 'destructive',
      });
      return 0;
    }
  }, [toast, fetchDownloads, fetchStatistics]);

  // Pausar todos downloads (prioridade do player)
  const pauseAllDownloads = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('download-vod', {
        body: { pauseAll: true },
        headers: session?.session?.access_token 
          ? { Authorization: `Bearer ${session.session.access_token}` }
          : undefined,
      });

      if (response.error) throw response.error;
      console.log('⏸️ Downloads pausados para prioridade do player');
      return true;
    } catch (error) {
      console.error('Erro ao pausar downloads:', error);
      return false;
    }
  }, []);

  // Retomar downloads pausados
  const resumeAllDownloads = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('download-vod', {
        body: { resumeAll: true },
        headers: session?.session?.access_token 
          ? { Authorization: `Bearer ${session.session.access_token}` }
          : undefined,
      });

      if (response.error) throw response.error;
      console.log('▶️ Downloads retomados');
      await fetchDownloads();
      return true;
    } catch (error) {
      console.error('Erro ao retomar downloads:', error);
      return false;
    }
  }, [fetchDownloads]);

  // Stable refresh function
  const refresh = useCallback(() => {
    fetchDownloads();
    fetchStatistics();
    fetchHostedVODs();
  }, [fetchDownloads, fetchStatistics, fetchHostedVODs]);

  // Buscar status dos hosts (circuit breaker)
  const fetchHostStatus = useCallback(async (): Promise<HostStatus[]> => {
    try {
      const { data, error } = await supabase
        .from('vw_host_status' as any)
        .select('*')
        .order('consecutive_failures', { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as HostStatus[];
    } catch (error: any) {
      console.error('Error fetching host status:', error);
      return [];
    }
  }, []);

  // Desbloquear host manualmente
  const unblockHost = useCallback(async (host: string) => {
    try {
      const { error } = await supabase
        .from('vod_host_status' as any)
        .update({ blocked_until: null, consecutive_failures: 0 })
        .eq('host', host);

      if (error) throw error;

      toast({
        title: 'Host desbloqueado',
        description: `${host} foi desbloqueado com sucesso`,
      });

      await fetchStatistics();
    } catch (error: any) {
      toast({
        title: 'Erro ao desbloquear',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [toast, fetchStatistics]);

  // Retomar download específico (pausado)
  const resumeDownload = useCallback(async (downloadId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('download-vod', {
        body: { resume: true, downloadId },
        headers: session?.session?.access_token 
          ? { Authorization: `Bearer ${session.session.access_token}` }
          : undefined,
      });

      if (error) throw error;

      toast({
        title: 'Download retomado',
        description: 'O download será retomado em alguns segundos',
      });

      await fetchDownloads();
      return data;
    } catch (error: any) {
      toast({
        title: 'Erro ao retomar',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  }, [toast, fetchDownloads]);

  return {
    downloads,
    hostedVODs,
    statistics,
    isLoading,
    channelNames,
    downloadChannel,
    downloadBatch,
    markAsVOD,
    deleteVOD,
    detectVODs,
    resetOrphanedDownloads,
    cleanupDuplicates,
    cancelDownload,
    retryDownload,
    resumeDownload,
    pauseAllDownloads,
    resumeAllDownloads,
    fetchHostStatus,
    unblockHost,
    refresh,
  };
};
