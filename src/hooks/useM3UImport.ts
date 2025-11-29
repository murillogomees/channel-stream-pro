import { useState, useEffect, useCallback, useRef } from 'react';
import { m3uImportService, ImportSession } from '@/services/m3uImportService';
import { parseM3U } from '@/modules/player/m3u';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';

const BATCH_SIZE = 100;

export function useM3UImport() {
  const [session, setSession] = useState<ImportSession | null>(null);
  const [progress, setProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Update progress when session changes
  useEffect(() => {
    if (session && session.totalChannels > 0) {
      const percent = (session.processedChannels / session.totalChannels) * 100;
      setProgress(Math.min(100, Math.max(0, percent)));
    } else if (session && session.status === 'processing') {
      // Edge function may not have set totalChannels yet, show indeterminate progress
      setProgress(session.processedChannels > 0 ? 5 : 0);
    }
  }, [session]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Fetch session directly from database
  const fetchSessionFromDb = useCallback(async (sessionId: string): Promise<ImportSession | null> => {
    try {
      const { data, error } = await supabase
        .from('m3u_import_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        customListId: data.custom_list_id,
        totalChannels: data.total_channels || 0,
        processedChannels: data.processed_channels || 0,
        status: data.status as ImportSession['status'],
        errorMessage: data.error_message,
        sourceType: data.source_type as ImportSession['sourceType'],
        sourceUrl: data.source_url,
        sourceHash: data.source_hash,
        batchSize: data.batch_size,
        currentBatch: data.current_batch,
        metadata: data.metadata,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        completedAt: data.completed_at,
      };
    } catch (err) {
      console.error('[useM3UImport] Error fetching session:', err);
      return null;
    }
  }, []);

  // Polling mechanism - more reliable than realtime for this use case
  const startPolling = useCallback((sessionId: string) => {
    // Clear any existing poll
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    sessionIdRef.current = sessionId;
    console.log('[useM3UImport] Starting polling for session:', sessionId);

    // Immediate first fetch
    fetchSessionFromDb(sessionId).then((sessionData) => {
      if (sessionData) {
        console.log('[useM3UImport] Initial fetch:', sessionData.status, sessionData.processedChannels);
        setSession(sessionData);
      }
    });

    pollIntervalRef.current = setInterval(async () => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        return;
      }

      const sessionData = await fetchSessionFromDb(currentSessionId);
      
      if (!sessionData) {
        console.warn('[useM3UImport] Session not found:', currentSessionId);
        return;
      }

      console.log('[useM3UImport] Poll update:', sessionData.status, sessionData.processedChannels, '/', sessionData.totalChannels);
      setSession(sessionData);

      // Check if continuation is needed (edge function hit CPU limit)
      if (sessionData.status === 'processing' && sessionData.metadata?.needsContinuation) {
        const resumeFrom = sessionData.metadata.resumeFromChannel;
        console.log('[useM3UImport] Continuation needed, resuming from channel:', resumeFrom);
        
        // Clear needsContinuation flag before re-invoking
        await supabase
          .from('m3u_import_sessions')
          .update({ metadata: { ...sessionData.metadata, needsContinuation: false } })
          .eq('id', currentSessionId);
        
        // Re-invoke edge function to continue processing
        try {
          const { error: invokeError } = await supabase.functions.invoke('process-m3u-import', {
            body: {
              sessionId: currentSessionId,
              sourceType: sessionData.sourceType,
              sourceUrl: sessionData.sourceUrl,
              customListId: sessionData.customListId,
              resumeFromChannel: resumeFrom,
            },
          });
          
          if (invokeError) {
            console.error('[useM3UImport] Error continuing import:', invokeError);
          } else {
            console.log('[useM3UImport] Continuation invoked successfully');
            toast.info(`Continuando importação... (${resumeFrom} canais processados)`);
          }
        } catch (err) {
          console.error('[useM3UImport] Error invoking continuation:', err);
        }
      }

      if (sessionData.status === 'completed') {
        toast.success(`Importação concluída! ${sessionData.processedChannels} canais importados.`);
        setIsImporting(false);
        cleanup();
      } else if (sessionData.status === 'failed') {
        toast.error(`Falha na importação: ${sessionData.errorMessage || 'Erro desconhecido'}`);
        setError(sessionData.errorMessage || 'Erro desconhecido');
        setIsImporting(false);
        cleanup();
      }
    }, 2000); // Poll every 2 seconds
  }, [fetchSessionFromDb, cleanup]);

  /**
   * Start URL import (uses edge function)
   */
  const startUrlImport = useCallback(
    async (customListId: string, sourceUrl: string) => {
      try {
        cleanup();
        setIsImporting(true);
        setError(null);
        setProgress(0);
        setSession(null);

        console.log('[useM3UImport] Creating session for URL import:', sourceUrl);
        
        const newSession = await m3uImportService.createSession(customListId, 'url', sourceUrl);
        console.log('[useM3UImport] Session created:', newSession.id);
        setSession(newSession);

        // Start polling immediately
        startPolling(newSession.id);

        // Also set up realtime subscription as backup
        const sub = supabase
          .channel(`import-progress-${newSession.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'm3u_import_sessions',
              filter: `id=eq.${newSession.id}`,
            },
            (payload: any) => {
              console.log('[useM3UImport] Realtime update:', payload.new?.status);
              const data = payload.new;
              if (data) {
                const mapped: ImportSession = {
                  id: data.id,
                  customListId: data.custom_list_id,
                  totalChannels: data.total_channels || 0,
                  processedChannels: data.processed_channels || 0,
                  status: data.status,
                  errorMessage: data.error_message,
                  sourceType: data.source_type,
                  sourceUrl: data.source_url,
                  sourceHash: data.source_hash,
                  batchSize: data.batch_size,
                  currentBatch: data.current_batch,
                  metadata: data.metadata,
                  createdAt: data.created_at,
                  updatedAt: data.updated_at,
                  completedAt: data.completed_at,
                };
                setSession(mapped);
              }
            }
          )
          .subscribe();
        
        subscriptionRef.current = sub;

        // Call edge function to start processing
        console.log('[useM3UImport] Invoking edge function...');
        await m3uImportService.startImport(newSession.id, 'url', customListId, sourceUrl);
        
        toast.success('Importação iniciada! Acompanhe o progresso abaixo.');
        
        return newSession;
      } catch (err: any) {
        console.error('[useM3UImport] Error starting URL import:', err);
        setError(err.message);
        toast.error(`Erro ao iniciar importação: ${err.message}`);
        setIsImporting(false);
        cleanup();
        throw err;
      }
    },
    [startPolling, cleanup]
  );

  /**
   * Start paste import - processes locally in the browser
   */
  const startPasteImport = useCallback(
    async (customListId: string, content: string) => {
      try {
        cleanup();
        setIsImporting(true);
        setError(null);
        setProgress(0);

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
        const parseResult = parseM3U(content);
        
        const totalChannels = parseResult.totalChannels;
        
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
        await supabase
          .from('m3u_import_sessions')
          .update({
            status: 'completed',
            processed_channels: processedCount,
            total_channels: processedCount,
            completed_at: new Date().toISOString(),
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
    [session?.id, cleanup]
  );

  const pauseImport = useCallback(async () => {
    if (!session) return;
    try {
      await m3uImportService.pauseImport(session.id);
      setSession(prev => prev ? { ...prev, status: 'paused' } : null);
      toast.info('Importação pausada');
    } catch (err: any) {
      toast.error(`Erro ao pausar: ${err.message}`);
    }
  }, [session]);

  const resumeImport = useCallback(async () => {
    if (!session) return;
    try {
      setIsImporting(true);
      
      // Update status to processing first
      await m3uImportService.resumeImport(session.id);
      setSession(prev => prev ? { ...prev, status: 'processing' } : null);
      
      // Restart polling
      startPolling(session.id);
      
      // Re-invoke edge function to continue processing
      const resumeFrom = session.processedChannels || 0;
      console.log('[useM3UImport] Resuming from channel:', resumeFrom);
      
      const { error: invokeError } = await supabase.functions.invoke('process-m3u-import', {
        body: {
          sessionId: session.id,
          sourceType: session.sourceType,
          sourceUrl: session.sourceUrl,
          customListId: session.customListId,
          resumeFromChannel: resumeFrom,
        },
      });
      
      if (invokeError) {
        console.error('[useM3UImport] Error resuming import:', invokeError);
        toast.error(`Erro ao retomar: ${invokeError.message}`);
      } else {
        toast.info('Importação retomada');
      }
    } catch (err: any) {
      toast.error(`Erro ao retomar: ${err.message}`);
      setIsImporting(false);
    }
  }, [session, startPolling]);

  const cancelImport = useCallback(async () => {
    if (!session) return;
    try {
      await m3uImportService.cancelImport(session.id);
      toast.info('Importação cancelada');
      setIsImporting(false);
      cleanup();
    } catch (err: any) {
      toast.error(`Erro ao cancelar: ${err.message}`);
    }
  }, [session, cleanup]);

  const resetImport = useCallback(() => {
    cleanup();
    setSession(null);
    setProgress(0);
    setIsImporting(false);
    setError(null);
    sessionIdRef.current = null;
  }, [cleanup]);

  /**
   * Load and resume an existing session from history
   */
  const loadExistingSession = useCallback(async (sessionId: string) => {
    try {
      cleanup();
      setIsImporting(true);
      setError(null);
      
      const sessionData = await fetchSessionFromDb(sessionId);
      if (!sessionData) {
        throw new Error('Sessão não encontrada');
      }
      
      setSession(sessionData);
      sessionIdRef.current = sessionId;
      
      // Start polling to track progress
      startPolling(sessionId);
      
      // If session is paused or stuck in processing, auto-resume
      if (sessionData.status === 'paused' || sessionData.status === 'processing') {
        const resumeFrom = sessionData.processedChannels || 0;
        
        // Update status if paused
        if (sessionData.status === 'paused') {
          await supabase
            .from('m3u_import_sessions')
            .update({ status: 'processing' })
            .eq('id', sessionId);
        }
        
        console.log('[useM3UImport] Loading and resuming session from channel:', resumeFrom);
        
        const { error: invokeError } = await supabase.functions.invoke('process-m3u-import', {
          body: {
            sessionId: sessionId,
            sourceType: sessionData.sourceType,
            sourceUrl: sessionData.sourceUrl,
            customListId: sessionData.customListId,
            resumeFromChannel: resumeFrom,
          },
        });
        
        if (invokeError) {
          console.error('[useM3UImport] Error loading session:', invokeError);
          toast.error(`Erro ao carregar sessão: ${invokeError.message}`);
        } else {
          toast.success(`Retomando importação de ${resumeFrom} canais...`);
        }
      }
      
      return sessionData;
    } catch (err: any) {
      console.error('[useM3UImport] Error loading session:', err);
      setError(err.message);
      toast.error(`Erro ao carregar sessão: ${err.message}`);
      setIsImporting(false);
      throw err;
    }
  }, [cleanup, fetchSessionFromDb, startPolling]);

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
    resetImport,
    loadExistingSession,
  };
}
