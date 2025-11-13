import { supabase } from "@/integrations/supabase/client";
import { getRetryQueue } from "./notificationRetryQueue";

interface ProspectData {
  nome: string;
  email: string;
  celular: string;
  mac: string;
}

interface WhatsAppConfig {
  appkey: string;
  authkey: string;
}

interface AdminPhone {
  phone: string;
  name: string;
}

export async function sendProspectNotifications(prospectData: ProspectData) {
  try {
    // Buscar configurações do WhatsApp
    const whatsappConfigStr = localStorage.getItem('whatsapp_config');
    if (!whatsappConfigStr) {
      throw new Error('Configurações do WhatsApp não encontradas');
    }

    const whatsappConfig: WhatsAppConfig = JSON.parse(whatsappConfigStr);
    if (!whatsappConfig.appkey || !whatsappConfig.authkey) {
      throw new Error('Credenciais do WhatsApp não configuradas');
    }

    // Buscar administradores ativos
    const adminSettingsStr = localStorage.getItem('admin_notification_settings');
    const adminSettings = adminSettingsStr ? JSON.parse(adminSettingsStr) : { phones: [] };
    const activeAdmins: AdminPhone[] = (adminSettings.phones || [])
      .filter((p: any) => p.active)
      .map((p: any) => ({ phone: p.phone, name: p.name }));

    if (activeAdmins.length === 0) {
      console.warn('Nenhum administrador ativo encontrado para enviar notificações');
    }

    // Broadcast batch started
    try {
      const { getRealtimeService } = await import('./realtimeNotificationService');
      const realtimeService = getRealtimeService();
      await realtimeService.broadcastBatchStarted(activeAdmins.length + 1);
    } catch (e) {
      console.error('Erro ao enviar evento realtime batch started:', e);
    }

    // Chamar a edge function
    const { data, error } = await supabase.functions.invoke('notify-prospect', {
      body: {
        prospectData,
        whatsappConfig: {
          appkey: whatsappConfig.appkey,
          authkey: whatsappConfig.authkey,
        },
        adminPhones: activeAdmins,
      },
    });

    if (error) {
      console.error('Erro ao enviar notificações via edge function:', error);
      
      // Broadcast error event
      try {
        const { getRealtimeService } = await import('./realtimeNotificationService');
        const realtimeService = getRealtimeService();
        await realtimeService.broadcastNotificationSent({
          clienteId: 'prospect',
          clienteNome: prospectData.nome,
          telefone: prospectData.celular,
          template: 'Boas-vindas Prospecto',
          status: 'error',
          error: error.message,
        });
      } catch (e) {
        console.error('Erro ao enviar evento realtime:', e);
      }

      // Adicionar à fila de retry
      const retryQueue = getRetryQueue();
      const now = new Date().toLocaleString('pt-BR', { 
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short'
      });

      // Adicionar mensagem de boas-vindas para retry
      const welcomeMessage = `🎉 *Olá, ${prospectData.nome}!*

Obrigado por se cadastrar na IPTV LINK!

Recebemos seus dados e em breve nossa equipe entrará em contato com você para concluir sua ativação.

📺 *Prepare-se para ter acesso a:*
• Mais de 10.000 canais em Full HD e 4K
• Filmes e séries ilimitados
• Suporte técnico dedicado

Aguarde nosso contato! 🚀`;

      retryQueue.add({
        type: 'prospect_welcome',
        prospectData,
        recipient: { phone: prospectData.celular, name: prospectData.nome },
        message: welcomeMessage,
        maxAttempts: 5,
      });

      // Adicionar notificações para admins
      const adminMessage = `🔔 *NOVO CADASTRO NO TUTORIAL*

📅 *Data/Hora:* ${now}

👤 *Dados do Prospecto:*
• *Nome:* ${prospectData.nome}
• *Email:* ${prospectData.email}
• *WhatsApp:* ${prospectData.celular}
• *MAC Address:* ${prospectData.mac}

Entre em contato com o cliente para concluir o processo! 📞`;

      for (const admin of activeAdmins) {
        retryQueue.add({
          type: 'admin_notification',
          prospectData,
          recipient: { phone: admin.phone, name: admin.name },
          message: adminMessage,
          maxAttempts: 5,
        });
      }

      console.log('Notificações adicionadas à fila de retry');
      throw error;
    }

    // Broadcast success events
    try {
      const { getRealtimeService } = await import('./realtimeNotificationService');
      const realtimeService = getRealtimeService();
      
      // Welcome message
      await realtimeService.broadcastNotificationSent({
        clienteId: 'prospect',
        clienteNome: prospectData.nome,
        telefone: prospectData.celular,
        template: 'Boas-vindas Prospecto',
        status: 'success',
      });

      // Admin notifications
      for (const admin of activeAdmins) {
        await realtimeService.broadcastNotificationSent({
          clienteId: 'admin',
          clienteNome: admin.name,
          telefone: admin.phone,
          template: 'Notificação Admin - Novo Prospecto',
          status: 'success',
        });
      }

      // Batch completed
      await realtimeService.broadcastBatchCompleted(activeAdmins.length + 1, 0);
    } catch (e) {
      console.error('Erro ao enviar eventos realtime:', e);
    }

    return data;
  } catch (error) {
    console.error('Erro no serviço de notificações:', error);
    throw error;
  }
}

// ==== NOVO CADASTRO VIA TUTORIAL ====

import { Cliente } from '@/types/cliente';
import { getWhatsAppService } from './whatsapp';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Gerar mensagem de boas-vindas para novo cliente cadastrado via tutorial
function generateWelcomeMessage(cliente: Cliente): string {
  const dataVencimento = cliente.dataVencimento
    ? format(new Date(cliente.dataVencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : 'não definida';

  const periodoPlano = cliente.plano === 'Mensal' ? 'mensal'
    : cliente.plano === 'Trimestral' ? 'trimestral'
    : cliente.plano === 'Semestral' ? 'semestral'
    : 'anual';

  const mensagem = `🎉 *Bem-vindo à IPTV LINK!*

Olá *${cliente.nome}*! 

Seu acesso foi ativado com sucesso! 🚀

📊 *Detalhes do Seu Plano:*
• Plano: *${cliente.plano}* (${periodoPlano})
• Valor: *R$ ${cliente.valorPago.toFixed(2)}*
• Data de Vencimento: *${dataVencimento}*
• MAC Cadastrado: *${cliente.macSmartOne}*

💡 *Dicas Importantes:*

1️⃣ *Primeiro Acesso*
Seu aplicativo SmartOne IPTV já está configurado e pronto para usar!

2️⃣ *Explore os Canais*
Temos mais de 10.000 canais em Full HD e 4K. Navegue pelas categorias e encontre seus favoritos.

3️⃣ *Qualidade de Imagem*
Para melhor experiência, certifique-se de ter uma conexão de internet de pelo menos 10 Mbps.

4️⃣ *Lista de Favoritos*
Configure seus canais favoritos para acesso rápido no menu principal.

5️⃣ *Suporte Técnico*
Qualquer dúvida ou problema, estamos disponíveis neste WhatsApp para ajudar você!

📞 *Precisa de Ajuda?*
Nossa equipe está sempre à disposição para auxiliar no que precisar. Não hesite em entrar em contato!

🎁 *Programa de Indicação*
Indique um amigo e ganhe 1 mês grátis automaticamente quando ele assinar!

Obrigado por fazer parte da família IPTV LINK! 💙

Atenciosamente,
Equipe IPTV LINK`;

  return mensagem;
}

// Gerar mensagem de notificação para administrador
function generateAdminNotificationMessage(cliente: Cliente): string {
  const dataVencimento = cliente.dataVencimento
    ? format(new Date(cliente.dataVencimento), 'dd/MM/yyyy')
    : 'Não definida';

  const dataContratacao = format(new Date(cliente.dataContratacao), 'dd/MM/yyyy HH:mm');

  const mensagem = `🔔 *NOVO CLIENTE CADASTRADO*

📝 *Dados do Cliente:*
• Nome: *${cliente.nome}*
• WhatsApp: *${cliente.telefone}*
• E-mail: *${cliente.email}*
• MAC: *${cliente.macSmartOne}*

💰 *Informações do Plano:*
• Plano: *${cliente.plano}*
• Valor: *R$ ${cliente.valorPago.toFixed(2)}*
• Situação: *${cliente.situacao}*
• Data Contratação: *${dataContratacao}*
• Data Vencimento: *${dataVencimento}*

📍 *Status SmartOne:*
• Status: *${cliente.smartone_status || 'Pendente'}*
${cliente.smartone_playlist_id ? `• Playlist ID: *${cliente.smartone_playlist_id}*` : ''}

🔗 *Origem:*
Cadastro via Tutorial SmartOne

---
_Sistema IPTV LINK - Gestão de Clientes_`;

  return mensagem;
}

// Enviar notificação de boas-vindas para o cliente
export async function sendClientWelcomeNotification(
  cliente: Cliente
): Promise<boolean> {
  const whatsappService = getWhatsAppService();

  if (!whatsappService) {
    console.log('Serviço WhatsApp não configurado');
    return false;
  }

  if (!cliente.telefone) {
    console.log('Cliente não possui telefone');
    return false;
  }

  try {
    const mensagem = generateWelcomeMessage(cliente);

    await whatsappService.sendTextMessage(
      cliente.telefone,
      mensagem,
      5 // typingDelay
    );

    console.log('Mensagem de boas-vindas enviada para:', cliente.telefone);

    // Enviar notificação para administrador
    await sendAdminNotification(cliente);

    return true;
  } catch (error) {
    console.error('Erro ao enviar mensagem de boas-vindas:', error);
    return false;
  }
}

// Enviar notificação para administrador(es)
async function sendAdminNotification(cliente: Cliente): Promise<void> {
  const whatsappService = getWhatsAppService();

  if (!whatsappService) {
    console.log('Serviço WhatsApp não configurado para admin');
    return;
  }

  // Buscar lista de telefones de administradores (localStorage)
  const adminSettingsStr = localStorage.getItem('admin_notification_settings');
  if (!adminSettingsStr) {
    console.log('Configurações de admin não encontradas');
    return;
  }

  try {
    const adminSettings = JSON.parse(adminSettingsStr);
    const activeAdmins: AdminPhone[] = (adminSettings.phones || [])
      .filter((p: any) => p.active)
      .map((p: any) => ({ phone: p.phone, name: p.name }));

    if (activeAdmins.length === 0) {
      console.log('Nenhum admin ativo configurado');
      return;
    }

    const mensagem = generateAdminNotificationMessage(cliente);

    // Enviar para cada administrador
    for (const admin of activeAdmins) {
      try {
        await whatsappService.sendTextMessage(admin.phone, mensagem, 3);
        console.log('Notificação admin enviada para:', admin.phone);
      } catch (error) {
        console.error(`Erro ao enviar para admin ${admin.phone}:`, error);
      }
    }
  } catch (error) {
    console.error('Erro ao processar notificações admin:', error);
  }
}
