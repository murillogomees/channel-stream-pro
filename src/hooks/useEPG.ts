import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EPGProgram {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  category?: string;
  icon?: string;
}

interface UseEPGOptions {
  channelId?: string;
  tvgId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseEPGReturn {
  programs: EPGProgram[];
  currentProgram: EPGProgram | null;
  upcomingPrograms: EPGProgram[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEPG(options: UseEPGOptions = {}): UseEPGReturn {
  const { 
    channelId, 
    tvgId,
    autoRefresh = true, 
    refreshInterval = 60000 // 1 minute
  } = options;

  const [programs, setPrograms] = useState<EPGProgram[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEPG = useCallback(async () => {
    if (!channelId && !tvgId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Try edge function first
      const { data, error: fnError } = await supabase.functions.invoke('iptv-epg', {
        body: { channelId: channelId || tvgId }
      });

      if (fnError) throw fnError;

      if (data?.programs) {
        setPrograms(data.programs);
      }
    } catch (err) {
      // Fallback to direct database query
      try {
        const epgChannelId = tvgId || channelId;
        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: dbPrograms, error: dbError } = await supabase
          .from('epg_programs')
          .select('*')
          .eq('channel_id', epgChannelId)
          .gte('end_time', now.toISOString())
          .lte('start_time', endOfDay.toISOString())
          .order('start_time')
          .limit(20);

        if (dbError) throw dbError;

        const formatted = (dbPrograms || []).map(p => ({
          id: p.id,
          channelId: p.channel_id,
          title: p.title,
          description: p.description || undefined,
          start: p.start_time,
          end: p.end_time,
          category: p.category || undefined,
          icon: p.icon_url || undefined,
        }));

        setPrograms(formatted);
      } catch (dbErr) {
        console.error('[useEPG] Error fetching EPG:', dbErr);
        setError('Não foi possível carregar a programação');
        setPrograms([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [channelId, tvgId]);

  // Initial fetch
  useEffect(() => {
    fetchEPG();
  }, [fetchEPG]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchEPG, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchEPG]);

  // Derive current and upcoming programs
  const now = new Date();
  
  const currentProgram = programs.find(p => {
    const start = new Date(p.start);
    const end = new Date(p.end);
    return start <= now && end > now;
  }) || null;

  const upcomingPrograms = programs.filter(p => {
    const start = new Date(p.start);
    return start > now;
  }).slice(0, 5);

  return {
    programs,
    currentProgram,
    upcomingPrograms,
    isLoading,
    error,
    refetch: fetchEPG,
  };
}
