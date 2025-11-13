import { Cliente } from '@/types/cliente';
import { WhatsappTemplate } from '@/types/whatsapp';
import { getWhatsAppService } from './whatsapp';

const STORAGE_KEY = 'whatsapp_templates';

// Função para carregar templates do localStorage
export const loadTemplates = (): WhatsappTemplate[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      return DEFAULT_TEMPLATES;
    }
  }
  return DEFAULT_TEMPLATES;
};

const DEFAULT_TEMPLATES: WhatsappTemplate[] = [
  // Templates padrão mantidos para compatibilidade
  // Usar loadTemplates() para carregar templates customizados
];

// Manter LOCAL_TEMPLATES para compatibilidade (agora dinâmico)
export const LOCAL_TEMPLATES = loadTemplates();

export function getDaysUntilDue(dataVencimento: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(dataVencimento);
  dueDate.setHours(0, 0, 0, 0);
  
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  // Retorna positivo para dias restantes (futuro), negativo para dias vencidos (passado)
  return diffDays;
}

export function shouldSendNotification(
  cliente: Cliente,
  daysBeforeDue: number,
  notificationLogs: any[]
): boolean {
  if (!cliente.dataVencimento) return false;

  const daysUntil = getDaysUntilDue(cliente.dataVencimento);
  
  // Verifica se é o dia certo para enviar
  if (daysUntil !== daysBeforeDue) return false;

  // Verifica se já enviou hoje
  const today = new Date().toDateString();
  const sentToday = notificationLogs.some(log => 
    log.clienteId === cliente.id &&
    log.tipo === `dia_${daysBeforeDue >= 0 ? 'mais' : 'menos'}_${Math.abs(daysBeforeDue)}` &&
    new Date(log.dataEnvio).toDateString() === today
  );

  return !sentToday;
}

export function fillTemplate(template: WhatsappTemplate, cliente: Cliente, extraVars?: Record<string, string>): string {
  let message = template.message;
  
  // Substituir variáveis padrão
  message = message.replace(/{nome}/g, cliente.nome);
  message = message.replace(/{valor}/g, cliente.valorPago.toFixed(2));
  
  if (cliente.dataVencimento) {
    const dataFormatada = new Date(cliente.dataVencimento).toLocaleDateString('pt-BR');
    message = message.replace(/{dataVencimento}/g, dataFormatada);
  }
  
  if (cliente.plano) {
    message = message.replace(/{plano}/g, cliente.plano);
  }
  
  // Substituir variáveis extras (como linkPagamento, dataProximaCobranca, etc)
  if (extraVars) {
    Object.entries(extraVars).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      message = message.replace(regex, value);
    });
  }
  
  return message;
}

export async function sendNotification(
  cliente: Cliente,
  template: WhatsappTemplate,
  addLog: (log: any) => void,
  extraVars?: Record<string, string>
) {
  const service = getWhatsAppService();
  
  if (!service) {
    throw new Error('Serviço WhatsApp não configurado');
  }

  if (!cliente.telefone) {
    throw new Error('Cliente sem telefone cadastrado');
  }

  try {
    const message = fillTemplate(template, cliente, extraVars);
    
    let response;
    
    // Se template tem arquivo, enviar com URL ou file
    if (template.arquivo && template.arquivo.base64) {
      // Converter base64 para URL se necessário, ou enviar direto como file
      response = await service.sendFileByUrl(
        cliente.telefone,
        template.arquivo.base64,
        message
      );
    } else if (template.type === 'local') {
      response = await service.sendTextMessage(cliente.telefone, message);
    } else {
      response = await service.sendTemplateMessage(
        cliente.telefone,
        template.botbotTemplateId!,
        {
          '{nome}': cliente.nome,
          '{valor}': cliente.valorPago.toFixed(2),
          '{dataVencimento}': cliente.dataVencimento 
            ? new Date(cliente.dataVencimento).toLocaleDateString('pt-BR')
            : '',
          ...extraVars,
        }
      );
    }

    addLog({
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      telefone: cliente.telefone,
      tipo: template.id,
      template: template.name,
      status: 'success',
      resposta: response,
      arquivoEnviado: template.arquivo ? {
        nome: template.arquivo.nome,
        tipo: template.arquivo.tipo,
        tamanho: template.arquivo.tamanho,
      } : undefined,
    });

    // Broadcast realtime event
    try {
      const { getRealtimeService } = await import('./realtimeNotificationService');
      const realtimeService = getRealtimeService();
      await realtimeService.broadcastNotificationSent({
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        telefone: cliente.telefone,
        template: template.name,
        status: 'success',
      });
    } catch (realtimeError) {
      console.error('Erro ao enviar evento realtime:', realtimeError);
    }

    return response;
  } catch (error: any) {
    addLog({
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      telefone: cliente.telefone,
      tipo: template.id,
      template: template.name,
      status: 'error',
      erro: error.message,
    });

    // Broadcast realtime event for error
    try {
      const { getRealtimeService } = await import('./realtimeNotificationService');
      const realtimeService = getRealtimeService();
      await realtimeService.broadcastNotificationSent({
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        telefone: cliente.telefone,
        template: template.name,
        status: 'error',
        error: error.message,
      });
    } catch (realtimeError) {
      console.error('Erro ao enviar evento realtime:', realtimeError);
    }

    throw error;
  }
}

export function detectPayment(
  currentCliente: Cliente,
  previousData: Record<string, Cliente>
): boolean {
  const previous = previousData[currentCliente.id];
  if (!previous) return false;

  // Detecta mudança na data de vencimento
  if (currentCliente.dataVencimento !== previous.dataVencimento) {
    return true;
  }

  // Detecta mudança na data de último pagamento
  if (currentCliente.dataUltimoPagamento !== previous.dataUltimoPagamento) {
    return true;
  }

  // Detecta mudança de situação de Devendo para Ativo
  if (previous.situacao === 'Devendo' && currentCliente.situacao === 'Ativo') {
    return true;
  }

  return false;
}
