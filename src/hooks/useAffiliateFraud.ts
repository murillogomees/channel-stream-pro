import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FraudLog {
  id: string;
  affiliate_id: string;
  affiliate_name?: string;
  event_type: string;
  severity: string;
  details: any;
  ip_address: string;
  user_agent: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export function useAffiliateFraud() {
  const [fraudLogs, setFraudLogs] = useState<FraudLog[]>([]);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchFraudLogs = async (onlyUnresolved = false) => {
    try {
      let query = supabase
        .from('affiliate_fraud_logs')
        .select(`
          *,
          affiliates(name)
        `)
        .order('created_at', { ascending: false });

      if (onlyUnresolved) {
        query = query.eq('resolved', false);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;

      const formatted = (data || []).map(log => ({
        ...log,
        affiliate_name: (log.affiliates as any)?.name || 'Desconhecido'
      }));

      setFraudLogs(formatted);
      setUnresolvedCount(formatted.filter(l => !l.resolved).length);
    } catch (error: any) {
      console.error('Error fetching fraud logs:', error);
      toast.error('Erro ao carregar logs de fraude');
    } finally {
      setLoading(false);
    }
  };

  const resolveFraudLog = async (id: string, notes: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('affiliate_fraud_logs')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: notes
        })
        .eq('id', id);

      if (error) throw error;
      
      setFraudLogs(prev => prev.map(log => 
        log.id === id 
          ? { ...log, resolved: true, resolved_at: new Date().toISOString(), resolution_notes: notes }
          : log
      ));
      setUnresolvedCount(prev => Math.max(0, prev - 1));
      
      toast.success('Log marcado como resolvido');
    } catch (error: any) {
      console.error('Error resolving fraud log:', error);
      toast.error('Erro ao resolver log');
      throw error;
    }
  };

  const getSeverityStats = () => {
    const stats = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    fraudLogs.filter(l => !l.resolved).forEach(log => {
      const severity = log.severity as keyof typeof stats;
      if (stats[severity] !== undefined) {
        stats[severity]++;
      }
    });

    return stats;
  };

  const getEventTypeStats = () => {
    const stats: Record<string, number> = {};
    
    fraudLogs.forEach(log => {
      stats[log.event_type] = (stats[log.event_type] || 0) + 1;
    });

    return stats;
  };

  useEffect(() => {
    fetchFraudLogs();
  }, []);

  return {
    fraudLogs,
    unresolvedCount,
    loading,
    fetchFraudLogs,
    resolveFraudLog,
    getSeverityStats,
    getEventTypeStats
  };
}
