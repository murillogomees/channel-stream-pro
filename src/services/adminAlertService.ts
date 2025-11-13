import { getDesktopNotificationService } from './desktopNotificationService';

export interface AdminAlert {
  id: string;
  type: 'websocket_fallback' | 'service_down' | 'high_error_rate' | 'critical_failure';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  data?: any;
}

interface AlertRule {
  id: string;
  type: AdminAlert['type'];
  enabled: boolean;
  cooldownMs: number;
  lastTriggered: number | null;
}

class AdminAlertService {
  private alerts: AdminAlert[] = [];
  private maxAlerts = 100;
  private listeners: Map<string, (alert: AdminAlert) => void> = new Map();
  private desktopService = getDesktopNotificationService();
  
  private alertRules: AlertRule[] = [
    {
      id: 'websocket_fallback',
      type: 'websocket_fallback',
      enabled: true,
      cooldownMs: 5 * 60 * 1000, // 5 minutes
      lastTriggered: null,
    },
    {
      id: 'service_down',
      type: 'service_down',
      enabled: true,
      cooldownMs: 10 * 60 * 1000, // 10 minutes
      lastTriggered: null,
    },
    {
      id: 'high_error_rate',
      type: 'high_error_rate',
      enabled: true,
      cooldownMs: 15 * 60 * 1000, // 15 minutes
      lastTriggered: null,
    },
    {
      id: 'critical_failure',
      type: 'critical_failure',
      enabled: true,
      cooldownMs: 2 * 60 * 1000, // 2 minutes
      lastTriggered: null,
    },
  ];

  constructor() {
    this.loadAlertsFromStorage();
    this.requestNotificationPermission();
  }

  private async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.error('[AdminAlert] Erro ao solicitar permissão de notificação:', error);
      }
    }
  }

  private loadAlertsFromStorage() {
    try {
      const stored = localStorage.getItem('admin_alerts');
      if (stored) {
        this.alerts = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[AdminAlert] Erro ao carregar alertas:', error);
    }
  }

  private saveAlertsToStorage() {
    try {
      localStorage.setItem('admin_alerts', JSON.stringify(this.alerts));
    } catch (error) {
      console.error('[AdminAlert] Erro ao salvar alertas:', error);
    }
  }

  private canTriggerAlert(type: AdminAlert['type']): boolean {
    const rule = this.alertRules.find(r => r.type === type);
    if (!rule || !rule.enabled) return false;
    
    if (!rule.lastTriggered) return true;
    
    return Date.now() - rule.lastTriggered > rule.cooldownMs;
  }

  private updateAlertRule(type: AdminAlert['type']) {
    const rule = this.alertRules.find(r => r.type === type);
    if (rule) {
      rule.lastTriggered = Date.now();
    }
  }

  createAlert(params: {
    type: AdminAlert['type'];
    severity: AdminAlert['severity'];
    title: string;
    message: string;
    data?: any;
  }): AdminAlert | null {
    if (!this.canTriggerAlert(params.type)) {
      console.log(`[AdminAlert] Alerta ${params.type} em cooldown, ignorando`);
      return null;
    }

    const alert: AdminAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: params.type,
      severity: params.severity,
      title: params.title,
      message: params.message,
      timestamp: Date.now(),
      acknowledged: false,
      data: params.data,
    };

    this.alerts.unshift(alert);
    
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }

    this.updateAlertRule(params.type);
    this.saveAlertsToStorage();
    this.notifyListeners(alert);
    this.sendDesktopNotification(alert);
    
    console.log('[AdminAlert] Novo alerta criado:', alert);
    return alert;
  }

  private sendDesktopNotification(alert: AdminAlert) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const icon = this.getAlertIcon(alert.severity);
      
      new Notification(alert.title, {
        body: alert.message,
        icon: icon,
        tag: alert.type,
        requireInteraction: alert.severity === 'critical',
      });
    }
  }

  private getAlertIcon(severity: AdminAlert['severity']): string {
    switch (severity) {
      case 'critical':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  }

  // Specific alert creators
  alertWebSocketFallback(data: any) {
    return this.createAlert({
      type: 'websocket_fallback',
      severity: 'critical',
      title: 'WebSocket em Modo Fallback',
      message: 'O sistema WebSocket entrou em modo fallback após múltiplas falhas de conexão. Reconexões automáticas estão em andamento.',
      data,
    });
  }

  alertServiceDown(serviceName: string, error?: string) {
    return this.createAlert({
      type: 'service_down',
      severity: 'critical',
      title: `Serviço Indisponível: ${serviceName}`,
      message: `O serviço ${serviceName} está fora do ar. ${error || 'Verifique a configuração e conectividade.'}`,
      data: { serviceName, error },
    });
  }

  alertHighErrorRate(errorRate: number, context: string) {
    return this.createAlert({
      type: 'high_error_rate',
      severity: 'warning',
      title: 'Taxa de Erros Elevada',
      message: `Taxa de erros de ${(errorRate * 100).toFixed(1)}% detectada em ${context}. Recomenda-se investigação.`,
      data: { errorRate, context },
    });
  }

  alertCriticalFailure(context: string, error: string) {
    return this.createAlert({
      type: 'critical_failure',
      severity: 'critical',
      title: 'Falha Crítica do Sistema',
      message: `Falha crítica detectada: ${context}. Erro: ${error}`,
      data: { context, error },
    });
  }

  // Alert management
  acknowledgeAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.saveAlertsToStorage();
    }
  }

  acknowledgeAllAlerts() {
    this.alerts.forEach(alert => {
      alert.acknowledged = true;
    });
    this.saveAlertsToStorage();
  }

  clearAlert(alertId: string) {
    this.alerts = this.alerts.filter(a => a.id !== alertId);
    this.saveAlertsToStorage();
  }

  clearAllAlerts() {
    this.alerts = [];
    this.saveAlertsToStorage();
  }

  // Getters
  getAlerts(): AdminAlert[] {
    return [...this.alerts];
  }

  getUnacknowledgedAlerts(): AdminAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  getAlertsBySeverity(severity: AdminAlert['severity']): AdminAlert[] {
    return this.alerts.filter(a => a.severity === severity);
  }

  getCriticalAlertsCount(): number {
    return this.alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;
  }

  // Subscriptions
  subscribe(id: string, callback: (alert: AdminAlert) => void) {
    this.listeners.set(id, callback);
  }

  unsubscribe(id: string) {
    this.listeners.delete(id);
  }

  private notifyListeners(alert: AdminAlert) {
    this.listeners.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('[AdminAlert] Erro ao notificar listener:', error);
      }
    });
  }

  // Rule management
  enableAlertType(type: AdminAlert['type']) {
    const rule = this.alertRules.find(r => r.type === type);
    if (rule) {
      rule.enabled = true;
    }
  }

  disableAlertType(type: AdminAlert['type']) {
    const rule = this.alertRules.find(r => r.type === type);
    if (rule) {
      rule.enabled = false;
    }
  }

  setAlertCooldown(type: AdminAlert['type'], cooldownMs: number) {
    const rule = this.alertRules.find(r => r.type === type);
    if (rule) {
      rule.cooldownMs = cooldownMs;
    }
  }

  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }
}

// Singleton
let adminAlertInstance: AdminAlertService | null = null;

export function getAdminAlertService(): AdminAlertService {
  if (!adminAlertInstance) {
    adminAlertInstance = new AdminAlertService();
  }
  return adminAlertInstance;
}
