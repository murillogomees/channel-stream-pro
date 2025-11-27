import { Cliente } from '@/types/cliente';
import { NotificationLog } from '@/types/whatsapp';
import { NotificationService } from '../core/NotificationService';
import { TemplateEngine } from '../core/TemplateEngine';

export class DueDateNotificationHandler {
  private notificationService: NotificationService;
  private templateEngine: TemplateEngine;

  constructor() {
    this.notificationService = new NotificationService();
    this.templateEngine = new TemplateEngine();
  }

  getDaysUntilDue(dataVencimento: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(dataVencimento);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  shouldSendNotification(
    cliente: Cliente,
    daysBeforeDue: number,
    notificationLogs: NotificationLog[]
  ): boolean {
    if (!cliente.dataVencimento) return false;

    const daysUntil = this.getDaysUntilDue(cliente.dataVencimento);

    // Verifica se é o dia certo para enviar
    if (daysUntil !== daysBeforeDue) return false;

    // Verifica se já enviou hoje
    const today = new Date().toDateString();
    const sentToday = notificationLogs.some(
      (log) =>
        log.clienteId === cliente.id &&
        log.tipo === `dia_${daysBeforeDue >= 0 ? 'mais' : 'menos'}_${Math.abs(daysBeforeDue)}` &&
        new Date(log.dataEnvio).toDateString() === today
    );

    return !sentToday;
  }

  async sendDueDateNotification(
    cliente: Cliente,
    daysBeforeDue: number,
    addLog: (log: NotificationLog) => void
  ): Promise<boolean> {
    const template = this.templateEngine.findTemplateByEvent('expiration', daysBeforeDue);

    if (!template) {
      console.log(`Template para ${daysBeforeDue} dias antes do vencimento não encontrado`);
      return false;
    }

    try {
      const extraVars: Record<string, string> = {
        linkPagamento: 'https://exemplo.com/pagar',
        diasRestantes: String(Math.abs(daysBeforeDue)),
      };

      await this.notificationService.send({
        cliente,
        template,
        extraVars,
        addLog,
      });

      console.log(`✅ Notificação de vencimento enviada para ${cliente.nome} (${daysBeforeDue} dias)`);

      // SEMPRE enviar resumo ao admin quando uma notificação for enviada ao cliente
      await this.sendAdminSummary(cliente, daysBeforeDue, template.name, true, addLog);

      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação de vencimento para ${cliente.nome}:`, error);
      
      // Notificar admin sobre a falha também
      await this.sendAdminSummary(cliente, daysBeforeDue, template?.name || 'Template não encontrado', false, addLog);
      
      return false;
    }
  }

  /**
   * Envia resumo ao administrador sobre a notificação enviada ao cliente
   */
  private async sendAdminSummary(
    cliente: Cliente,
    daysBeforeDue: number,
    templateName: string,
    success: boolean,
    addLog: (log: NotificationLog) => void
  ): Promise<void> {
    try {
      // Carregar telefones de administradores
      const configStored = localStorage.getItem('whatsapp_config');
      if (!configStored) return;

      const config = JSON.parse(configStored);
      const adminPhones = config.adminPhones || [];

      if (adminPhones.length === 0) {
        console.log('⚠️ Nenhum telefone de administrador configurado para alertas');
        return;
      }

      // Criar mensagem de resumo para admin
      const statusIcon = success ? '✅' : '❌';
      const statusEnvio = success ? 'Enviada com sucesso' : 'Falha no envio';
      
      let statusVencimento: string;
      let emoji: string;
      
      if (daysBeforeDue > 0) {
        emoji = '⏰';
        statusVencimento = `Vence em ${daysBeforeDue} dia${daysBeforeDue > 1 ? 's' : ''}`;
      } else if (daysBeforeDue === 0) {
        emoji = '🚨';
        statusVencimento = 'Vence HOJE';
      } else {
        emoji = '🔴';
        statusVencimento = `Vencido há ${Math.abs(daysBeforeDue)} dia${Math.abs(daysBeforeDue) > 1 ? 's' : ''}`;
      }

      const timestamp = new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const adminMessage = `${emoji} *RESUMO DE NOTIFICAÇÃO*\n\n` +
        `${statusIcon} *Status do Envio:* ${statusEnvio}\n\n` +
        `👤 *Cliente:* ${cliente.nome}\n` +
        `📱 *Telefone:* ${cliente.telefone}\n` +
        `📋 *Plano:* ${cliente.plano || 'Não definido'}\n` +
        `💰 *Valor:* R$ ${cliente.valorPago?.toFixed(2) || '0.00'}\n` +
        `📅 *Vencimento:* ${cliente.dataVencimento ? new Date(cliente.dataVencimento).toLocaleDateString('pt-BR') : 'Não definida'}\n` +
        `⚡ *Situação:* ${statusVencimento}\n\n` +
        `📨 *Template usado:* ${templateName}\n` +
        `🕐 *Horário:* ${timestamp}\n\n` +
        `${daysBeforeDue <= 0 ? '⚠️ *Ação necessária:* Entre em contato com o cliente.' : '✨ Cliente notificado preventivamente.'}`;

      // Enviar para cada administrador configurado
      for (const adminPhone of adminPhones) {
        try {
          const adminCliente: Cliente = {
            ...cliente,
            id: `admin-summary-${cliente.id}`,
            nome: 'Administrador',
            telefone: adminPhone,
          };

          const adminTemplate = {
            id: 'admin-notification-summary',
            name: 'Resumo Notificação Admin',
            message: adminMessage,
            variables: [],
            type: 'local' as const,
            eventType: 'payment_reminder' as const,
          };

          await this.notificationService.send({
            cliente: adminCliente,
            template: adminTemplate,
            extraVars: {},
            addLog,
          });

          console.log(`✅ Resumo de notificação enviado ao admin: ${adminPhone}`);
        } catch (error) {
          console.error(`❌ Erro ao enviar resumo ao admin ${adminPhone}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao processar resumos de administrador:', error);
    }
  }
}
