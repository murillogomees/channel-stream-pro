/**
 * Serviço de Disparo de Notificações Automáticas
 * Processa regras automáticas e dispara notificações baseadas em eventos
 */

import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/cliente';
import { automaticNotificationRuleService } from './automaticNotificationRuleService';
import { activityLogService } from './activityLogService';

export class AutomaticNotificationTriggerService {
  
  /**
   * Dispara notificações automáticas para um evento específico
   */
  async triggerEvent(
    eventType: string,
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
        return { success: true, messagesSent: 0, errors: [`Nenhuma regra ativa para ${eventType}`] };
      }

      console.log(`[AutoNotificationTrigger] Processando ${rules.length} regras para evento: ${eventType}`);

      for (const rule of rules) {
        try {
          // Buscar template referenciado
          let template = null;
          
          if (rule.template_reference) {
            // Primeiro tenta busca exata pelo nome
            let { data: templateData, error: templateError } = await supabase
              .from('whatsapp_templates')
              .select('*')
              .eq('name', rule.template_reference)
              .eq('active', true)
              .maybeSingle();

            // Se não encontrou, tenta busca parcial
            if (!templateData && !templateError) {
              const { data: partialData, error: partialError } = await supabase
                .from('whatsapp_templates')
                .select('*')
                .ilike('name', `%${rule.template_reference}%`)
                .eq('active', true)
                .limit(1)
                .maybeSingle();
              
              if (!partialError) {
                templateData = partialData;
              }
            }

            if (templateError) {
              console.error(`[AutoNotificationTrigger] Erro ao buscar template:`, templateError);
              errors.push(`Erro ao buscar template para regra ${rule.name}`);
              continue;
            }

            template = templateData;
          }

          if (!template) {
            console.log(`[AutoNotificationTrigger] Template não encontrado para regra: ${rule.name}, ref: ${rule.template_reference}`);
            errors.push(`Template "${rule.template_reference}" não encontrado para regra ${rule.name}`);
            continue;
          }
          
          console.log(`[AutoNotificationTrigger] Template encontrado: ${template.name} para regra ${rule.name}`);

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

  /**
   * Dispara notificação de reativação de cliente
   */
  async triggerClientReactivation(cliente: Cliente): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    return this.triggerEvent('client_reactivation', cliente);
  }

  /**
   * Dispara notificação de upgrade de plano
   */
  async triggerPlanUpgrade(cliente: Cliente): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    return this.triggerEvent('plan_upgrade', cliente);
  }

  /**
   * Dispara notificação de downgrade de plano
   */
  async triggerPlanDowngrade(cliente: Cliente): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    return this.triggerEvent('plan_downgrade', cliente);
  }

  /**
   * Dispara notificação de trial expirando
   */
  async triggerTrialExpiring(cliente: Cliente, daysRemaining: number): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    return this.triggerEvent('trial_expiring', cliente, { diasRestantes: String(daysRemaining) });
  }

  /**
   * Dispara notificação de trial expirado
   */
  async triggerTrialExpired(cliente: Cliente): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    return this.triggerEvent('trial_expired', cliente);
  }

  /**
   * Dispara notificação de assinatura expirada
   */
  async triggerSubscriptionExpired(cliente: Cliente, daysAfter: number): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    return this.triggerEvent('subscription_expired', cliente, { diasExpirado: String(daysAfter) });
  }

  /**
   * Dispara notificação de usuário inativo
   */
  async triggerUserInactive(cliente: Cliente, daysInactive: number): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    return this.triggerEvent('user_inactive', cliente, { diasInativo: String(daysInactive) });
  }

  /**
   * Dispara notificação de pagamento recebido
   */
  async triggerPaymentReceived(cliente: Cliente): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    return this.triggerEvent('payment_received', cliente);
  }

  /**
   * Dispara notificação de pagamento pendente
   */
  async triggerPaymentPending(cliente: Cliente): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    return this.triggerEvent('payment_pending', cliente);
  }

  /**
   * Dispara notificação de pagamento falhou
   */
  async triggerPaymentFailed(cliente: Cliente): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
    return this.triggerEvent('payment_failed', cliente);
  }

  /**
   * Processa clientes inativos e dispara notificações
   * Esta função deve ser chamada por um job agendado (cron)
   */
  async processInactiveUsers(): Promise<{ processed: number; notified: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;
    let notified = 0;

    try {
      // Buscar regras de inatividade ativas
      const rules = await automaticNotificationRuleService.getActiveRulesByEventType('user_inactive');
      
      if (rules.length === 0) {
        console.log('[AutoNotificationTrigger] Nenhuma regra de inatividade ativa');
        return { processed: 0, notified: 0, errors: [] };
      }

      // Processar cada regra de inatividade
      for (const rule of rules) {
        if (!rule.days_before) continue;

        const daysInactive = rule.days_before;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

        // Buscar clientes inativos
        const { data: inactiveClients, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('cliente_ativo', true)
          .lt('updated_at', cutoffDate.toISOString())
          .not('telefone', 'is', null);

        if (error) {
          console.error('[AutoNotificationTrigger] Erro ao buscar clientes inativos:', error);
          errors.push(`Erro ao buscar clientes inativos: ${error.message}`);
          continue;
        }

        console.log(`[AutoNotificationTrigger] Encontrados ${inactiveClients?.length || 0} clientes inativos há ${daysInactive} dias`);

        for (const profile of inactiveClients || []) {
          processed++;
          
          const cliente: Cliente = {
            id: profile.id,
            nome: profile.nome,
            telefone: profile.telefone || '',
            email: profile.email || '',
            situacao: profile.situacao || 'Ativo',
            plano: profile.plano || 'Mensal',
            dataContratacao: profile.data_contratacao || '',
            dataVencimento: profile.data_vencimento || '',
            valorPago: profile.valor_pago || 0,
            clienteAtivo: profile.cliente_ativo ?? true,
            dataCadastro: profile.created_at || '',
            dataUltimaEdicao: profile.updated_at || '',
          };

          const result = await this.triggerUserInactive(cliente, daysInactive);
          
          if (result.messagesSent > 0) {
            notified++;
          }
          
          if (result.errors.length > 0) {
            errors.push(...result.errors);
          }
        }
      }

      return { processed, notified, errors };

    } catch (error: any) {
      console.error('[AutoNotificationTrigger] Erro ao processar usuários inativos:', error);
      return { processed: 0, notified: 0, errors: [error.message] };
    }
  }

  /**
   * Processa clientes com assinatura expirando e dispara notificações
   * Esta função deve ser chamada por um job agendado (cron)
   */
  async processExpiringSubscriptions(): Promise<{ processed: number; notified: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;
    let notified = 0;

    try {
      // Buscar regras de vencimento ativas
      const rules = await automaticNotificationRuleService.getActiveRulesByEventType('payment_due');
      
      if (rules.length === 0) {
        console.log('[AutoNotificationTrigger] Nenhuma regra de vencimento ativa');
        return { processed: 0, notified: 0, errors: [] };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const rule of rules) {
        if (rule.days_before === null || rule.days_before === undefined) continue;

        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + rule.days_before);
        const targetDateStr = targetDate.toISOString().split('T')[0];

        // Buscar clientes com vencimento nesta data
        const { data: expiringClients, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('cliente_ativo', true)
          .eq('data_vencimento', targetDateStr)
          .not('telefone', 'is', null);

        if (error) {
          console.error('[AutoNotificationTrigger] Erro ao buscar clientes:', error);
          errors.push(`Erro: ${error.message}`);
          continue;
        }

        console.log(`[AutoNotificationTrigger] Encontrados ${expiringClients?.length || 0} clientes com vencimento em ${rule.days_before} dias`);

        for (const profile of expiringClients || []) {
          processed++;
          
          const cliente: Cliente = {
            id: profile.id,
            nome: profile.nome,
            telefone: profile.telefone || '',
            email: profile.email || '',
            situacao: profile.situacao || 'Ativo',
            plano: profile.plano || 'Mensal',
            dataContratacao: profile.data_contratacao || '',
            dataVencimento: profile.data_vencimento || '',
            valorPago: profile.valor_pago || 0,
            clienteAtivo: profile.cliente_ativo ?? true,
            dataCadastro: profile.created_at || '',
            dataUltimaEdicao: profile.updated_at || '',
          };

          const result = await this.triggerEvent('payment_due', cliente, { diasRestantes: String(rule.days_before) });
          
          if (result.messagesSent > 0) {
            notified++;
          }
          
          if (result.errors.length > 0) {
            errors.push(...result.errors);
          }
        }
      }

      return { processed, notified, errors };

    } catch (error: any) {
      console.error('[AutoNotificationTrigger] Erro ao processar vencimentos:', error);
      return { processed: 0, notified: 0, errors: [error.message] };
    }
  }
}

export const automaticNotificationTriggerService = new AutomaticNotificationTriggerService();
