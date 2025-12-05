/**
 * EPG React Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { epgService } from '../services/epgService';
import type { EpgProgram } from '../types';

interface UseEpgOptions {
  channelId?: string;
  epgUrl?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseEpgReturn {
  programs: EpgProgram[];
  currentProgram: EpgProgram | null;
  upcomingPrograms: EpgProgram[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useEpg({
  channelId,
  epgUrl,
  autoRefresh = true,
  refreshInterval = 300000, // 5 minutes
}: UseEpgOptions): UseEpgReturn {
  const [programs, setPrograms] = useState<EpgProgram[]>([]);
  const [currentProgram, setCurrentProgram] = useState<EpgProgram | null>(null);
  const [upcomingPrograms, setUpcomingPrograms] = useState<EpgProgram[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEpg = useCallback(async () => {
    if (!channelId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await epgService.loadEpg(channelId, epgUrl);
      setPrograms(data);
      
      // Update current and upcoming
      const current = epgService.getCurrentProgram(channelId);
      setCurrentProgram(current);
      
      const upcoming = epgService.getUpcomingPrograms(channelId, 5);
      setUpcomingPrograms(upcoming);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load EPG');
    } finally {
      setIsLoading(false);
    }
  }, [channelId, epgUrl]);

  // Initial load
  useEffect(() => {
    loadEpg();
  }, [loadEpg]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !channelId) return;

    const interval = setInterval(() => {
      // Update current/upcoming from cache
      const current = epgService.getCurrentProgram(channelId);
      setCurrentProgram(current);
      
      const upcoming = epgService.getUpcomingPrograms(channelId, 5);
      setUpcomingPrograms(upcoming);
    }, 60000); // Check every minute

    // Full refresh at interval
    const refreshTimer = setInterval(loadEpg, refreshInterval);

    return () => {
      clearInterval(interval);
      clearInterval(refreshTimer);
    };
  }, [autoRefresh, channelId, refreshInterval, loadEpg]);

  return {
    programs,
    currentProgram,
    upcomingPrograms,
    isLoading,
    error,
    refresh: loadEpg,
  };
}
