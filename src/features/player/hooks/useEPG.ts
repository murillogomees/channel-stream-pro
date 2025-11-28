/**
 * useEPG - Hook for Electronic Program Guide
 * Fetches and manages EPG data for channels
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { EPGProgram } from '../types';

interface UseEPGOptions {
  channelIds?: string[];
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

interface EPGData {
  [channelId: string]: {
    current?: EPGProgram;
    next?: EPGProgram;
    programs: EPGProgram[];
  };
}

export function useEPG(options: UseEPGOptions = {}) {
  const { 
    channelIds = [], 
    autoRefresh = true, 
    refreshInterval = 60000 // 1 minute
  } = options;

  const [epgData, setEpgData] = useState<EPGData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch EPG data for given channel IDs
  const fetchEPG = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h from now

      const { data, error: fetchError } = await supabase
        .from('epg_data')
        .select('*')
        .in('channel_id', ids)
        .gte('end_time', now)
        .lte('start_time', endTime)
        .order('start_time', { ascending: true });

      if (fetchError) throw fetchError;

      // Group by channel and find current/next programs
      const grouped: EPGData = {};
      
      ids.forEach(channelId => {
        const channelPrograms = (data || []).filter(p => p.channel_id === channelId) as EPGProgram[];
        const nowDate = new Date();
        
        const current = channelPrograms.find(p => {
          const start = new Date(p.start_time);
          const end = new Date(p.end_time);
          return start <= nowDate && end > nowDate;
        });

        const next = channelPrograms.find(p => {
          const start = new Date(p.start_time);
          return start > nowDate;
        });

        grouped[channelId] = {
          current,
          next,
          programs: channelPrograms,
        };
      });

      setEpgData(grouped);
    } catch (err: any) {
      console.error('[EPG] Error fetching:', err);
      setError(err.message || 'Erro ao carregar EPG');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh EPG data
  useEffect(() => {
    if (channelIds.length > 0) {
      fetchEPG(channelIds);
    }

    if (!autoRefresh || channelIds.length === 0) return;

    const interval = setInterval(() => {
      fetchEPG(channelIds);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [channelIds.join(','), autoRefresh, refreshInterval, fetchEPG]);

  // Get EPG for specific channel
  const getChannelEPG = useCallback((channelId: string) => {
    return epgData[channelId] || { programs: [] };
  }, [epgData]);

  // Get current program for channel
  const getCurrentProgram = useCallback((channelId: string): EPGProgram | undefined => {
    return epgData[channelId]?.current;
  }, [epgData]);

  // Get next program for channel
  const getNextProgram = useCallback((channelId: string): EPGProgram | undefined => {
    return epgData[channelId]?.next;
  }, [epgData]);

  // Calculate program progress percentage
  const getProgramProgress = useCallback((program?: EPGProgram): number => {
    if (!program) return 0;
    
    const now = Date.now();
    const start = new Date(program.start_time).getTime();
    const end = new Date(program.end_time).getTime();
    const total = end - start;
    const elapsed = now - start;
    
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }, []);

  // Format time remaining
  const getTimeRemaining = useCallback((program?: EPGProgram): string => {
    if (!program) return '';
    
    const now = Date.now();
    const end = new Date(program.end_time).getTime();
    const remaining = end - now;
    
    if (remaining <= 0) return 'Terminando';
    
    const minutes = Math.floor(remaining / 60000);
    if (minutes < 60) return `${minutes}min restantes`;
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min restantes`;
  }, []);

  return {
    epgData,
    isLoading,
    error,
    fetchEPG,
    getChannelEPG,
    getCurrentProgram,
    getNextProgram,
    getProgramProgress,
    getTimeRemaining,
    refresh: () => fetchEPG(channelIds),
  };
}

// Simpler hook for single channel
export function useChannelEPG(channelId: string | null) {
  const { 
    getCurrentProgram, 
    getNextProgram, 
    getProgramProgress, 
    getTimeRemaining,
    isLoading 
  } = useEPG({
    channelIds: channelId ? [channelId] : [],
  });

  const current = useMemo(
    () => channelId ? getCurrentProgram(channelId) : undefined,
    [channelId, getCurrentProgram]
  );

  const next = useMemo(
    () => channelId ? getNextProgram(channelId) : undefined,
    [channelId, getNextProgram]
  );

  const progress = useMemo(
    () => getProgramProgress(current),
    [current, getProgramProgress]
  );

  const timeRemaining = useMemo(
    () => getTimeRemaining(current),
    [current, getTimeRemaining]
  );

  return {
    current,
    next,
    progress,
    timeRemaining,
    isLoading,
  };
}
