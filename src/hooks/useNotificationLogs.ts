import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
        .from('sent_notifications')
        .select('*')
        .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('sent_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const success = data.filter(l => l.status === 'sent').length;
        const errors = data.filter(l => l.status === 'failed').length;
        const lastLog = data[0];

        setStats({
          total24h: data.length,
          success24h: success,
          errors24h: errors,
          lastSentAt: lastLog?.sent_at ? new Date(lastLog.sent_at) : null,
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
        .from('sent_notifications')
        .select(`
          *,
          profiles:recipient_id (
            nome,
            contact_phone,
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

    const channel = supabase
      .channel('sent_notifications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sent_notifications'
        },
        () => {
          loadStats();
          loadLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addLog = async (log: {
    clienteId: string;
    clienteNome?: string;
    telefone: string;
    template: string;
    tipo: string;
    status: string;
    erro?: string;
    resposta?: any;
    arquivoEnviado?: {
      nome: string;
      tipo: string;
      tamanho: number;
    };
  }) => {
    try {
      await supabase.from('sent_notifications').insert({
        recipient_id: log.clienteId,
        recipient_phone: log.telefone,
        template_key: log.template,
        message_content: log.tipo,
        status: log.status === 'success' ? 'sent' : 'failed',
        error_message: log.erro,
      });
      await loadStats();
      await loadLogs();
    } catch (error) {
      console.error('Erro ao salvar log:', error);
    }
  };

  return { addLog, stats, logs, loading, refresh: loadStats };
}
