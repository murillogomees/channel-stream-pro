/**
 * useNotificationLogs - Hook simplificado para logs de notificação
 * Usa a tabela notification_logs existente
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationLog {
  id: string;
  clienteId?: string;
  clienteNome: string;
  telefone: string;
  template: string;
  tipo?: string;
  status: 'success' | 'error' | 'pending';
  dataEnvio: string;
  erro?: string;
  resposta?: any;
  arquivoEnviado?: {
    nome: string;
    tipo: string;
    tamanho: number;
  };
}

export interface NotificationStats {
  total24h: number;
  success24h: number;
  errors24h: number;
  lastSentAt?: Date;
}

export function useNotificationLogs() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total24h: 0,
    success24h: 0,
    errors24h: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const mappedLogs: NotificationLog[] = (data || []).map(log => ({
        id: log.id,
        clienteId: log.recipient_id || undefined,
        clienteNome: log.recipient_phone || 'N/A',
        telefone: log.recipient_phone || '',
        template: log.template_key || 'Manual',
        status: (log.status as 'success' | 'error' | 'pending') || 'pending',
        dataEnvio: log.sent_at || log.created_at,
        erro: log.error_message || undefined,
      }));

      setLogs(mappedLogs);

      // Calculate stats
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recent = mappedLogs.filter(l => new Date(l.dataEnvio) > last24h);

      setStats({
        total24h: recent.length,
        success24h: recent.filter(l => l.status === 'success').length,
        errors24h: recent.filter(l => l.status === 'error').length,
        lastSentAt: mappedLogs[0] ? new Date(mappedLogs[0].dataEnvio) : undefined,
      });
    } catch (error) {
      console.error('Error fetching notification logs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const addLog = useCallback(async (log: Omit<NotificationLog, 'id' | 'dataEnvio'>) => {
    try {
      await supabase.from('notification_logs').insert({
        recipient_id: log.clienteId,
        recipient_phone: log.telefone,
        template_key: log.template,
        status: log.status,
        error_message: log.erro,
        sent_at: new Date().toISOString(),
      });
      
      // Add to local state immediately
      const newLog: NotificationLog = {
        ...log,
        id: crypto.randomUUID(),
        dataEnvio: new Date().toISOString(),
      };
      setLogs(prev => [newLog, ...prev]);
    } catch (error) {
      console.error('Error adding notification log:', error);
    }
  }, []);

  return {
    logs,
    stats,
    loading,
    refresh: fetchLogs,
    addLog,
  };
}

export default useNotificationLogs;
