/**
 * Automatic Notification Trigger Service - Simplified
 */

import { automaticNotificationRuleService } from './automaticNotificationRuleService';
import { activityLogService } from './activityLogService';

export class AutomaticNotificationTriggerService {
  async triggerEvent(
    eventType: string,
    cliente: any,
    extraVars?: Record<string, string>
  ): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    const errors: string[] = [];
    let messagesSent = 0;

    try {
      const rules = await automaticNotificationRuleService.getActiveRulesByEventType(eventType);
      
      if (rules.length === 0) {
        console.log(`[AutoNotificationTrigger] Nenhuma regra ativa para evento: ${eventType}`);
        return { success: true, messagesSent: 0, errors: [] };
      }

      console.log(`[AutoNotificationTrigger] Processando ${rules.length} regras para evento: ${eventType}`);

      for (const rule of rules) {
        try {
          // Simulação de envio - em produção integraria com WhatsApp
          console.log(`[AutoNotificationTrigger] Processando regra: ${rule.name}`);
          
          await activityLogService.logActivity(
            'notification_triggered',
            `Notificação automática "${rule.name}" disparada para ${cliente.nome}`,
            'cliente',
            cliente.id,
            { 
              tipo: 'automatica',
              regra: rule.name,
              evento: eventType,
            }
          );

          messagesSent++;
        } catch (ruleError: any) {
          console.error(`[AutoNotificationTrigger] Erro ao processar regra ${rule.name}:`, ruleError);
          errors.push(`Erro ao processar regra ${rule.name}: ${ruleError.message}`);
        }
      }

      return { success: errors.length === 0, messagesSent, errors };
    } catch (error: any) {
      console.error('[AutoNotificationTrigger] Erro geral:', error);
      return { success: false, messagesSent: 0, errors: [error.message] };
    }
  }

  async triggerClientDeactivation(cliente: any) {
    return this.triggerEvent('client_deactivation', cliente);
  }

  async triggerClientRegistration(cliente: any) {
    return this.triggerEvent('client_registration', cliente);
  }

  async triggerClientUpdate(cliente: any) {
    return this.triggerEvent('client_update', cliente);
  }

  async triggerPaymentReceived(cliente: any) {
    return this.triggerEvent('payment_received', cliente);
  }

  async processInactiveUsers() {
    return { processed: 0, notified: 0, errors: [] };
  }

  async processExpiringSubscriptions() {
    return { processed: 0, notified: 0, errors: [] };
  }
}

export const automaticNotificationTriggerService = new AutomaticNotificationTriggerService();
