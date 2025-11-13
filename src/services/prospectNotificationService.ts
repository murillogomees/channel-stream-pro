import { supabase } from "@/integrations/supabase/client";

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
      console.error('Erro ao enviar notificações:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro no serviço de notificações:', error);
    throw error;
  }
}
