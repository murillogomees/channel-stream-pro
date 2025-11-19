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

      // Enviar alerta ao administrador se for vencimento (dia 0 ou depois)
      if (daysBeforeDue <= 0) {
        await this.sendAdminAlert(cliente, daysBeforeDue, addLog);
      }

      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação de vencimento para ${cliente.nome}:`, error);
      return false;
    }
  }

  private async sendAdminAlert(
    cliente: Cliente,
    daysBeforeDue: number,
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

      // Criar mensagem de alerta para admin
      const statusMsg = daysBeforeDue === 0 
        ? 'venceu hoje' 
        : `venceu há ${Math.abs(daysBeforeDue)} dias`;

      const adminMessage = `🚨 *ALERTA DE VENCIMENTO*\n\n` +
        `Cliente: *${cliente.nome}*\n` +
        `Telefone: ${cliente.telefone}\n` +
        `Plano: ${cliente.plano || 'Não definido'}\n` +
        `Status: Assinatura ${statusMsg}\n` +
        `Data de vencimento: ${cliente.dataVencimento ? new Date(cliente.dataVencimento).toLocaleDateString('pt-BR') : 'Não definida'}\n\n` +
        `⚠️ Ação necessária: Entre em contato com o cliente.`;

      // Enviar para cada administrador configurado
      for (const adminPhone of adminPhones) {
        try {
          const adminCliente: Cliente = {
            ...cliente,
            id: `admin-alert-${cliente.id}`,
            nome: 'Administrador',
            telefone: adminPhone,
          };

          const adminTemplate = {
            id: 'admin-expiration-alert',
            name: 'Alerta Admin - Vencimento',
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

          console.log(`✅ Alerta de vencimento enviado ao admin: ${adminPhone}`);
        } catch (error) {
          console.error(`❌ Erro ao enviar alerta ao admin ${adminPhone}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao processar alertas de administrador:', error);
    }
  }
}
