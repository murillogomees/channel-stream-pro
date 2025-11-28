import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface M3USyncSource {
  id: string;
  key: string;
  name: string;
  source_url: string;
  enabled: boolean;
  sync_interval_minutes: number;
  last_sync_at: string | null;
  last_sync_status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  last_error: string | null;
  entries_count: number;
  invalid_entries_count: number;
  file_size_bytes: number;
  checksum: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface M3USyncJob {
  id: string;
  source_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  entries_count: number;
  invalid_entries_count: number;
  error_message: string | null;
  triggered_by: string;
}

export interface M3USyncStats {
  total_sources: number;
  active_sources: number;
  total_entries: number;
  last_sync: string | null;
  failed_syncs_24h: number;
  successful_syncs_24h: number;
}

export function useM3USync() {
  const [sources, setSources] = useState<M3USyncSource[]>([]);
  const [stats, setStats] = useState<M3USyncStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});

  const fetchSources = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('m3u_sync_sources')
        .select('*')
        .order('name');

      if (error) throw error;
      setSources((data as unknown as M3USyncSource[]) || []);
    } catch (error: any) {
      console.error('[M3USync] Error fetching sources:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar fontes M3U',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_m3u_sync_stats');
      if (error) throw error;
      setStats(data?.[0] || null);
    } catch (error: any) {
      console.error('[M3USync] Error fetching stats:', error);
    }
  }, []);

  const fetchSourceJobs = useCallback(async (sourceId: string): Promise<M3USyncJob[]> => {
    try {
      const { data, error } = await supabase
        .from('m3u_sync_jobs')
        .select('*')
        .eq('source_id', sourceId)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data as unknown as M3USyncJob[]) || [];
    } catch (error: any) {
      console.error('[M3USync] Error fetching jobs:', error);
      return [];
    }
  }, []);

  const createSource = useCallback(async (data: {
    key: string;
    name: string;
    source_url: string;
    sync_interval_minutes?: number;
  }): Promise<M3USyncSource | null> => {
    try {
      const { data: source, error } = await supabase
        .from('m3u_sync_sources')
        .insert({
          key: data.key.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
          name: data.name,
          source_url: data.source_url,
          sync_interval_minutes: data.sync_interval_minutes || 30,
          enabled: true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Erro',
            description: 'Já existe uma fonte com esta chave',
            variant: 'destructive',
          });
          return null;
        }
        throw error;
      }

      toast({
        title: 'Sucesso',
        description: 'Fonte M3U criada com sucesso',
      });

      await fetchSources();
      return source as unknown as M3USyncSource;
    } catch (error: any) {
      console.error('[M3USync] Error creating source:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao criar fonte M3U',
        variant: 'destructive',
      });
      return null;
    }
  }, [fetchSources]);

  const updateSource = useCallback(async (
    id: string,
    updates: Partial<Pick<M3USyncSource, 'name' | 'source_url' | 'enabled' | 'sync_interval_minutes'>>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('m3u_sync_sources')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Fonte M3U atualizada',
      });

      await fetchSources();
      return true;
    } catch (error: any) {
      console.error('[M3USync] Error updating source:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar fonte M3U',
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchSources]);

  const deleteSource = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('m3u_sync_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Fonte M3U excluída',
      });

      await fetchSources();
      return true;
    } catch (error: any) {
      console.error('[M3USync] Error deleting source:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao excluir fonte M3U',
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchSources]);

  const triggerSync = useCallback(async (key?: string): Promise<boolean> => {
    const syncKey = key || 'all';
    setIsSyncing(prev => ({ ...prev, [syncKey]: true }));

    try {
      const { data, error } = await supabase.functions.invoke('m3u-sync', {
        body: { key, triggered_by: 'manual' },
      });

      if (error) throw error;

      toast({
        title: 'Sincronização iniciada',
        description: key 
          ? `Sincronizando ${key}...`
          : 'Sincronizando todas as fontes...',
      });

      // Refresh data after a delay
      setTimeout(() => {
        fetchSources();
        fetchStats();
      }, 2000);

      return true;
    } catch (error: any) {
      console.error('[M3USync] Error triggering sync:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao iniciar sincronização',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSyncing(prev => ({ ...prev, [syncKey]: false }));
    }
  }, [fetchSources, fetchStats]);

  const searchEntries = useCallback(async (query: string, sourceKey?: string, limit = 100) => {
    try {
      const { data, error } = await supabase.rpc('search_m3u_entries', {
        search_query: query,
        source_key: sourceKey || null,
        limit_count: limit,
      });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('[M3USync] Error searching entries:', error);
      return [];
    }
  }, []);

  const getPlaylistUrl = useCallback((key: string, format: 'm3u' | 'json' | 'gz' = 'm3u'): string => {
    const baseUrl = 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/m3u-playlist';
    if (format === 'json') {
      return `${baseUrl}/${key}?format=json`;
    } else if (format === 'gz') {
      return `${baseUrl}/${key}?format=gz`;
    }
    return `${baseUrl}/${key}`;
  }, []);

  return {
    sources,
    stats,
    isLoading,
    isSyncing,
    fetchSources,
    fetchStats,
    fetchSourceJobs,
    createSource,
    updateSource,
    deleteSource,
    triggerSync,
    searchEntries,
    getPlaylistUrl,
  };
}
