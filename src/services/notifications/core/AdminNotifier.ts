/**
 * Notificador de Administradores
 * Responsável por enviar alertas aos admins via WhatsApp
 */

import { Cliente } from '@/types/cliente';
import { WhatsappTemplate } from '@/types/whatsapp';
import { WhatsAppClient } from './WhatsAppClient';
import { ConfigManager } from './ConfigManager';

export interface AdminNotifyResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class AdminNotifier {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * Envia mensagem para todos os admins ativos
   */
  async sendToAll(
    whatsappClient: WhatsAppClient,
    message: string
  ): Promise<AdminNotifyResult[]> {
    try {
      const admins = await this.configManager.getActiveAdminPhones();

      if (admins.length === 0) {
        console.warn('[AdminNotifier] Nenhum admin ativo');
        return [];
      }

      const results: AdminNotifyResult[] = [];

      for (const admin of admins) {
        try {
          const response = await whatsappClient.sendTextMessage(admin.phone, message, 1);
          results.push({ success: true, messageId: response.data?.to });
          
          // Delay entre envios para evitar rate limit
          await this.delay(500);
        } catch (error: any) {
          results.push({ success: false, error: error.message });
        }
      }

      return results;
    } catch (error: any) {
      console.error('[AdminNotifier] Erro:', error);
      return [{ success: false, error: error.message }];
    }
  }

  /**
   * Notifica admins sobre envio de mensagem ao cliente
   */
  async notifyAboutClientMessage(
    whatsappClient: WhatsAppClient,
    cliente: Cliente,
    template: WhatsappTemplate,
    success: boolean,
    error?: string
  ): Promise<void> {
    const message = this.buildClientMessageNotification(cliente, template, success, error);
    await this.sendToAll(whatsappClient, message);
  }

  /**
   * Constrói mensagem de notificação sobre envio ao cliente
   */
  private buildClientMessageNotification(
    cliente: Cliente,
    template: WhatsappTemplate,
    success: boolean,
    error?: string
  ): string {
    const statusIcon = success ? '✅' : '❌';
    const statusText = success ? 'Enviada com sucesso' : 'Falha no envio';
    const timestamp = this.formatTimestamp();

    let message = `📬 *MENSAGEM ENVIADA*\n\n`;
    message += `*Cliente:* ${cliente.nome}\n`;
    message += `*Telefone:* ${cliente.telefone}\n`;
    message += `*Template:* ${template.name}\n`;
    message += `*Status:* ${statusIcon} ${statusText}\n`;
    
    if (error) {
      message += `*Erro:* ${error}\n`;
    }
    
    message += `*Horário:* ${timestamp}`;

    return message;
  }

  /**
   * Formata timestamp em pt-BR
   */
  private formatTimestamp(): string {
    return new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
