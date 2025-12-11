/**
 * Critical Status Alert Service
 * Monitors critical status changes and sends alerts
 * Uses status_change_history table
 */

import { supabase } from '@/lib/supabase';

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
   * Verifica mudanças para status críticos
   */
  private async checkCriticalStatuses() {
    try {
      // Check recent status changes from database
      const { data, error } = await supabase
        .from('status_change_history')
        .select('*')
        .gte('changed_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('[CriticalStatusAlert] Error checking statuses:', error);
        return;
      }

      // Process recent critical changes
      for (const change of data || []) {
        if (CRITICAL_STATUSES.includes(change.new_status?.toLowerCase())) {
          const wasNotCritical = !change.previous_status || 
            !CRITICAL_STATUSES.includes(change.previous_status.toLowerCase());

          if (wasNotCritical) {
            await this.sendCriticalStatusAlert({
              serviceName: change.service_name,
              previousStatus: change.previous_status,
              newStatus: change.new_status,
              timestamp: new Date(change.changed_at),
              metadata: change.metadata,
            });
          }
        }
      }
    } catch (error) {
      console.error('[CriticalStatusAlert] Error in checkCriticalStatuses:', error);
    }
  }

  /**
   * Envia alerta de status crítico
   */
  private async sendCriticalStatusAlert(change: CriticalStatusChange) {
    const message = this.buildAlertMessage(change);
    console.log('[CriticalStatusAlert] Alert:', message);

    // Here you could send via WhatsApp or other channels
    // For now, just log it
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
    try {
      const { error } = await supabase
        .from('status_change_history')
        .insert({
          service_name: serviceName,
          previous_status: previousStatus,
          new_status: newStatus,
          changed_at: new Date().toISOString(),
          metadata,
        });

      if (error) {
        console.error('[CriticalStatusAlert] Error logging status change:', error);
      }

      // Check if this is a critical change
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
    } catch (error) {
      console.error('[CriticalStatusAlert] Error in logStatusChange:', error);
    }
  }

  /**
   * Get recent status history
   */
  public async getRecentHistory(limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('status_change_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[CriticalStatusAlert] Error getting history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[CriticalStatusAlert] Error in getRecentHistory:', error);
      return [];
    }
  }
}

export const criticalStatusAlertService = CriticalStatusAlertService.getInstance();
