import { Cliente } from '@/types/cliente';
import { getWhatsAppService } from './whatsapp';
import { getRealtimeService } from './realtimeNotificationService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Determinar o tipo de mudança e gerar mensagem humanizada
function generateUpdateMessage(
  clienteAtualizado: Cliente,
  clienteOriginal: Cliente
): string {
  const mudancas: string[] = [];
  
  // Verificar mudanças importantes
  if (clienteAtualizado.plano !== clienteOriginal.plano) {
    mudancas.push(`seu plano foi alterado para *${clienteAtualizado.plano}*`);
  }
  
  if (clienteAtualizado.dataVencimento !== clienteOriginal.dataVencimento) {
    const novaData = clienteAtualizado.dataVencimento 
      ? format(new Date(clienteAtualizado.dataVencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : 'não definida';
    mudancas.push(`sua nova data de vencimento é *${novaData}*`);
  }
  
  if (clienteAtualizado.situacao !== clienteOriginal.situacao) {
    const statusMap: Record<string, string> = {
      'Testando': '🔄 em período de teste',
      'Ativo': '✅ ativo',
      'Devendo': '⚠️ com pendência',
      'Inativo': '❌ inativo',
      'Lead': '📝 em análise'
    };
    mudancas.push(`seu status foi atualizado para *${statusMap[clienteAtualizado.situacao] || clienteAtualizado.situacao}*`);
  }

  if (clienteAtualizado.valorPago !== clienteOriginal.valorPago) {
    mudancas.push(`o valor do plano foi atualizado para *R$ ${clienteAtualizado.valorPago.toFixed(2)}*`);
  }

  // Mensagem base
  let mensagem = `Olá *${clienteAtualizado.nome}*! 👋\n\n`;
  mensagem += `Passando aqui para informar que ${mudancas.length > 0 ? mudancas.join(', ') : 'fizemos algumas atualizações no seu cadastro'}.\n\n`;

  // Informações do plano atual
  mensagem += `📊 *Informações Atuais:*\n`;
  mensagem += `• Plano: *${clienteAtualizado.plano}*\n`;
  
  if (clienteAtualizado.dataVencimento) {
    const dataVenc = format(new Date(clienteAtualizado.dataVencimento), "dd/MM/yyyy");
    mensagem += `• Vencimento: *${dataVenc}*\n`;
  }
  
  if (clienteAtualizado.valorPago > 0) {
    mensagem += `• Valor: *R$ ${clienteAtualizado.valorPago.toFixed(2)}*\n`;
  }

  // Tipo de contratação
  const tipoContratacao = clienteAtualizado.situacao === 'Testando' 
    ? '🎯 *Período de Teste*\nVocê está aproveitando nosso período de teste para conhecer todos os recursos.'
    : clienteAtualizado.situacao === 'Ativo'
    ? '✨ *Cliente Ativo*\nSeu plano está ativo e funcionando perfeitamente!'
    : clienteAtualizado.situacao === 'Devendo'
    ? '⏰ *Atenção ao Vencimento*\nPara continuar aproveitando, não esqueça de renovar seu plano.'
    : '📌 *Status Atualizado*\nSeu cadastro foi atualizado em nosso sistema.';

  mensagem += `\n${tipoContratacao}\n\n`;

  // Dicas e suporte
  mensagem += `💡 *Dicas para Aproveitar Melhor:*\n`;
  mensagem += `• Explore todos os canais disponíveis em seu plano\n`;
  mensagem += `• Configure seus canais favoritos para acesso rápido\n`;
  mensagem += `• Utilize a busca para encontrar conteúdo específico\n\n`;

  mensagem += `📞 *Precisa de Ajuda?*\n`;
  mensagem += `Nossa equipe de suporte está sempre disponível para auxiliar você em qualquer dúvida ou necessidade.\n\n`;

  mensagem += `Obrigado por fazer parte da nossa família! 🎉`;

  return mensagem;
}

// Enviar mensagem de atualização para o cliente
export async function sendClientUpdateMessage(
  clienteAtualizado: Cliente,
  clienteOriginal: Cliente,
  addLog: (log: any) => void
): Promise<boolean> {
  const whatsappService = getWhatsAppService();
  
  if (!whatsappService) {
    console.log('Serviço WhatsApp não configurado');
    return false;
  }

  if (!clienteAtualizado.telefone) {
    console.log('Cliente não possui telefone');
    return false;
  }

  try {
    const mensagem = generateUpdateMessage(clienteAtualizado, clienteOriginal);
    
    const response = await whatsappService.sendTextMessage(
      clienteAtualizado.telefone,
      mensagem,
      2000
    );

    const logData = {
      clienteId: clienteAtualizado.id,
      clienteNome: clienteAtualizado.nome,
      telefone: clienteAtualizado.telefone,
      tipo: 'atualizacao',
      template: 'Atualização de Cadastro',
      status: 'success' as const,
      resposta: response,
    };

    addLog(logData);

    // Broadcast evento de sucesso
    const realtimeService = getRealtimeService();
    realtimeService.connect();
    await realtimeService.broadcastNotificationSent({
      clienteId: clienteAtualizado.id,
      clienteNome: clienteAtualizado.nome,
      telefone: clienteAtualizado.telefone,
      template: 'Atualização de Cadastro',
      status: 'success',
    });

    console.log(`✅ Mensagem de atualização enviada para ${clienteAtualizado.nome}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar mensagem de atualização:`, error);

    const logData = {
      clienteId: clienteAtualizado.id,
      clienteNome: clienteAtualizado.nome,
      telefone: clienteAtualizado.telefone,
      tipo: 'atualizacao',
      template: 'Atualização de Cadastro',
      status: 'error' as const,
      erro: error instanceof Error ? error.message : 'Erro desconhecido',
    };

    addLog(logData);

    // Broadcast evento de erro
    const realtimeService = getRealtimeService();
    realtimeService.connect();
    await realtimeService.broadcastNotificationSent({
      clienteId: clienteAtualizado.id,
      clienteNome: clienteAtualizado.nome,
      telefone: clienteAtualizado.telefone,
      template: 'Atualização de Cadastro',
      status: 'error',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });

    return false;
  }
}
