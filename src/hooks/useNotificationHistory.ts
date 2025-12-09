import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationRecord {
  daysBeforeDue: number;
  sentAt: string;
  templateId: string;
  success: boolean;
}

export interface ClientNotificationHistory {
  clienteId: string;
  dataVencimentoAtual: string;
  notificacoesEnviadas: NotificationRecord[];
  ultimoPagamentoDetectado?: string;
}

export interface NotificationHistoryState {
  [clienteId: string]: ClientNotificationHistory;
}

export function useNotificationHistory() {
  const [history, setHistory] = useState<NotificationHistoryState>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      // Use sent_notifications table instead of notification_history
      const { data, error } = await supabase
        .from('sent_notifications')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const historyMap: NotificationHistoryState = {};
      
      data?.forEach(record => {
        const recipientId = record.recipient_id || 'unknown';
        if (!historyMap[recipientId]) {
          historyMap[recipientId] = {
            clienteId: recipientId,
            dataVencimentoAtual: new Date().toISOString(),
            notificacoesEnviadas: [],
          };
        }
        
        historyMap[recipientId].notificacoesEnviadas.push({
          daysBeforeDue: 0,
          sentAt: record.sent_at || new Date().toISOString(),
          templateId: record.template_key || '',
          success: record.status === 'sent',
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
      // Get profile phone
      const { data: profile } = await supabase
        .from('profiles')
        .select('contact_phone')
        .eq('id', clienteId)
        .single();

      const { error } = await supabase
        .from('sent_notifications')
        .insert({
          recipient_id: clienteId,
          recipient_phone: profile?.contact_phone || '',
          template_key: templateId,
          status: success ? 'sent' : 'failed',
          message_content: `Notification for ${daysBeforeDue} days before due`,
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
        .from('sent_notifications')
        .delete()
        .eq('recipient_id', clienteId);

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
