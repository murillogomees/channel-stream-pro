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

    return data;
  } catch (error) {
    console.error('Erro no serviço de notificações:', error);
    throw error;
  }
}
