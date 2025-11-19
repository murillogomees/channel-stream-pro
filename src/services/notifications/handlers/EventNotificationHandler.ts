import { Cliente } from '@/types/cliente';
import { NotificationLog } from '@/types/whatsapp';
import { NotificationService } from '../core/NotificationService';
import { TemplateEngine } from '../core/TemplateEngine';
import { NewClientDetector } from '../detectors/NewClientDetector';

const SENT_EVENTS_KEY = 'sent_events_history';

interface SentEvent {
  clienteId: string;
  eventType: string;
  sentAt: string;
}

export class EventNotificationHandler {
  private notificationService: NotificationService;
  private templateEngine: TemplateEngine;
  private newClientDetector: NewClientDetector;

  constructor() {
    this.notificationService = new NotificationService();
    this.templateEngine = new TemplateEngine();
    this.newClientDetector = new NewClientDetector();
  }

  async processEvents(
    clientes: Cliente[],
    paidClients: Cliente[],
    addLog: (log: NotificationLog) => void
  ): Promise<{ welcomeSent: number; renewalSent: number }> {
    let welcomeSent = 0;
    let renewalSent = 0;

    // 1. Detectar e enviar boas-vindas para novos clientes
    const newClientes = this.newClientDetector.detectNewClients(clientes);
    for (const cliente of newClientes) {
      const sent = await this.sendWelcomeMessage(cliente, addLog, true);
      if (sent) welcomeSent++;
    }

    // 2. Enviar confirmação de renovação para clientes que pagaram
    for (const cliente of paidClients) {
      const sent = await this.sendRenewalMessage(cliente, addLog);
      if (sent) renewalSent++;
    }

    return { welcomeSent, renewalSent };
  }

  // Método público para enviar boas-vindas para um cliente específico (cadastro manual via formulário)
  // Não verifica duplicação, sempre envia a mensagem
  async sendWelcomeToNewClient(cliente: Cliente, addLog: (log: NotificationLog) => void): Promise<boolean> {
    return await this.sendWelcomeMessage(cliente, addLog, false); // skipDuplicateCheck = false
  }

  private async sendWelcomeMessage(
    cliente: Cliente, 
    addLog: (log: NotificationLog) => void,
    checkDuplicate: boolean = true
  ): Promise<boolean> {
    const isTrial = cliente.situacao === 'Testando';
    const eventType = isTrial ? 'welcome_trial' : 'welcome_plan';

    console.log('[EventNotificationHandler] sendWelcomeMessage', {
      clienteNome: cliente.nome,
      isTrial,
      eventType,
      checkDuplicate,
      situacao: cliente.situacao
    });

    // Verificar se já enviou boas-vindas para este cliente (apenas se checkDuplicate for true)
    if (checkDuplicate && this.hasEventBeenSent(cliente.id, eventType)) {
      console.log(`[EventNotificationHandler] Já enviou boas-vindas para ${cliente.nome}`);
      return false;
    }

    // Buscar template correspondente
    const template = this.templateEngine.findTemplateByEvent(eventType);
    
    // Mostrar todos os templates disponíveis para debug
    const allTemplates = this.templateEngine.loadTemplates();
    console.log('[EventNotificationHandler] Templates disponíveis:', 
      allTemplates.map(t => ({ name: t.name, eventType: t.eventType }))
    );
    console.log('[EventNotificationHandler] Template encontrado:', template ? template.name : 'NENHUM');
    
    if (!template) {
      console.error(`[EventNotificationHandler] Template de ${eventType} não encontrado. Tipos disponíveis:`, 
        allTemplates.map(t => t.eventType)
      );
      return false;
    }

    try {
      const extraVars: Record<string, string> = {
        linkPagamento: 'https://exemplo.com/pagar',
        telefone: cliente.telefone || '',
      };

      await this.notificationService.send({
        cliente,
        template,
        extraVars,
        addLog,
      });

      this.addSentEvent(cliente.id, eventType);
      console.log(`✅ Boas-vindas enviadas para ${cliente.nome} (${eventType})`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar boas-vindas para ${cliente.nome}:`, error);
      return false;
    }
  }

  private async sendRenewalMessage(cliente: Cliente, addLog: (log: NotificationLog) => void): Promise<boolean> {
    const eventType = 'renewal';

    // Buscar template de renovação
    const template = this.templateEngine.findTemplateByEvent(eventType);
    if (!template) {
      console.log('Template de renovação não encontrado');
      return false;
    }

    try {
      const extraVars: Record<string, string> = {
        linkPagamento: 'https://exemplo.com/pagar',
        telefone: cliente.telefone || '',
      };

      await this.notificationService.send({
        cliente,
        template,
        extraVars,
        addLog,
      });

      console.log(`✅ Confirmação de renovação enviada para ${cliente.nome}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar renovação para ${cliente.nome}:`, error);
      return false;
    }
  }

  private getSentEvents(): SentEvent[] {
    const stored = localStorage.getItem(SENT_EVENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private addSentEvent(clienteId: string, eventType: string) {
    const events = this.getSentEvents();
    events.push({
      clienteId,
      eventType,
      sentAt: new Date().toISOString(),
    });
    localStorage.setItem(SENT_EVENTS_KEY, JSON.stringify(events));
  }

  private hasEventBeenSent(clienteId: string, eventType: string): boolean {
    const events = this.getSentEvents();
    return events.some(e => e.clienteId === clienteId && e.eventType === eventType);
  }
}
