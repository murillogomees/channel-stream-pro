import { useEffect } from 'react';
import { getAlertService } from '@/services/notificationAlertService';
import { useNotificationLogs } from './useNotificationLogs';

export function useNotificationAlerts() {
  const { logs } = useNotificationLogs();
  const alertService = getAlertService();

  useEffect(() => {
    // Verificar alertas sempre que houver novos logs
    if (logs.length > 0) {
      alertService.checkAndAlert(logs);
    }
  }, [logs.length]); // Dispara quando há mudança no número de logs

  return { alertService };
}
