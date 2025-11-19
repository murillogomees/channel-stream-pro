import { Cliente } from '@/types/cliente';
import { NotificationLog } from '@/types/whatsapp';
import { ClientChangeDetector } from '../detectors/ClientChangeDetector';
import { WhatsAppAdapter } from '../core/WhatsAppAdapter';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export class UpdateNotificationHandler {
  private changeDetector: ClientChangeDetector;
  private whatsappAdapter: WhatsAppAdapter;

  constructor() {
    this.changeDetector = new ClientChangeDetector();
    this.whatsappAdapter = new WhatsAppAdapter();
  }

  async sendUpdateNotification(
    clienteAtualizado: Cliente,
    clienteOriginal: Cliente,
    addLog: (log: NotificationLog) => void
  ): Promise<boolean> {
    if (!this.whatsappAdapter.isConfigured()) {
      console.log('Serviço WhatsApp não configurado');
      return false;
    }

    if (!clienteAtualizado.telefone) {
      console.log('Cliente não possui telefone');
      return false;
    }

    const change = this.changeDetector.detectChanges(clienteAtualizado, clienteOriginal);
    
    if (!this.changeDetector.hasSignificantChanges(change)) {
      console.log('Sem mudanças significativas para notificar');
      return false;
    }

    try {
      const mensagem = this.generateUpdateMessage(clienteAtualizado, change!);
      const response = await this.whatsappAdapter.sendText(clienteAtualizado.telefone, mensagem);

      // Log de sucesso
      const log: NotificationLog = {
        id: crypto.randomUUID(),
        clienteId: clienteAtualizado.id,
        clienteNome: clienteAtualizado.nome,
        telefone: clienteAtualizado.telefone,
        tipo: 'client_update',
        template: 'Atualização de Cadastro',
        dataEnvio: new Date().toISOString(),
        status: 'success',
        resposta: response,
      };

      addLog(log);

      console.log(`✅ Notificação de atualização enviada para ${clienteAtualizado.nome}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação de atualização:`, error);

      // Log de erro
      const errorLog: NotificationLog = {
        id: crypto.randomUUID(),
        clienteId: clienteAtualizado.id,
        clienteNome: clienteAtualizado.nome,
        telefone: clienteAtualizado.telefone,
        tipo: 'client_update',
        template: 'Atualização de Cadastro',
        dataEnvio: new Date().toISOString(),
        status: 'error',
        erro: error instanceof Error ? error.message : 'Erro desconhecido',
      };

      addLog(errorLog);
      return false;
    }
  }

  private generateUpdateMessage(cliente: Cliente, change: any): string {
    const mudancas: string[] = [];

    for (const c of change.changes) {
      switch (c.field) {
        case 'plano':
          mudancas.push(`seu plano foi alterado para *${c.newValue}*`);
          break;
        case 'dataVencimento':
          const novaData = c.newValue
            ? format(new Date(c.newValue), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
            : 'não definida';
          mudancas.push(`sua nova data de vencimento é *${novaData}*`);
          break;
        case 'situacao':
          const statusMap: Record<string, string> = {
            'Testando': '🔄 em período de teste',
            'Ativo': '✅ ativo',
            'Devendo': '⚠️ com pendência',
            'Inativo': '❌ inativo',
            'Lead': '📝 em análise',
          };
          mudancas.push(`seu status foi atualizado para *${statusMap[c.newValue] || c.newValue}*`);
          break;
        case 'valorPago':
          mudancas.push(`o valor do plano foi atualizado para *R$ ${c.newValue?.toFixed(2) || '0.00'}*`);
          break;
      }
    }

    let mensagem = `Olá *${cliente.nome}*! 👋\n\n`;
    mensagem += `Passando aqui para informar que ${mudancas.join(', ')}.\n\n`;

    mensagem += `📊 *Informações Atuais:*\n`;
    mensagem += `• Plano: *${cliente.plano}*\n`;

    if (cliente.dataVencimento) {
      const dataVenc = format(new Date(cliente.dataVencimento), 'dd/MM/yyyy');
      mensagem += `• Vencimento: *${dataVenc}*\n`;
    }

    if (cliente.valorPago && cliente.valorPago > 0) {
      mensagem += `• Valor: *R$ ${cliente.valorPago.toFixed(2)}*\n`;
    }

    const tipoContratacao =
      cliente.situacao === 'Testando'
        ? '🎯 *Período de Teste*\nVocê está aproveitando nosso período de teste para conhecer todos os recursos.'
        : cliente.situacao === 'Ativo'
        ? '✨ *Cliente Ativo*\nSeu plano está ativo e funcionando perfeitamente!'
        : cliente.situacao === 'Devendo'
        ? '⏰ *Atenção ao Vencimento*\nPara continuar aproveitando, não esqueça de renovar seu plano.'
        : '📌 *Status Atualizado*\nSeu cadastro foi atualizado em nosso sistema.';

    mensagem += `\n${tipoContratacao}\n\n`;

    mensagem += `💡 *Dicas para Aproveitar Melhor:*\n`;
    mensagem += `• Explore todos os canais disponíveis em seu plano\n`;
    mensagem += `• Configure seus canais favoritos para acesso rápido\n`;
    mensagem += `• Utilize a busca para encontrar conteúdo específico\n\n`;

    mensagem += `📞 *Precisa de Ajuda?*\n`;
    mensagem += `Nossa equipe de suporte está sempre disponível para auxiliar você em qualquer dúvida ou necessidade.\n\n`;

    mensagem += `Obrigado por fazer parte da nossa família! 🎉`;

    return mensagem;
  }
}
