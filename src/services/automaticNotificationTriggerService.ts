/**
 * Serviço de Disparo de Notificações Automáticas
 * Processa regras automáticas e dispara notificações baseadas em eventos
 */

import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/cliente';
import { automaticNotificationRuleService } from './automaticNotificationRuleService';
import { activityLogService } from './activityLogService';
import type { NotificationEventType } from '@/types/automaticNotification';

export class AutomaticNotificationTriggerService {
  
  /**
   * Dispara notificações automáticas para um evento específico
   */
  async triggerEvent(
    eventType: NotificationEventType,
    cliente: Cliente,
    extraVars?: Record<string, string>
  ): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    const errors: string[] = [];
    let messagesSent = 0;

    try {
      // Buscar regras ativas para este tipo de evento
      const rules = await automaticNotificationRuleService.getActiveRulesByEventType(eventType);
      
      if (rules.length === 0) {
        console.log(`[AutoNotificationTrigger] Nenhuma regra ativa para evento: ${eventType}`);
        return { success: true, messagesSent: 0, errors: [] };
      }

      console.log(`[AutoNotificationTrigger] Processando ${rules.length} regras para evento: ${eventType}`);

      for (const rule of rules) {
        try {
          // Buscar template referenciado
          let template = null;
          
          if (rule.template_reference) {
            const { data: templateData, error: templateError } = await supabase
              .from('whatsapp_templates')
              .select('*')
              .or(`name.ilike.%${rule.template_reference}%,id.eq.${rule.template_reference}`)
              .eq('active', true)
              .maybeSingle();

            if (templateError) {
              console.error(`[AutoNotificationTrigger] Erro ao buscar template:`, templateError);
              errors.push(`Erro ao buscar template para regra ${rule.name}`);
              continue;
            }

            template = templateData;
          }

          if (!template) {
            console.log(`[AutoNotificationTrigger] Template não encontrado para regra: ${rule.name}`);
            errors.push(`Template não encontrado para regra ${rule.name}`);
            continue;
          }

          if (!cliente.telefone) {
            errors.push(`Cliente sem telefone cadastrado`);
            continue;
          }

          // Importar handler de notificação
          const { UnifiedNotificationHandler } = await import('@/services/notifications/handlers/UnifiedNotificationHandler');
          const notificationHandler = new UnifiedNotificationHandler();

          const templateFormatted = {
            id: template.id,
            name: template.name,
            message: template.message,
            variables: template.variables || [],
            type: (template.type as 'local' | 'botbot') || 'local',
            eventType: template.event_type as any,
            daysBeforeDue: template.days_before_due,
            botbotTemplateId: template.botbot_template_id,
            arquivo: template.arquivo as any,
          };

          // Enviar notificação
          const result = await notificationHandler.sendToClient(cliente, templateFormatted, extraVars);

          if (result.success) {
            messagesSent++;
            
            await activityLogService.logActivity(
              'notification_sent',
              `Notificação automática "${rule.name}" enviada para ${cliente.nome}`,
              'cliente',
              cliente.id,
              { 
                tipo: 'automatica',
                regra: rule.name,
                evento: eventType,
                template: template.name,
                telefone: cliente.telefone 
              }
            );

            console.log(`[AutoNotificationTrigger] Notificação enviada: ${rule.name} -> ${cliente.nome}`);
          } else {
            errors.push(`Falha ao enviar ${rule.name}: ${result.error}`);
          }

        } catch (ruleError: any) {
          console.error(`[AutoNotificationTrigger] Erro ao processar regra ${rule.name}:`, ruleError);
          errors.push(`Erro ao processar regra ${rule.name}: ${ruleError.message}`);
        }
      }

      return { 
        success: errors.length === 0, 
        messagesSent, 
        errors 
      };

    } catch (error: any) {
      console.error('[AutoNotificationTrigger] Erro geral:', error);
      return { 
        success: false, 
        messagesSent: 0, 
        errors: [error.message] 
      };
    }
  }

  /**
   * Dispara notificação de desativação de cliente
   */
  async triggerClientDeactivation(cliente: Cliente): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    return this.triggerEvent('client_deactivation', cliente);
  }

  /**
   * Dispara notificação de novo cadastro
   */
  async triggerClientRegistration(cliente: Cliente): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    return this.triggerEvent('client_registration', cliente);
  }

  /**
   * Dispara notificação de atualização
   */
  async triggerClientUpdate(cliente: Cliente): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    return this.triggerEvent('client_update', cliente);
  }
}

export const automaticNotificationTriggerService = new AutomaticNotificationTriggerService();
