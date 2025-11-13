import { Cliente } from '@/types/cliente';
import { WhatsappTemplate } from '@/types/whatsapp';
import { loadTemplates, fillTemplate, sendNotification } from './notificationScheduler';

const SENT_EVENTS_KEY = 'sent_events_history';

interface SentEvent {
  clienteId: string;
  eventType: string;
  sentAt: string;
}

// Gerenciar histórico de eventos enviados
function getSentEvents(): SentEvent[] {
  const stored = localStorage.getItem(SENT_EVENTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function addSentEvent(clienteId: string, eventType: string) {
  const events = getSentEvents();
  events.push({
    clienteId,
    eventType,
    sentAt: new Date().toISOString(),
  });
  localStorage.setItem(SENT_EVENTS_KEY, JSON.stringify(events));
}

function hasEventBeenSent(clienteId: string, eventType: string): boolean {
  const events = getSentEvents();
  return events.some(e => e.clienteId === clienteId && e.eventType === eventType);
}

// Detectar novos clientes para envio de boas-vindas
export function detectNewClients(currentClientes: Cliente[]): Cliente[] {
  const previousData = localStorage.getItem('clientes_snapshot');
  if (!previousData) {
    // Primeira execução - salvar snapshot atual
    localStorage.setItem('clientes_snapshot', JSON.stringify(currentClientes));
    return [];
  }

  const previousClientes: Cliente[] = JSON.parse(previousData);
  const previousIds = new Set(previousClientes.map(c => c.id));
  
  // Identificar clientes novos (IDs que não existiam antes)
  const newClientes = currentClientes.filter(c => !previousIds.has(c.id));
  
  // Atualizar snapshot
  localStorage.setItem('clientes_snapshot', JSON.stringify(currentClientes));
  
  return newClientes;
}

// Enviar mensagem de boas-vindas para novo cliente
export async function sendWelcomeMessage(
  cliente: Cliente,
  addLog: (log: any) => void
): Promise<boolean> {
  const templates = loadTemplates();
  
  // Determinar se é período de teste ou plano contratado
  const isTrial = cliente.situacao === 'Testando';
  const eventType = isTrial ? 'welcome_trial' : 'welcome_plan';
  
  // Verificar se já enviou boas-vindas para este cliente
  if (hasEventBeenSent(cliente.id, eventType)) {
    console.log(`Já enviou boas-vindas para ${cliente.nome}`);
    return false;
  }
  
  // Buscar template correspondente
  const template = templates.find(t => t.eventType === eventType);
  if (!template) {
    console.log(`Template de ${eventType} não encontrado`);
    return false;
  }
  
  try {
    // Preparar variáveis extras
    const extraVars: Record<string, string> = {
      linkPagamento: 'https://exemplo.com/pagar', // Pode ser configurável
      telefone: cliente.telefone || '',
    };
    
    await sendNotification(cliente, template, addLog, extraVars);
    addSentEvent(cliente.id, eventType);
    
    console.log(`✅ Boas-vindas enviadas para ${cliente.nome} (${eventType})`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar boas-vindas para ${cliente.nome}:`, error);
    return false;
  }
}

// Enviar mensagem de renovação confirmada
export async function sendRenewalMessage(
  cliente: Cliente,
  addLog: (log: any) => void
): Promise<boolean> {
  const templates = loadTemplates();
  const eventType = 'renewal';
  
  // Buscar template de renovação
  const template = templates.find(t => t.eventType === eventType);
  if (!template) {
    console.log('Template de renovação não encontrado');
    return false;
  }
  
  try {
    // Preparar variáveis extras
    const extraVars: Record<string, string> = {
      linkPagamento: 'https://exemplo.com/pagar',
      telefone: cliente.telefone || '',
    };
    
    await sendNotification(cliente, template, addLog, extraVars);
    
    console.log(`✅ Confirmação de renovação enviada para ${cliente.nome}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar renovação para ${cliente.nome}:`, error);
    return false;
  }
}

// Processar eventos automáticos (boas-vindas e renovações)
export async function processEventNotifications(
  clientes: Cliente[],
  paidClients: Cliente[],
  addLog: (log: any) => void
): Promise<{ welcomeSent: number; renewalSent: number }> {
  let welcomeSent = 0;
  let renewalSent = 0;
  
  // 1. Detectar e enviar boas-vindas para novos clientes
  const newClientes = detectNewClients(clientes);
  for (const cliente of newClientes) {
    const sent = await sendWelcomeMessage(cliente, addLog);
    if (sent) welcomeSent++;
  }
  
  // 2. Enviar confirmação de renovação para clientes que pagaram
  for (const cliente of paidClients) {
    const sent = await sendRenewalMessage(cliente, addLog);
    if (sent) renewalSent++;
  }
  
  return { welcomeSent, renewalSent };
}
