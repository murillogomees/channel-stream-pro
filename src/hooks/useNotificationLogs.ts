import { useState, useEffect } from 'react';
import { NotificationLog } from '@/types/whatsapp';

const MAX_LOGS = 1000;

export function useNotificationLogs() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('notification_logs');
    if (stored) {
      try {
        setLogs(JSON.parse(stored));
      } catch (error) {
        console.error('Erro ao carregar logs:', error);
      }
    }
  }, []);

  const addLog = (log: Omit<NotificationLog, 'id' | 'dataEnvio'>) => {
    const newLog: NotificationLog = {
      ...log,
      id: crypto.randomUUID(),
      dataEnvio: new Date().toISOString(),
    };

    setLogs(prev => {
      const updated = [newLog, ...prev].slice(0, MAX_LOGS);
      localStorage.setItem('notification_logs', JSON.stringify(updated));
      return updated;
    });

    return newLog;
  };

  const clearLogs = () => {
    setLogs([]);
    localStorage.removeItem('notification_logs');
  };

  const getLogsByCliente = (clienteId: string) => {
    return logs.filter(log => log.clienteId === clienteId);
  };

  const getRecentLogs = (limit: number = 50) => {
    return logs.slice(0, limit);
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Cliente', 'Telefone', 'Tipo', 'Status', 'Erro'];
    const rows = logs.map(log => [
      new Date(log.dataEnvio).toLocaleString('pt-BR'),
      log.clienteNome,
      log.telefone,
      log.tipo,
      log.status,
      log.erro || '',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `notificacoes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return {
    logs,
    addLog,
    clearLogs,
    getLogsByCliente,
    getRecentLogs,
    exportToCSV,
  };
}
