import { useState, useEffect, useCallback } from 'react';
import { m3uImportService, ImportSession } from '@/services/m3uImportService';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useM3UImport() {
  const [session, setSession] = useState<ImportSession | null>(null);
  const [progress, setProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<RealtimeChannel | null>(null);

  // Calcular progresso percentual
  useEffect(() => {
    if (session && session.totalChannels > 0) {
      const percent = (session.processedChannels / session.totalChannels) * 100;
      setProgress(Math.min(100, Math.max(0, percent)));
    }
  }, [session]);

  // Cleanup subscription ao desmontar
  useEffect(() => {
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [subscription]);

  /**
   * Iniciar importação de URL
   */
  const startUrlImport = useCallback(
    async (customListId: string, sourceUrl: string) => {
      try {
        setIsImporting(true);
        setError(null);

        // Criar sessão
        const newSession = await m3uImportService.createSession(
          customListId,
          'url',
          sourceUrl
        );
        setSession(newSession);

        // Subscrever para updates em tempo real
        const sub = m3uImportService.subscribeToProgress(
          newSession.id,
          (updatedSession: any) => {
            // Mapear para garantir tipo correto
            const mapped: ImportSession = {
              id: updatedSession.id,
              customListId: updatedSession.custom_list_id,
              totalChannels: updatedSession.total_channels || 0,
              processedChannels: updatedSession.processed_channels || 0,
              status: updatedSession.status,
              errorMessage: updatedSession.error_message,
              sourceType: updatedSession.source_type,
              sourceUrl: updatedSession.source_url,
              sourceHash: updatedSession.source_hash,
              batchSize: updatedSession.batch_size,
              currentBatch: updatedSession.current_batch,
              metadata: updatedSession.metadata,
              createdAt: updatedSession.created_at,
              updatedAt: updatedSession.updated_at,
              completedAt: updatedSession.completed_at,
            };
            setSession(mapped);
            
            if (mapped.status === 'completed') {
              toast.success('Importação concluída com sucesso!');
              setIsImporting(false);
            } else if (mapped.status === 'failed') {
              toast.error(`Falha na importação: ${mapped.errorMessage}`);
              setError(mapped.errorMessage || 'Erro desconhecido');
              setIsImporting(false);
            }
          }
        );
        setSubscription(sub);

        // Iniciar processamento
        await m3uImportService.startImport(
          newSession.id,
          'url',
          customListId,
          sourceUrl
        );

        toast.success('Importação iniciada! Acompanhe o progresso abaixo.');
      } catch (err: any) {
        console.error('Erro ao iniciar importação:', err);
        setError(err.message);
        toast.error(`Erro ao iniciar importação: ${err.message}`);
        setIsImporting(false);
      }
    },
    []
  );

  /**
   * Iniciar importação de conteúdo colado
   */
  const startPasteImport = useCallback(
    async (customListId: string, content: string) => {
      try {
        setIsImporting(true);
        setError(null);

        // Criar sessão
        const newSession = await m3uImportService.createSession(
          customListId,
          'paste'
        );
        setSession(newSession);

        // Subscrever para updates
        const sub = m3uImportService.subscribeToProgress(
          newSession.id,
          (updatedSession: any) => {
            const mapped: ImportSession = {
              id: updatedSession.id,
              customListId: updatedSession.custom_list_id,
              totalChannels: updatedSession.total_channels || 0,
              processedChannels: updatedSession.processed_channels || 0,
              status: updatedSession.status,
              errorMessage: updatedSession.error_message,
              sourceType: updatedSession.source_type,
              sourceUrl: updatedSession.source_url,
              sourceHash: updatedSession.source_hash,
              batchSize: updatedSession.batch_size,
              currentBatch: updatedSession.current_batch,
              metadata: updatedSession.metadata,
              createdAt: updatedSession.created_at,
              updatedAt: updatedSession.updated_at,
              completedAt: updatedSession.completed_at,
            };
            setSession(mapped);
            
            if (mapped.status === 'completed') {
              toast.success('Importação concluída com sucesso!');
              setIsImporting(false);
            } else if (mapped.status === 'failed') {
              toast.error(`Falha na importação: ${mapped.errorMessage}`);
              setError(mapped.errorMessage || 'Erro desconhecido');
              setIsImporting(false);
            }
          }
        );
        setSubscription(sub);

        // Iniciar processamento
        await m3uImportService.startImport(
          newSession.id,
          'paste',
          customListId,
          undefined,
          content
        );

        toast.success('Importação iniciada! Acompanhe o progresso abaixo.');
      } catch (err: any) {
        console.error('Erro ao iniciar importação:', err);
        setError(err.message);
        toast.error(`Erro ao iniciar importação: ${err.message}`);
        setIsImporting(false);
      }
    },
    []
  );

  /**
   * Pausar importação
   */
  const pauseImport = useCallback(async () => {
    if (!session) return;

    try {
      await m3uImportService.pauseImport(session.id);
      toast.info('Importação pausada');
    } catch (err: any) {
      toast.error(`Erro ao pausar: ${err.message}`);
    }
  }, [session]);

  /**
   * Retomar importação
   */
  const resumeImport = useCallback(async () => {
    if (!session) return;

    try {
      await m3uImportService.resumeImport(session.id);
      toast.info('Importação retomada');
    } catch (err: any) {
      toast.error(`Erro ao retomar: ${err.message}`);
    }
  }, [session]);

  /**
   * Cancelar importação
   */
  const cancelImport = useCallback(async () => {
    if (!session) return;

    try {
      await m3uImportService.cancelImport(session.id);
      toast.info('Importação cancelada');
      setIsImporting(false);
    } catch (err: any) {
      toast.error(`Erro ao cancelar: ${err.message}`);
    }
  }, [session]);

  return {
    session,
    progress,
    isImporting,
    error,
    startUrlImport,
    startPasteImport,
    pauseImport,
    resumeImport,
    cancelImport,
  };
}