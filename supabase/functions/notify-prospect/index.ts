import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prospectData, whatsappConfig, adminPhones } = await req.json() as { 
      prospectData: ProspectData;
      whatsappConfig: WhatsAppConfig;
      adminPhones: AdminPhone[];
    };

    if (!prospectData || !prospectData.nome || !prospectData.celular) {
      return new Response(
        JSON.stringify({ error: 'Dados do prospecto inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!whatsappConfig || !whatsappConfig.appkey || !whatsappConfig.authkey) {
      return new Response(
        JSON.stringify({ error: 'Configurações do WhatsApp não fornecidas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toLocaleString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    // Mensagem de boas-vindas ao prospecto
    const welcomeMessage = `🎉 *Olá, ${prospectData.nome}!*

Obrigado por se cadastrar na IPTV LINK!

Recebemos seus dados e em breve nossa equipe entrará em contato com você para concluir sua ativação.

📺 *Prepare-se para ter acesso a:*
• Mais de 10.000 canais em Full HD e 4K
• Filmes e séries ilimitados
• Suporte técnico dedicado

Aguarde nosso contato! 🚀`;

    // Mensagem para os administradores
    const adminMessage = `🔔 *NOVO CADASTRO NO TUTORIAL*

📅 *Data/Hora:* ${now}

👤 *Dados do Prospecto:*
• *Nome:* ${prospectData.nome}
• *Email:* ${prospectData.email}
• *WhatsApp:* ${prospectData.celular}
• *MAC Address:* ${prospectData.mac}

Entre em contato com o cliente para concluir o processo! 📞`;

    const results = [];

    // Enviar mensagem de boas-vindas ao prospecto
    try {
      const welcomeResponse = await fetch('https://api.botbot.com.br/waboxapp/api/send/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appkey: whatsappConfig.appkey,
          authkey: whatsappConfig.authkey,
          to: prospectData.celular,
          message: welcomeMessage,
          typing_time: 2000,
        }),
      });

      const welcomeData = await welcomeResponse.json();
      results.push({
        type: 'welcome',
        to: prospectData.celular,
        status: welcomeResponse.ok ? 'success' : 'error',
        response: welcomeData,
      });
    } catch (error) {
      console.error('Erro ao enviar boas-vindas:', error);
      results.push({
        type: 'welcome',
        to: prospectData.celular,
        status: 'error',
        error: error.message,
      });
    }

    // Enviar notificações para os administradores
    for (const admin of adminPhones) {
      try {
        const adminResponse = await fetch('https://api.botbot.com.br/waboxapp/api/send/text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appkey: whatsappConfig.appkey,
            authkey: whatsappConfig.authkey,
            to: admin.phone,
            message: adminMessage,
            typing_time: 2000,
          }),
        });

        const adminData = await adminResponse.json();
        results.push({
          type: 'admin_notification',
          to: admin.phone,
          name: admin.name,
          status: adminResponse.ok ? 'success' : 'error',
          response: adminData,
        });
      } catch (error) {
        console.error(`Erro ao notificar admin ${admin.name}:`, error);
        results.push({
          type: 'admin_notification',
          to: admin.phone,
          name: admin.name,
          status: 'error',
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notificações enviadas',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Erro na função notify-prospect:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
