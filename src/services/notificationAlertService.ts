import { NotificationLog } from '@/types/whatsapp';
import { getWhatsAppService } from './whatsapp';

const ALERT_CONFIG_KEY = 'notification_alert_config';
const ALERT_HISTORY_KEY = 'notification_alert_history';
const MAX_HISTORY = 100;

export interface AlertConfig {
  enabled: boolean;
  errorRateThreshold: number; // Porcentagem (ex: 10 para 10%)
  checkInterval: number; // A cada X notificações enviadas
  recipients: {
    phone: string;
    name: string;
    active: boolean;
  }[];
  timeWindow: number; // Janela de tempo em minutos para calcular taxa (ex: 60 para última hora)
}

export interface AlertHistory {
  id: string;
  timestamp: string;
  errorRate: number;
  totalSent: number;
  totalErrors: number;
  threshold: number;
  recipients: string[];
  messagesSent: number;
  success: boolean;
  error?: string;
}

const DEFAULT_CONFIG: AlertConfig = {
  enabled: false,
  errorRateThreshold: 10,
  checkInterval: 10,
  recipients: [],
  timeWindow: 60,
};

export class NotificationAlertService {
  private config: AlertConfig;
  private history: AlertHistory[] = [];
  private lastCheck: number = 0;
  private notificationCount: number = 0;

  constructor() {
    this.config = this.loadConfig();
    this.history = this.loadHistory();
  }

  private loadConfig(): AlertConfig {
    try {
      const stored = localStorage.getItem(ALERT_CONFIG_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[AlertService] Erro ao carregar configuração:', error);
    }
    return DEFAULT_CONFIG;
  }

  private saveConfig() {
    try {
      localStorage.setItem(ALERT_CONFIG_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('[AlertService] Erro ao salvar configuração:', error);
    }
  }

  private loadHistory(): AlertHistory[] {
    try {
      const stored = localStorage.getItem(ALERT_HISTORY_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[AlertService] Erro ao carregar histórico:', error);
    }
    return [];
  }

  private saveHistory() {
    try {
      localStorage.setItem(ALERT_HISTORY_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('[AlertService] Erro ao salvar histórico:', error);
    }
  }

  getConfig(): AlertConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<AlertConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  getHistory(): AlertHistory[] {
    return [...this.history];
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
  }

  async checkAndAlert(logs: NotificationLog[]) {
    if (!this.config.enabled) {
      return;
    }

    this.notificationCount++;

    // Verificar apenas a cada X notificações
    if (this.notificationCount < this.config.checkInterval) {
      return;
    }

    this.notificationCount = 0;

    // Calcular estatísticas da janela de tempo
    const now = Date.now();
    const windowStart = now - (this.config.timeWindow * 60 * 1000);
    
    const recentLogs = logs.filter(log => 
      new Date(log.dataEnvio).getTime() >= windowStart
    );

    if (recentLogs.length === 0) {
      return; // Não há dados suficientes
    }

    const totalErrors = recentLogs.filter(log => log.status === 'error').length;
    const errorRate = (totalErrors / recentLogs.length) * 100;

    console.log(`[AlertService] Taxa de erro: ${errorRate.toFixed(2)}% (${totalErrors}/${recentLogs.length})`);

    // Verificar se ultrapassou o limite
    if (errorRate >= this.config.errorRateThreshold) {
      await this.sendAlert(errorRate, recentLogs.length, totalErrors);
    }
  }

  private async sendAlert(errorRate: number, totalSent: number, totalErrors: number) {
    const activeRecipients = this.config.recipients.filter(r => r.active);
    
    if (activeRecipients.length === 0) {
      console.warn('[AlertService] Nenhum destinatário ativo para enviar alerta');
      return;
    }

    const message = this.buildAlertMessage(errorRate, totalSent, totalErrors);
    const whatsappService = getWhatsAppService();

    if (!whatsappService) {
      console.error('[AlertService] Serviço WhatsApp não configurado');
      this.logAlert(errorRate, totalSent, totalErrors, [], 0, false, 'Serviço WhatsApp não configurado');
      return;
    }

    let messagesSent = 0;
    let lastError: string | undefined;

    for (const recipient of activeRecipients) {
      try {
        await whatsappService.sendTextMessage(recipient.phone, message);
        messagesSent++;
        console.log(`[AlertService] Alerta enviado para ${recipient.name} (${recipient.phone})`);
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`[AlertService] Erro ao enviar alerta para ${recipient.name}:`, error);
      }
    }

    this.logAlert(
      errorRate,
      totalSent,
      totalErrors,
      activeRecipients.map(r => r.phone),
      messagesSent,
      messagesSent > 0,
      lastError
    );
  }

  private buildAlertMessage(errorRate: number, totalSent: number, totalErrors: number): string {
    return `🚨 *ALERTA DE NOTIFICAÇÕES*

Taxa de erro ultrapassou o limite configurado!

📊 *Estatísticas (últimos ${this.config.timeWindow} min):*
• Taxa de erro: *${errorRate.toFixed(1)}%*
• Limite configurado: ${this.config.errorRateThreshold}%
• Total enviado: ${totalSent}
• Total de erros: ${totalErrors}

⚠️ Recomenda-se verificar o sistema de notificações e corrigir possíveis problemas.

_Alerta automático do sistema_`;
  }

  private logAlert(
    errorRate: number,
    totalSent: number,
    totalErrors: number,
    recipients: string[],
    messagesSent: number,
    success: boolean,
    error?: string
  ) {
    const alertRecord: AlertHistory = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      errorRate,
      totalSent,
      totalErrors,
      threshold: this.config.errorRateThreshold,
      recipients,
      messagesSent,
      success,
      error,
    };

    this.history.unshift(alertRecord);

    // Limitar histórico
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(0, MAX_HISTORY);
    }

    this.saveHistory();
  }

  getStats() {
    const total = this.history.length;
    const successful = this.history.filter(h => h.success).length;
    const failed = this.history.filter(h => !h.success).length;
    const avgErrorRate = total > 0
      ? this.history.reduce((sum, h) => sum + h.errorRate, 0) / total
      : 0;

    return {
      total,
      successful,
      failed,
      avgErrorRate,
    };
  }
}

// Singleton instance
let alertServiceInstance: NotificationAlertService | null = null;

export function getAlertService(): NotificationAlertService {
  if (!alertServiceInstance) {
    alertServiceInstance = new NotificationAlertService();
  }
  return alertServiceInstance;
}
