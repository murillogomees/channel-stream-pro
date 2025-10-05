import { useState, useEffect } from 'react';
import { NotificationHistoryState, ClientNotificationHistory } from '@/types/notificationHistory';

const STORAGE_KEY = 'notification_history';

export function useNotificationHistory() {
  const [history, setHistory] = useState<NotificationHistoryState>({});

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (error) {
        console.error('Erro ao carregar histórico de notificações:', error);
      }
    }
  }, []);

  const addNotificationRecord = (
    clienteId: string,
    dataVencimento: string,
    daysBeforeDue: number,
    templateId: string,
    success: boolean
  ) => {
    setHistory(prev => {
      const clientHistory = prev[clienteId] || {
        clienteId,
        dataVencimentoAtual: dataVencimento,
        notificacoesEnviadas: [],
      };

      // Se a data de vencimento mudou, limpar histórico antigo
      if (clientHistory.dataVencimentoAtual !== dataVencimento) {
        clientHistory.notificacoesEnviadas = [];
        clientHistory.dataVencimentoAtual = dataVencimento;
      }

      // Adicionar novo registro
      clientHistory.notificacoesEnviadas.push({
        daysBeforeDue,
        sentAt: new Date().toISOString(),
        templateId,
        success,
      });

      const updated = {
        ...prev,
        [clienteId]: clientHistory,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearClientHistory = (clienteId: string) => {
    setHistory(prev => {
      const updated = { ...prev };
      delete updated[clienteId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
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

  const markPaymentDetected = (clienteId: string) => {
    setHistory(prev => {
      const clientHistory = prev[clienteId];
      if (!clientHistory) return prev;

      const updated = {
        ...prev,
        [clienteId]: {
          ...clientHistory,
          ultimoPagamentoDetectado: new Date().toISOString(),
        },
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return {
    history,
    addNotificationRecord,
    clearClientHistory,
    hasSentToday,
    getClientHistory,
    markPaymentDetected,
  };
}
