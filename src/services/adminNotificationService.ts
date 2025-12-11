/**
 * Admin Notification Service
 * Simplified version - sends notifications to system administrators
 */

export const adminNotificationService = {
  async sendToAdmins(message: string): Promise<void> {
    console.log('[AdminNotification] Message:', message);
    // In production, this would send WhatsApp messages to admin phones
  },

  async notifyMessageSent(
    cliente: any,
    template: any,
    success: boolean,
    error?: string
  ): Promise<void> {
    const statusText = success ? 'Enviada com sucesso' : 'Falha no envio';
    console.log(`[AdminNotification] Mensagem ${statusText} para ${cliente.nome}`);
    if (error) {
      console.log(`[AdminNotification] Erro: ${error}`);
    }
  },

  async notifyClientExpired(cliente: any): Promise<void> {
    console.log(`[AdminNotification] Cliente expirado: ${cliente.nome}`);
  },

  async logNotification(details: {
    type: string;
    message: string;
    recipient?: string;
    status: string;
  }): Promise<void> {
    console.log('[AdminNotification] Log:', details);
  },
};

export default adminNotificationService;
