import { useState, useEffect, useCallback } from 'react';
import { m3uImportService, ImportSession } from '@/services/m3uImportService';
import { parseM3U } from '@/modules/player/m3u';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';

const BATCH_SIZE = 50;
const MAX_CHANNELS = 20000;

export function useM3UImport() {
  const [session, setSession] = useState<ImportSession | null>(null);
  const [progress, setProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (session && session.totalChannels > 0) {
      const percent = (session.processedChannels / session.totalChannels) * 100;
      setProgress(Math.min(100, Math.max(0, percent)));
    }
  }, [session]);

  useEffect(() => {
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [subscription]);

  /**
   * Start URL import (uses edge function)
   */
  const startUrlImport = useCallback(
    async (customListId: string, sourceUrl: string) => {
      try {
        setIsImporting(true);
        setError(null);

        const newSession = await m3uImportService.createSession(customListId, 'url', sourceUrl);
        setSession(newSession);

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

        await m3uImportService.startImport(newSession.id, 'url', customListId, sourceUrl);
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
   * Start paste import - processes locally in the browser
   */
  const startPasteImport = useCallback(
    async (customListId: string, content: string) => {
      try {
        setIsImporting(true);
        setError(null);

        // Create session locally
        const { data: sessionData, error: sessionError } = await supabase
          .from('m3u_import_sessions')
          .insert({
            custom_list_id: customListId,
            source_type: 'paste',
            status: 'processing',
            batch_size: BATCH_SIZE,
            current_batch: 0,
          })
          .select()
          .single();

        if (sessionError) throw sessionError;

        const newSession: ImportSession = {
          id: sessionData.id,
          customListId: sessionData.custom_list_id,
          totalChannels: 0,
          processedChannels: 0,
          status: 'processing',
          sourceType: 'paste',
          batchSize: BATCH_SIZE,
          currentBatch: 0,
          metadata: {},
          createdAt: sessionData.created_at,
          updatedAt: sessionData.updated_at,
        };
        setSession(newSession);

        // Parse M3U content locally
        toast.info('Analisando conteúdo M3U...');
        const parseResult = parseM3U(content, { maxChannels: MAX_CHANNELS });
        
        const totalChannels = Math.min(parseResult.totalChannels, MAX_CHANNELS);
        
        // Update session with total
        await supabase
          .from('m3u_import_sessions')
          .update({ total_channels: totalChannels })
          .eq('id', sessionData.id);

        setSession(prev => prev ? { ...prev, totalChannels } : null);

        // Create categories
        const categoryMap = new Map<string, string>();
        
        for (let i = 0; i < parseResult.categories.length; i++) {
          const cat = parseResult.categories[i];
          const { data: catData } = await supabase
            .from('m3u_categories')
            .insert({
              custom_list_id: customListId,
              name: cat.name,
              display_name: cat.displayName,
              order_position: i,
              icon: cat.icon,
            })
            .select('id')
            .single();
          
          if (catData) {
            categoryMap.set(cat.name, catData.id);
          }
        }

        // Get default category
        const defaultCategoryId = categoryMap.values().next().value;
        if (!defaultCategoryId) {
          throw new Error('Nenhuma categoria criada');
        }

        // Insert channels in batches
        let processedCount = 0;
        const channelBatch: any[] = [];

        for (const channel of parseResult.channels) {
          if (processedCount >= MAX_CHANNELS) break;

          const categoryId = categoryMap.get(channel.group) || defaultCategoryId;

          channelBatch.push({
            category_id: categoryId,
            name: channel.name,
            stream_url: channel.url,
            tvg_id: channel.tvgId || null,
            tvg_name: channel.tvgName || null,
            tvg_logo: channel.logo || null,
            group_title: channel.group,
            order_position: processedCount,
          });

          processedCount++;

          if (channelBatch.length >= BATCH_SIZE) {
            await supabase.from('m3u_channels').insert(channelBatch);
            channelBatch.length = 0;

            // Update progress
            await supabase
              .from('m3u_import_sessions')
              .update({ processed_channels: processedCount })
              .eq('id', sessionData.id);

            setSession(prev => prev ? { ...prev, processedChannels: processedCount } : null);
          }
        }

        // Insert remaining channels
        if (channelBatch.length > 0) {
          await supabase.from('m3u_channels').insert(channelBatch);
        }

        // Mark complete
        const wasLimited = processedCount >= MAX_CHANNELS;
        await supabase
          .from('m3u_import_sessions')
          .update({
            status: 'completed',
            processed_channels: processedCount,
            total_channels: processedCount,
            completed_at: new Date().toISOString(),
            error_message: wasLimited ? `Limitado a ${MAX_CHANNELS} canais` : null,
          })
          .eq('id', sessionData.id);

        await supabase
          .from('m3u_custom_lists')
          .update({
            total_channels: processedCount,
            total_categories: categoryMap.size,
            updated_at: new Date().toISOString(),
          })
          .eq('id', customListId);

        setSession(prev => prev ? {
          ...prev,
          status: 'completed',
          processedChannels: processedCount,
          totalChannels: processedCount,
        } : null);

        toast.success(`Importação concluída! ${processedCount} canais, ${categoryMap.size} categorias`);
        setIsImporting(false);

      } catch (err: any) {
        console.error('Erro ao processar importação:', err);
        setError(err.message);
        toast.error(`Erro na importação: ${err.message}`);
        setIsImporting(false);

        // Update session as failed
        if (session?.id) {
          await supabase
            .from('m3u_import_sessions')
            .update({
              status: 'failed',
              error_message: err.message,
              completed_at: new Date().toISOString(),
            })
            .eq('id', session.id);
        }
      }
    },
    [session?.id]
  );

  const pauseImport = useCallback(async () => {
    if (!session) return;
    try {
      await m3uImportService.pauseImport(session.id);
      toast.info('Importação pausada');
    } catch (err: any) {
      toast.error(`Erro ao pausar: ${err.message}`);
    }
  }, [session]);

  const resumeImport = useCallback(async () => {
    if (!session) return;
    try {
      await m3uImportService.resumeImport(session.id);
      toast.info('Importação retomada');
    } catch (err: any) {
      toast.error(`Erro ao retomar: ${err.message}`);
    }
  }, [session]);

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
