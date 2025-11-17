import { useEffect } from 'react';
import { getAlertService } from '@/services/notificationAlertService';
import { useNotificationLogs } from './useNotificationLogs';
import { getRealtimeService } from '@/services/realtimeNotificationService';
import { getDesktopNotificationService } from '@/services/desktopNotificationService';

export function useNotificationAlerts() {
  const { logs } = useNotificationLogs();
  const alertService = getAlertService();
  const realtimeService = getRealtimeService();
  const desktopService = getDesktopNotificationService();

  useEffect(() => {
    // Verificar alertas sempre que houver novos logs
    if (logs.length > 0) {
      alertService.checkAndAlert(logs);
    }
  }, [logs.length]);

  useEffect(() => {
    // Conectar ao serviço de realtime
    realtimeService.connect();

    // Inscrever-se para eventos de erro e alertas de playlist
    const listenerId = 'desktop-notifications';
    realtimeService.subscribe(listenerId, (event) => {
      if (event.type === 'notification_failed') {
        desktopService.notifyError(event);
      } else if (event.type === 'batch_completed' && event.data.errorCount && event.data.errorCount > 0) {
        desktopService.notifyBatchError(
          event.data.successCount || 0,
          event.data.errorCount
        );
      }
    });

    // Inscrever-se também para eventos de alertas de playlist inativa
    const playlistListenerId = 'playlist-alerts';
    realtimeService.subscribe(playlistListenerId, (event) => {
      if (event.type === 'playlist_inactive_alert') {
        desktopService.notifyPlaylistAlert(event);
      }
    });

    return () => {
      realtimeService.unsubscribe(listenerId);
      realtimeService.unsubscribe(playlistListenerId);
    };
  }, []);

  return { alertService };
}
