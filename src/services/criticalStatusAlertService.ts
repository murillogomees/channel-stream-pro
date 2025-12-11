/**
 * Critical Status Alert Service - Simplified
 * Monitors critical status changes and sends alerts
 */

interface CriticalStatusChange {
  serviceName: string;
  previousStatus: string | null;
  newStatus: string;
  timestamp: Date;
  metadata?: any;
}

const CRITICAL_STATUSES = ['critical', 'down', 'error', 'erro', 'failed', 'offline'];

export class CriticalStatusAlertService {
  private static instance: CriticalStatusAlertService;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastCheckedStatuses: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): CriticalStatusAlertService {
    if (!CriticalStatusAlertService.instance) {
      CriticalStatusAlertService.instance = new CriticalStatusAlertService();
    }
    return CriticalStatusAlertService.instance;
  }

  /**
   * Inicia o monitoramento automático de status críticos
   */
  public startMonitoring(intervalMs: number = 60000) {
    if (this.monitoringInterval) {
      console.warn('Monitoramento já está ativo');
      return;
    }

    console.log('Iniciando monitoramento de status críticos...');
    
    // Verificações periódicas
    this.monitoringInterval = setInterval(() => {
      this.checkCriticalStatuses();
    }, intervalMs);
  }

  /**
   * Para o monitoramento automático
   */
  public stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Monitoramento de status críticos parado');
    }
  }

  /**
   * Verifica mudanças para status críticos (simplified - logs only)
   */
  private async checkCriticalStatuses() {
    // Simplified: just log that we're checking
    console.log('[CriticalStatusAlert] Checking critical statuses...');
  }

  /**
   * Envia alerta de status crítico (simplified - logs only)
   */
  private async sendCriticalStatusAlert(change: CriticalStatusChange) {
    console.log('[CriticalStatusAlert] Alert:', {
      service: change.serviceName,
      previous: change.previousStatus,
      new: change.newStatus,
      time: change.timestamp.toISOString(),
    });
  }

  /**
   * Constrói a mensagem de alerta
   */
  private buildAlertMessage(change: CriticalStatusChange): string {
    const statusEmoji = this.getStatusEmoji(change.newStatus);
    
    return `🚨 *ALERTA DE STATUS CRÍTICO* ${statusEmoji}\n\n` +
           `*Serviço:* ${change.serviceName}\n` +
           `*Status Anterior:* ${change.previousStatus || 'Inicial'}\n` +
           `*Novo Status:* ${change.newStatus.toUpperCase()}\n` +
           `*Horário:* ${change.timestamp.toLocaleString('pt-BR')}\n\n` +
           `⚠️ *Ação necessária:* Verificar o serviço imediatamente.`;
  }

  /**
   * Retorna emoji apropriado para o status
   */
  private getStatusEmoji(status: string): string {
    const statusLower = status.toLowerCase();
    if (statusLower === 'critical') return '🔴';
    if (statusLower === 'down' || statusLower === 'offline') return '💀';
    if (statusLower === 'error' || statusLower === 'erro') return '❌';
    if (statusLower === 'failed') return '⛔';
    return '⚠️';
  }

  /**
   * Registra uma mudança de status manualmente
   */
  public async logStatusChange(
    serviceName: string,
    previousStatus: string | null,
    newStatus: string,
    metadata?: any
  ): Promise<void> {
    console.log('[CriticalStatusAlert] Status change:', {
      service: serviceName,
      previous: previousStatus,
      new: newStatus,
    });

    if (CRITICAL_STATUSES.includes(newStatus.toLowerCase())) {
      const wasNotCritical = !previousStatus || 
        !CRITICAL_STATUSES.includes(previousStatus.toLowerCase());

      if (wasNotCritical) {
        await this.sendCriticalStatusAlert({
          serviceName,
          previousStatus,
          newStatus,
          timestamp: new Date(),
          metadata,
        });
      }
    }
  }
}

export const criticalStatusAlertService = CriticalStatusAlertService.getInstance();
