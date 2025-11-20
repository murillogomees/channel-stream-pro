import { useState, useEffect } from 'react';
import { NotificationHistoryState, ClientNotificationHistory } from '@/types/notificationHistory';
import { supabase } from '@/integrations/supabase/client';

export function useNotificationHistory() {
  const [history, setHistory] = useState<NotificationHistoryState>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_history')
        .select('*')
        .order('sent_at', { ascending: false });

      if (error) throw error;

      const historyMap: NotificationHistoryState = {};
      
      data?.forEach(record => {
        if (!historyMap[record.cliente_id]) {
          historyMap[record.cliente_id] = {
            clienteId: record.cliente_id,
            dataVencimentoAtual: new Date(record.data_vencimento_atual).toISOString(),
            notificacoesEnviadas: [],
          };
        }
        
        historyMap[record.cliente_id].notificacoesEnviadas.push({
          daysBeforeDue: record.days_before_due,
          sentAt: record.sent_at,
          templateId: record.template_id || '',
          success: record.success,
        });
      });

      setHistory(historyMap);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNotificationRecord = async (
    clienteId: string,
    dataVencimento: string,
    daysBeforeDue: number,
    templateId: string,
    success: boolean
  ) => {
    try {
      const { error } = await supabase
        .from('notification_history')
        .insert({
          cliente_id: clienteId,
          data_vencimento_atual: dataVencimento,
          days_before_due: daysBeforeDue,
          template_id: templateId,
          success,
        });

      if (error) throw error;

      setHistory(prev => {
        const clientHistory = prev[clienteId] || {
          clienteId,
          dataVencimentoAtual: dataVencimento,
          notificacoesEnviadas: [],
        };

        if (clientHistory.dataVencimentoAtual !== dataVencimento) {
          clientHistory.notificacoesEnviadas = [];
          clientHistory.dataVencimentoAtual = dataVencimento;
        }

        clientHistory.notificacoesEnviadas.push({
          daysBeforeDue,
          sentAt: new Date().toISOString(),
          templateId,
          success,
        });

        return {
          ...prev,
          [clienteId]: clientHistory,
        };
      });
    } catch (error) {
      console.error('Erro ao adicionar registro:', error);
    }
  };

  const clearClientHistory = async (clienteId: string) => {
    try {
      const { error } = await supabase
        .from('notification_history')
        .delete()
        .eq('cliente_id', clienteId);

      if (error) throw error;

      setHistory(prev => {
        const updated = { ...prev };
        delete updated[clienteId];
        return updated;
      });
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
    }
  };

  const hasSentToday = (clienteId: string, daysBeforeDue: number): boolean => {
    const clientHistory = history[clienteId];
    if (!clientHistory) return false;

    const today = new Date().toDateString();
    return clientHistory.notificacoesEnviadas.some(record => {
      const recordDate = new Date(record.sentAt).toDateString();
      return recordDate === today && record.daysBeforeDue === daysBeforeDue && record.success;
    });
  };

  const getClientHistory = (clienteId: string): ClientNotificationHistory | undefined => {
    return history[clienteId];
  };

  const markPaymentDetected = async (clienteId: string) => {
    try {
      setHistory(prev => {
        const clientHistory = prev[clienteId];
        if (!clientHistory) return prev;

        return {
          ...prev,
          [clienteId]: {
            ...clientHistory,
            ultimoPagamentoDetectado: new Date().toISOString(),
          },
        };
      });
    } catch (error) {
      console.error('Erro ao marcar pagamento:', error);
    }
  };

  return {
    history,
    loading,
    addNotificationRecord,
    clearClientHistory,
    hasSentToday,
    getClientHistory,
    markPaymentDetected,
  };
}
