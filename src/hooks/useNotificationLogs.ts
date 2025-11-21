import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NotificationLog } from '@/types/whatsapp';

export function useNotificationLogs() {
  const [stats, setStats] = useState({
    total24h: 0,
    success24h: 0,
    errors24h: 0,
    lastSentAt: null as Date | null,
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('sent_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const success = data.filter(l => l.status === 'success').length;
        const errors = data.filter(l => l.status === 'error').length;
        const lastLog = data[0];

        setStats({
          total24h: data.length,
          success24h: success,
          errors24h: errors,
          lastSentAt: lastLog ? new Date(lastLog.sent_at) : null,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_logs')
        .select(`
          *,
          clientes:cliente_id (
            nome,
            telefone,
            data_vencimento,
            situacao
          )
        `)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) setLogs(data);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    }
  };

  useEffect(() => {
    loadStats();
    loadLogs();

    // Realtime subscription
    const channel = supabase
      .channel('notification_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_logs'
        },
        () => {
          loadStats();
          loadLogs();
        }
      )
      .subscribe();

    // Refresh a cada 30 segundos
    const interval = setInterval(() => {
      loadStats();
      loadLogs();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const addLog = async (log: Omit<NotificationLog, 'id' | 'dataEnvio'>) => {
    try {
      await supabase.from('notification_logs').insert({
        cliente_id: log.clienteId,
        phone: log.telefone,
        template_name: log.template,
        message_content: log.tipo,
        status: log.status,
        error_message: log.erro,
      });
      // Recarregar após inserir
      await loadStats();
      await loadLogs();
    } catch (error) {
      console.error('Erro ao salvar log:', error);
    }
  };

  return { addLog, stats, logs, loading, refresh: loadStats };
}
