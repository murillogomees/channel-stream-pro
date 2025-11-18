import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface StatusChangeHistory {
  id: string;
  service_name: string;
  previous_status: string | null;
  new_status: string;
  changed_at: string;
  metadata: any;
}

export function useStatusHistory(serviceName?: string, limit: number = 50) {
  const [history, setHistory] = useState<StatusChangeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchHistory = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('status_change_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(limit);

      if (serviceName) {
        query = query.eq('service_name', serviceName);
      }

      const { data, error } = await query;

      if (error) throw error;
      setHistory(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar histórico:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o histórico de mudanças',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const logStatusChange = async (
    serviceName: string,
    previousStatus: string | null,
    newStatus: string,
    metadata?: any
  ) => {
    try {
      const { error } = await supabase.rpc('log_status_change', {
        p_service_name: serviceName,
        p_previous_status: previousStatus,
        p_new_status: newStatus,
        p_metadata: metadata || null,
      });

      if (error) throw error;
      await fetchHistory();
      return true;
    } catch (error: any) {
      console.error('Erro ao registrar mudança de status:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [serviceName, limit]);

  return {
    history,
    loading,
    logStatusChange,
    refetch: fetchHistory,
  };
}
