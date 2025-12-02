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
      console.error('Erro ao enviar notificações via edge function:', error);
      throw error;
    }

    console.log('✅ Notificações enviadas com sucesso:', data);
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

🔗 *Origem:*
Cadastro via Sistema IPTV

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

// Enviar notificação para administrador(es) - Cadastro via Tutorial
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

// ==== NOTIFICAÇÃO ESPECÍFICA PARA CADASTRO VIA TUTORIAL ====

// Gerar mensagem limpa e intuitiva para admin sobre novo cadastro via tutorial
function generateTutorialAdminMessage(cliente: Cliente): string {
  const dataVencimento = cliente.dataVencimento
    ? format(new Date(cliente.dataVencimento), 'dd/MM/yyyy')
    : 'Não definida';

  const dataContratacao = format(new Date(cliente.dataContratacao), 'dd/MM/yyyy HH:mm');

  const mensagem = `🎓 *NOVO CADASTRO VIA TUTORIAL*

━━━━━━━━━━━━━━━━━━━━

👤 *DADOS DO CLIENTE*
• Nome: ${cliente.nome}
• WhatsApp: ${cliente.telefone}
• E-mail: ${cliente.email || 'Não informado'}

━━━━━━━━━━━━━━━━━━━━

📱 *DISPOSITIVO*
• MAC Address: ${cliente.macSmartOne}

━━━━━━━━━━━━━━━━━━━━

📋 *INFORMAÇÕES DO TESTE*
• Status: 🟢 Testando (14 dias)
• Cadastro: ${dataContratacao}
• Vencimento: ${dataVencimento}
• Origem: Website (Tutorial)

━━━━━━━━━━━━━━━━━━━━

💡 *PRÓXIMOS PASSOS*
1. Verificar MAC no SmartOne
2. Ativar playlist do cliente
3. Acompanhar uso durante teste
4. Contato comercial próximo ao fim

━━━━━━━━━━━━━━━━━━━━

_Cadastro automático via formulário do tutorial_`;

  return mensagem;
}

// Enviar notificação específica para cadastro via tutorial
export async function sendTutorialClientNotification(
  cliente: Cliente
): Promise<void> {
  const whatsappService = getWhatsAppService();

  if (!whatsappService) {
    console.log('Serviço WhatsApp não configurado');
    return;
  }

  // Buscar lista de telefones de administradores
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

    const mensagem = generateTutorialAdminMessage(cliente);

    // Enviar para cada administrador
    for (const admin of activeAdmins) {
      try {
        await whatsappService.sendTextMessage(admin.phone, mensagem, 2);
        console.log('✅ Notificação de tutorial enviada para:', admin.name);
        
        // Pequeno delay entre envios
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Erro ao enviar para admin ${admin.phone}:`, error);
      }
    }
  } catch (error) {
    console.error('Erro ao processar notificações de tutorial:', error);
  }
}
