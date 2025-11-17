import { RealtimeNotificationEvent } from './realtimeNotificationService';

class DesktopNotificationService {
  private enabled: boolean = false;
  private permission: NotificationPermission = 'default';

  constructor() {
    this.loadSettings();
    this.permission = this.getPermission();
  }

  private loadSettings() {
    const settings = localStorage.getItem('desktop_notification_settings');
    if (settings) {
      try {
        const data = JSON.parse(settings);
        this.enabled = data.enabled || false;
      } catch (error) {
        console.error('[Desktop Notifications] Erro ao carregar configurações:', error);
      }
    }
  }

  private saveSettings() {
    localStorage.setItem('desktop_notification_settings', JSON.stringify({
      enabled: this.enabled,
      updatedAt: new Date().toISOString()
    }));
  }

  getPermission(): NotificationPermission {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('[Desktop Notifications] API não suportada neste navegador');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      this.permission = await Notification.requestPermission();
      console.log('[Desktop Notifications] Permissão:', this.permission);
      return this.permission === 'granted';
    } catch (error) {
      console.error('[Desktop Notifications] Erro ao solicitar permissão:', error);
      return false;
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.permission === 'granted';
  }

  async setEnabled(enabled: boolean): Promise<boolean> {
    if (enabled && this.permission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) {
        return false;
      }
    }

    this.enabled = enabled;
    this.saveSettings();
    console.log('[Desktop Notifications] Status:', enabled ? 'Ativadas' : 'Desativadas');
    return true;
  }

  async notifyError(event: RealtimeNotificationEvent) {
    if (!this.isEnabled()) {
      return;
    }

    try {
      const { data } = event;
      const title = '🔴 Erro no Envio de Notificação';
      
      let body = 'Falha ao enviar notificação WhatsApp';
      if (data.clienteNome) {
        body = `Erro ao enviar para ${data.clienteNome}`;
      }
      if (data.error) {
        body += `\n${data.error}`;
      }

      const notification = new Notification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'notification-error',
        requireInteraction: true,
        silent: false,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        // Navegar para o dashboard ao vivo
        if (window.location.pathname !== '/admin/notificacoes/live') {
          window.location.href = '/admin/notificacoes/live';
        }
      };

      console.log('[Desktop Notifications] Notificação de erro enviada');
    } catch (error) {
      console.error('[Desktop Notifications] Erro ao criar notificação:', error);
    }
  }

  async notifyBatchError(successCount: number, errorCount: number) {
    if (!this.isEnabled() || errorCount === 0) {
      return;
    }

    try {
      const errorRate = (errorCount / (successCount + errorCount)) * 100;
      const title = '⚠️ Lote com Erros Detectado';
      const body = `${errorCount} falhas em ${successCount + errorCount} envios (${errorRate.toFixed(1)}% de erro)`;

      const notification = new Notification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'batch-error',
        requireInteraction: true,
        silent: false,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (window.location.pathname !== '/admin/notificacoes/live') {
          window.location.href = '/admin/notificacoes/live';
        }
      };

      console.log('[Desktop Notifications] Notificação de lote com erros enviada');
    } catch (error) {
      console.error('[Desktop Notifications] Erro ao criar notificação:', error);
    }
  }

  async notifyPlaylistAlert(event: RealtimeNotificationEvent) {
    if (!this.isEnabled()) {
      return;
    }

    try {
      const { data } = event;
      const title = '🚨 Alerta: Playlists Inativas';
      
      let body = 'Foram detectadas playlists com problemas';
      if (data.batchSize) {
        body = `${data.batchSize} playlists inativas detectadas`;
      }

      const notification = new Notification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'playlist-alert',
        requireInteraction: true,
        silent: false,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        // Navegar para a página de health das playlists
        if (window.location.pathname !== '/admin/playlist-health') {
          window.location.href = '/admin/playlist-health';
        }
      };

      console.log('[Desktop Notifications] Notificação de playlist enviada');
    } catch (error) {
      console.error('[Desktop Notifications] Erro ao criar notificação de playlist:', error);
    }
  }

  async testNotification() {
    if (!this.isEnabled()) {
      const granted = await this.requestPermission();
      if (!granted) {
        throw new Error('Permissão de notificações negada');
      }
      this.enabled = true;
      this.saveSettings();
    }

    const notification = new Notification('✅ Teste de Notificação', {
      body: 'Notificações de desktop estão funcionando corretamente!',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'test-notification',
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    console.log('[Desktop Notifications] Notificação de teste enviada');
  }
}

// Singleton instance
let desktopNotificationServiceInstance: DesktopNotificationService | null = null;

export function getDesktopNotificationService(): DesktopNotificationService {
  if (!desktopNotificationServiceInstance) {
    desktopNotificationServiceInstance = new DesktopNotificationService();
  }
  return desktopNotificationServiceInstance;
}
