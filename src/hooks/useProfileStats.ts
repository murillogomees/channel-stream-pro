/**
 * useProfileStats - Hook otimizado para stats usando materialized view
 * Reduz egress drasticamente buscando dados pré-computados
 */

import { useState, useEffect, useCallback } from 'react';
import { profileService, ProfileStats } from '@/services/profileService';

interface UseProfileStatsReturn {
  stats: ProfileStats;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DEFAULT_STATS: ProfileStats = {
  total_users: 0,
  active_users: 0,
  trial_users: 0,
  expired_users: 0,
  expiring_soon: 0,
  last_refresh: new Date().toISOString(),
};

export function useProfileStats(): UseProfileStatsReturn {
  const [stats, setStats] = useState<ProfileStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await profileService.getStats();
      setStats(data);
    } catch (e: any) {
      console.error('[useProfileStats] Error:', e);
      setError(e?.message || 'Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  };
}
