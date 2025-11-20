/**
 * Handler Unificado de Notificações
 * Consolida lógica de envio de notificações para clientes, admins e prospects
 */

import { Cliente } from '@/types/cliente';
import { WhatsappTemplate } from '@/types/whatsapp';
import { WhatsAppClient } from '../core/WhatsAppClient';
import { TemplateEngine } from '../core/TemplateEngine';
import { ConfigManager } from '../core/ConfigManager';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface NotificationLog {
  cliente_id?: string;
  phone: string;
  template_name: string;
  status: 'success' | 'error';
  message_content: string;
  error_message?: string;
}

export class UnifiedNotificationHandler {
  private whatsappClient: WhatsAppClient | null = null;
  private templateEngine: TemplateEngine;
  private configManager: ConfigManager;

  constructor() {
    this.templateEngine = new TemplateEngine();
    this.configManager = new ConfigManager();
  }

  /**
   * Inicializa cliente WhatsApp
   */
  private async ensureWhatsAppClient(): Promise<WhatsAppClient> {
    if (this.whatsappClient) return this.whatsappClient;

    const credentials = await this.configManager.getWhatsAppCredentials();
    if (!credentials) {
      throw new Error('Credenciais WhatsApp não configuradas');
    }

    this.whatsappClient = new WhatsAppClient(credentials);
    return this.whatsappClient;
  }

  /**
   * Envia notificação para cliente com template
   */
  async sendToClient(
    cliente: Cliente,
    template: WhatsappTemplate,
    extraVars?: Record<string, string>
  ): Promise<NotificationResult> {
    try {
      if (!cliente.telefone) {
        throw new Error('Cliente sem telefone cadastrado');
      }

      const whatsapp = await this.ensureWhatsAppClient();
      const message = this.templateEngine.fillTemplate(template, cliente, extraVars);

      let response;

      // Enviar com arquivo se template tiver
      if (template.arquivo?.base64) {
        response = await whatsapp.sendFileByUrl(
          cliente.telefone,
          template.arquivo.base64,
          message
        );
      } 
      // Template do BotBot
      else if (template.type === 'botbot' && template.botbotTemplateId) {
        const variables = this.extractTemplateVariables(cliente, extraVars);
        response = await whatsapp.sendTemplateMessage(
          cliente.telefone,
          template.botbotTemplateId,
          variables
        );
      } 
      // Mensagem texto simples
      else {
        response = await whatsapp.sendTextMessage(cliente.telefone, message);
      }

      // Registrar log
      await this.logNotification({
        cliente_id: cliente.id,
        phone: cliente.telefone,
        template_name: template.name,
        status: 'success',
        message_content: message,
      });

      // Notificar admins do envio
      await this.notifyAdminsAboutSend(cliente, template, true);

      return {
        success: true,
        messageId: response.data?.to,
      };

    } catch (error: any) {
      console.error('[UnifiedNotificationHandler] Erro ao enviar:', error);

      // Registrar erro
      if (cliente.telefone) {
        await this.logNotification({
          cliente_id: cliente.id,
          phone: cliente.telefone,
          template_name: template.name,
          status: 'error',
          message_content: template.message,
          error_message: error.message,
        });
      }

      // Notificar admins do erro
      await this.notifyAdminsAboutSend(cliente, template, false, error.message);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Envia notificação de boas-vindas
   */
  async sendWelcomeMessage(cliente: Cliente): Promise<NotificationResult> {
    try {
      if (!cliente.telefone) {
        throw new Error('Cliente sem telefone');
      }

      const whatsapp = await this.ensureWhatsAppClient();
      const message = this.templateEngine.generateWelcomeMessage(cliente);

      const response = await whatsapp.sendTextMessage(cliente.telefone, message);

      await this.logNotification({
        cliente_id: cliente.id,
        phone: cliente.telefone,
        template_name: 'boas_vindas',
        status: 'success',
        message_content: message,
      });

      return {
        success: true,
        messageId: response.data?.to,
      };

    } catch (error: any) {
      await this.logNotification({
        cliente_id: cliente.id,
        phone: cliente.telefone || '',
        template_name: 'boas_vindas',
        status: 'error',
        message_content: '',
        error_message: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Envia alerta para todos os admins
   */
  async sendToAdmins(message: string): Promise<NotificationResult[]> {
    try {
      const whatsapp = await this.ensureWhatsAppClient();
      const admins = await this.configManager.getActiveAdminPhones();

      if (admins.length === 0) {
        console.warn('[UnifiedNotificationHandler] Nenhum admin ativo');
        return [];
      }

      const results: NotificationResult[] = [];

      for (const admin of admins) {
        try {
          const response = await whatsapp.sendTextMessage(admin.phone, message, 1);
          
          results.push({
            success: true,
            messageId: response.data?.to,
          });

          // Pequeno delay entre envios
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          results.push({
            success: false,
            error: error.message,
          });
        }
      }

      return results;

    } catch (error: any) {
      console.error('[UnifiedNotificationHandler] Erro ao notificar admins:', error);
      return [{
        success: false,
        error: error.message,
      }];
    }
  }

  /**
   * Notifica admins sobre envio de mensagem ao cliente
   */
  private async notifyAdminsAboutSend(
    cliente: Cliente,
    template: WhatsappTemplate,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const statusIcon = success ? '✅' : '❌';
      const statusText = success ? 'Enviada com sucesso' : 'Falha no envio';
      const timestamp = new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      let message = `📬 *MENSAGEM ENVIADA*\n\n`;
      message += `*Cliente:* ${cliente.nome}\n`;
      message += `*Telefone:* ${cliente.telefone}\n`;
      message += `*Template:* ${template.name}\n`;
      message += `*Status:* ${statusIcon} ${statusText}\n`;
      if (error) {
        message += `*Erro:* ${error}\n`;
      }
      message += `*Horário:* ${timestamp}`;

      await this.sendToAdmins(message);
    } catch (error) {
      console.error('[UnifiedNotificationHandler] Erro ao notificar admins:', error);
    }
  }

  /**
   * Registra log de notificação no Supabase
   */
  private async logNotification(log: NotificationLog): Promise<void> {
    try {
      await supabase.from('notification_logs').insert(log);
    } catch (error) {
      console.error('[UnifiedNotificationHandler] Erro ao registrar log:', error);
    }
  }

  /**
   * Extrai variáveis de template do cliente
   */
  private extractTemplateVariables(
    cliente: Cliente,
    extraVars?: Record<string, string>
  ): Record<string, string> {
    const vars: Record<string, string> = {
      nome: cliente.nome,
      telefone: cliente.telefone || '',
      email: cliente.email || '',
      plano: cliente.plano,
      valor: cliente.valorPago?.toFixed(2) || '0.00',
      ...extraVars,
    };

    return vars;
  }
}
