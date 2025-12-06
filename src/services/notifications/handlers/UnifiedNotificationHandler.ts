/**
 * Handler Unificado de Notificações
 * Orquestra envio de notificações delegando para componentes especializados
 */

import { Cliente } from '@/types/cliente';
import { WhatsappTemplate } from '@/types/whatsapp';
import { WhatsAppClient } from '../core/WhatsAppClient';
import { TemplateEngine } from '../core/TemplateEngine';
import { ConfigManager } from '../core/ConfigManager';
import { NotificationLogger } from '../core/NotificationLogger';
import { AdminNotifier } from '../core/AdminNotifier';

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class UnifiedNotificationHandler {
  private whatsappClient: WhatsAppClient | null = null;
  private templateEngine: TemplateEngine;
  private configManager: ConfigManager;
  private logger: NotificationLogger;
  private adminNotifier: AdminNotifier;

  constructor() {
    this.templateEngine = new TemplateEngine();
    this.configManager = new ConfigManager();
    this.logger = new NotificationLogger();
    this.adminNotifier = new AdminNotifier();
  }

  /**
   * Inicializa cliente WhatsApp (lazy loading)
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
    if (!cliente.telefone) {
      return { success: false, error: 'Cliente sem telefone cadastrado' };
    }

    try {
      const whatsapp = await this.ensureWhatsAppClient();
      const message = this.templateEngine.fillTemplate(template, cliente, extraVars);
      
      const response = await this.dispatchMessage(whatsapp, cliente, template, message, extraVars);

      // Log sucesso
      await this.logger.logSuccess(cliente.telefone, template.name, message, cliente.id);
      
      // Notifica admins
      await this.adminNotifier.notifyAboutClientMessage(whatsapp, cliente, template, true);

      return { success: true, messageId: response.data?.to };

    } catch (error: any) {
      console.error('[UnifiedNotificationHandler] Erro:', error);
      
      await this.logger.logError(
        cliente.telefone,
        template.name,
        template.message,
        error.message,
        cliente.id
      );

      const whatsapp = await this.ensureWhatsAppClient().catch(() => null);
      if (whatsapp) {
        await this.adminNotifier.notifyAboutClientMessage(whatsapp, cliente, template, false, error.message);
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Despacha mensagem baseado no tipo de template
   */
  private async dispatchMessage(
    whatsapp: WhatsAppClient,
    cliente: Cliente,
    template: WhatsappTemplate,
    message: string,
    extraVars?: Record<string, string>
  ) {
    // Com arquivo
    if (template.arquivo?.base64) {
      return whatsapp.sendFileByUrl(cliente.telefone!, template.arquivo.base64, message);
    }
    
    // Template BotBot
    if (template.type === 'botbot' && template.botbotTemplateId) {
      const variables = this.extractTemplateVariables(cliente, extraVars);
      return whatsapp.sendTemplateMessage(cliente.telefone!, template.botbotTemplateId, variables);
    }
    
    // Texto simples
    return whatsapp.sendTextMessage(cliente.telefone!, message);
  }

  /**
   * Envia mensagem de boas-vindas
   */
  async sendWelcomeMessage(cliente: Cliente): Promise<NotificationResult> {
    if (!cliente.telefone) {
      return { success: false, error: 'Cliente sem telefone' };
    }

    try {
      const whatsapp = await this.ensureWhatsAppClient();
      const message = this.templateEngine.generateWelcomeMessage(cliente);
      const response = await whatsapp.sendTextMessage(cliente.telefone, message);

      await this.logger.logSuccess(cliente.telefone, 'boas_vindas', message, cliente.id);

      return { success: true, messageId: response.data?.to };

    } catch (error: any) {
      await this.logger.logError(cliente.telefone, 'boas_vindas', '', error.message, cliente.id);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envia alerta para todos os admins
   */
  async sendToAdmins(message: string): Promise<NotificationResult[]> {
    try {
      const whatsapp = await this.ensureWhatsAppClient();
      return await this.adminNotifier.sendToAll(whatsapp, message);
    } catch (error: any) {
      console.error('[UnifiedNotificationHandler] Erro ao notificar admins:', error);
      return [{ success: false, error: error.message }];
    }
  }

  /**
   * Extrai variáveis de template do cliente
   */
  private extractTemplateVariables(
    cliente: Cliente,
    extraVars?: Record<string, string>
  ): Record<string, string> {
    return {
      nome: cliente.nome,
      telefone: cliente.telefone || '',
      email: cliente.email || '',
      plano: cliente.plano,
      valor: cliente.valorPago?.toFixed(2) || '0.00',
      ...extraVars,
    };
  }
}
