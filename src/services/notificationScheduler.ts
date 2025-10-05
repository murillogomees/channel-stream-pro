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
  {
    id: 'dia_menos_5',
    name: '5 dias antes do vencimento',
    message: 'Olá {nome}! Seu plano IPTV vence em 5 dias ({dataVencimento}). Valor: R$ {valor}. Evite interrupção renovando agora!',
    variables: ['{nome}', '{dataVencimento}', '{valor}'],
    type: 'local',
    daysBeforeDue: -5,
  },
  {
    id: 'dia_menos_4',
    name: '4 dias antes do vencimento',
    message: 'Olá {nome}! Faltam 4 dias para o vencimento ({dataVencimento}). Renove já para não perder acesso! Valor: R$ {valor}',
    variables: ['{nome}', '{dataVencimento}', '{valor}'],
    type: 'local',
    daysBeforeDue: -4,
  },
  {
    id: 'dia_menos_3',
    name: '3 dias antes do vencimento',
    message: '⚠️ {nome}, seu plano vence em 3 dias ({dataVencimento}). Garanta seu acesso renovando agora! Valor: R$ {valor}',
    variables: ['{nome}', '{dataVencimento}', '{valor}'],
    type: 'local',
    daysBeforeDue: -3,
  },
  {
    id: 'dia_menos_2',
    name: '2 dias antes do vencimento',
    message: '🚨 {nome}, ATENÇÃO! Faltam apenas 2 dias para o vencimento. Renove para não perder seu serviço! Valor: R$ {valor}',
    variables: ['{nome}', '{dataVencimento}', '{valor}'],
    type: 'local',
    daysBeforeDue: -2,
  },
  {
    id: 'dia_zero',
    name: 'Dia do vencimento',
    message: '⏰ ÚLTIMO DIA! {nome}, seu plano vence HOJE ({dataVencimento}). Renove agora para continuar assistindo! Valor: R$ {valor}',
    variables: ['{nome}', '{dataVencimento}', '{valor}'],
    type: 'local',
    daysBeforeDue: 0,
  },
  {
    id: 'dia_mais_1',
    name: '1 dia após vencimento',
    message: '❌ {nome}, seu plano venceu ontem ({dataVencimento}). Regularize para reativar seu acesso. Valor: R$ {valor}',
    variables: ['{nome}', '{dataVencimento}', '{valor}'],
    type: 'local',
    daysBeforeDue: 1,
  },
  {
    id: 'dia_mais_2',
    name: '2 dias após vencimento',
    message: '❌ {nome}, já se passaram 2 dias do vencimento ({dataVencimento}). Entre em contato para reativação urgente! Valor: R$ {valor}',
    variables: ['{nome}', '{dataVencimento}', '{valor}'],
    type: 'local',
    daysBeforeDue: 2,
  },
  {
    id: 'dia_mais_3',
    name: '3 dias após vencimento',
    message: '❌ {nome}, seu acesso está suspenso há 3 dias. Regularize seu pagamento de R$ {valor} para reativar!',
    variables: ['{nome}', '{valor}'],
    type: 'local',
    daysBeforeDue: 3,
  },
  {
    id: 'dia_mais_4',
    name: '4 dias após vencimento',
    message: '⛔ {nome}, última chance! Seu plano está vencido há 4 dias. Renove agora: R$ {valor}',
    variables: ['{nome}', '{valor}'],
    type: 'local',
    daysBeforeDue: 4,
  },
  {
    id: 'dia_mais_5',
    name: '5 dias após vencimento',
    message: '⛔ {nome}, seu acesso será cancelado em breve. Plano vencido há 5 dias. Valor para reativação: R$ {valor}',
    variables: ['{nome}', '{valor}'],
    type: 'local',
    daysBeforeDue: 5,
  },
];

// Manter LOCAL_TEMPLATES para compatibilidade (agora dinâmico)
export const LOCAL_TEMPLATES = loadTemplates();

export function getDaysUntilDue(dataVencimento: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(dataVencimento);
  dueDate.setHours(0, 0, 0, 0);
  
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
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

export function fillTemplate(template: WhatsappTemplate, cliente: Cliente): string {
  let message = template.message;
  
  message = message.replace(/{nome}/g, cliente.nome);
  message = message.replace(/{valor}/g, cliente.valorPago.toFixed(2));
  
  if (cliente.dataVencimento) {
    const dataFormatada = new Date(cliente.dataVencimento).toLocaleDateString('pt-BR');
    message = message.replace(/{dataVencimento}/g, dataFormatada);
  }
  
  return message;
}

export async function sendNotification(
  cliente: Cliente,
  template: WhatsappTemplate,
  addLog: (log: any) => void
) {
  const service = getWhatsAppService();
  
  if (!service) {
    throw new Error('Serviço WhatsApp não configurado');
  }

  if (!cliente.telefone) {
    throw new Error('Cliente sem telefone cadastrado');
  }

  try {
    const message = fillTemplate(template, cliente);
    
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
