import { Cliente } from '@/types/cliente';
import { WhatsappTemplate, NotificationLog } from '@/types/whatsapp';
import { TemplateEngine } from './TemplateEngine';
import { WhatsAppAdapter } from './WhatsAppAdapter';

export interface SendNotificationOptions {
  cliente: Cliente;
  template: WhatsappTemplate;
  extraVars?: Record<string, string>;
  addLog: (log: NotificationLog) => void;
}

export class NotificationService {
  private templateEngine: TemplateEngine;
  private whatsappAdapter: WhatsAppAdapter;

  constructor() {
    this.templateEngine = new TemplateEngine();
    this.whatsappAdapter = new WhatsAppAdapter();
  }

  async send(options: SendNotificationOptions): Promise<void> {
    const { cliente, template, extraVars, addLog } = options;

    if (!this.whatsappAdapter.isConfigured()) {
      throw new Error('Serviço WhatsApp não configurado');
    }

    if (!cliente.telefone) {
      throw new Error('Cliente sem telefone cadastrado');
    }

    const message = this.templateEngine.fill(template, cliente, extraVars);
    
    try {
      let response;
      
      if (template.arquivo?.base64) {
        response = await this.whatsappAdapter.sendFile(
          cliente.telefone,
          template.arquivo.base64,
          message
        );
      } else if (template.type === 'local') {
        response = await this.whatsappAdapter.sendText(cliente.telefone, message);
      } else {
        response = await this.whatsappAdapter.sendTemplate(
          cliente.telefone,
          template.botbotTemplateId!,
          message
        );
      }

      // Log de sucesso
      const log: NotificationLog = {
        id: crypto.randomUUID(),
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        telefone: cliente.telefone,
        tipo: template.eventType,
        template: template.name,
        dataEnvio: new Date().toISOString(),
        status: 'success',
        resposta: response,
        arquivoEnviado: template.arquivo ? {
          nome: template.arquivo.nome,
          tipo: template.arquivo.tipo,
          tamanho: template.arquivo.tamanho,
        } : undefined,
      };

      addLog(log);
      console.log(`✅ Notificação enviada: ${cliente.nome} - ${template.name}`);
    } catch (error) {
      // Log de erro
      const errorLog: NotificationLog = {
        id: crypto.randomUUID(),
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        telefone: cliente.telefone,
        tipo: template.eventType,
        template: template.name,
        dataEnvio: new Date().toISOString(),
        status: 'error',
        erro: error instanceof Error ? error.message : 'Erro desconhecido',
      };

      addLog(errorLog);
      console.error(`❌ Erro ao enviar: ${cliente.nome} - ${template.name}`);
      throw error;
    }
  }

  async sendBatch(notifications: SendNotificationOptions[]): Promise<{ success: number; errors: number }> {
    let success = 0;
    let errors = 0;

    const realtimeService = getRealtimeService();
    await realtimeService.broadcastBatchStarted(notifications.length);

    for (const notification of notifications) {
      try {
        await this.send(notification);
        success++;
      } catch (error) {
        console.error(`Erro ao enviar notificação para ${notification.cliente.nome}:`, error);
        errors++;
      }
    }

    await realtimeService.broadcastBatchCompleted(success, errors);

    console.log(`📊 Lote concluído: ${success} sucessos, ${errors} erros`);
    return { success, errors };
  }
}
