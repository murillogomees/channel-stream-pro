import { supabase } from '@/integrations/supabase/client';

export interface ImportSession {
  id: string;
  customListId: string;
  totalChannels: number;
  processedChannels: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  errorMessage?: string;
  sourceType: 'url' | 'paste';
  sourceUrl?: string;
  sourceHash?: string;
  batchSize: number;
  currentBatch: number;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ImportStatistics {
  totalImports: number;
  pendingImports: number;
  processingImports: number;
  completedImports: number;
  failedImports: number;
  cacheHits: number;
  avgChannelsPerImport: number;
}

// Mapear snake_case do banco para camelCase
function mapDbToSession(dbRow: any): ImportSession {
  return {
    id: dbRow.id,
    customListId: dbRow.custom_list_id,
    totalChannels: dbRow.total_channels || 0,
    processedChannels: dbRow.processed_channels || 0,
    status: dbRow.status,
    errorMessage: dbRow.error_message,
    sourceType: dbRow.source_type,
    sourceUrl: dbRow.source_url,
    sourceHash: dbRow.source_hash,
    batchSize: dbRow.batch_size,
    currentBatch: dbRow.current_batch,
    metadata: dbRow.metadata,
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at,
    completedAt: dbRow.completed_at,
  };
}

class M3UImportService {
  /**
   * Criar nova sessão de importação
   */
  async createSession(
    customListId: string,
    sourceType: 'url' | 'paste',
    sourceUrl?: string
  ): Promise<ImportSession> {
    const { data, error } = await supabase
      .from('m3u_import_sessions')
      .insert({
        custom_list_id: customListId,
        source_type: sourceType,
        source_url: sourceUrl,
        status: 'pending',
        batch_size: 1000,
        current_batch: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return mapDbToSession(data);
  }

  /**
   * Iniciar processamento de importação via Edge Function
   */
  async startImport(
    sessionId: string,
    sourceType: 'url' | 'paste',
    customListId: string,
    sourceUrl?: string,
    sourceContent?: string
  ): Promise<void> {
    // Adicionar à fila
    const { error: queueError } = await supabase
      .from('m3u_import_queue')
      .insert({
        session_id: sessionId,
        priority: 0,
        status: 'queued',
      });

    if (queueError) throw queueError;

    // Chamar Edge Function para processar em background
    const { error: funcError } = await supabase.functions.invoke(
      'process-m3u-import',
      {
        body: {
          sessionId,
          sourceType,
          sourceUrl,
          sourceContent,
          customListId,
        },
      }
    );

    if (funcError) throw funcError;
  }

  /**
   * Obter progresso de importação em tempo real
   */
  subscribeToProgress(
    sessionId: string,
    onUpdate: (session: ImportSession) => void
  ) {
    return supabase
      .channel(`import-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'm3u_import_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          onUpdate(payload.new as ImportSession);
        }
      )
      .subscribe();
  }

  /**
   * Pausar importação
   */
  async pauseImport(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('m3u_import_sessions')
      .update({ status: 'paused' })
      .eq('id', sessionId);

    if (error) throw error;
  }

  /**
   * Retomar importação pausada
   */
  async resumeImport(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('m3u_import_sessions')
      .update({ status: 'processing' })
      .eq('id', sessionId);

    if (error) throw error;
  }

  /**
   * Cancelar importação
   */
  async cancelImport(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('m3u_import_sessions')
      .update({ status: 'failed', error_message: 'Cancelado pelo usuário' })
      .eq('id', sessionId);

    if (error) throw error;
  }

  /**
   * Obter estatísticas de importação
   */
  async getStatistics(): Promise<ImportStatistics> {
    const { data, error } = await supabase.rpc('get_import_statistics');
    
    if (error) throw error;
    
    // RPC retorna array, pegar primeiro elemento
    const stats = Array.isArray(data) ? data[0] : data;
    
    return {
      totalImports: stats.total_imports,
      pendingImports: stats.pending_imports,
      processingImports: stats.processing_imports,
      completedImports: stats.completed_imports,
      failedImports: stats.failed_imports,
      cacheHits: stats.cache_hits,
      avgChannelsPerImport: stats.avg_channels_per_import,
    };
  }

  /**
   * Limpar cache antigo (30+ dias)
   */
  async cleanupOldCache(): Promise<void> {
    const { error } = await supabase.rpc('cleanup_old_import_cache');
    if (error) throw error;
  }

  /**
   * Listar todas as sessões de importação
   */
  async listSessions(limit = 50): Promise<ImportSession[]> {
    const { data, error } = await supabase
      .from('m3u_import_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data.map(mapDbToSession);
  }

  /**
   * Obter sessão específica
   */
  async getSession(sessionId: string): Promise<ImportSession | null> {
    const { data, error } = await supabase
      .from('m3u_import_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapDbToSession(data) : null;
  }
}

export const m3uImportService = new M3UImportService();