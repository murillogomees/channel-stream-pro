import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
      // Use client_status_history table 
      const { data, error } = await supabase
        .from('client_status_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      // Map to StatusChangeHistory format
      setHistory((data || []).map(item => ({
        id: item.id,
        service_name: 'client_status',
        previous_status: item.old_status,
        new_status: item.new_status,
        changed_at: item.created_at,
        metadata: { reason: item.reason, changed_by: item.changed_by, profile_id: item.profile_id },
      })));
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
    svcName: string,
    previousStatus: string | null,
    newStatus: string,
    metadata?: any
  ) => {
    try {
      const { error } = await supabase
        .from('client_status_history')
        .insert({
          profile_id: metadata?.profile_id || null,
          old_status: previousStatus,
          new_status: newStatus,
          reason: metadata?.reason || null,
          changed_by: metadata?.changed_by || null,
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
