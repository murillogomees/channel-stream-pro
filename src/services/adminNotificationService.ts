import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/cliente';
import { WhatsappTemplate } from '@/types/whatsapp';
import { getWhatsAppService } from './whatsapp';

interface AdminPhone {
  id: string;
  phone: string;
  name: string;
  active: boolean;
}

export class AdminNotificationService {
  /**
   * Envia alerta em tempo real para todos os admins quando uma mensagem é enviada ao cliente
   */
  async notifyMessageSent(
    cliente: Cliente,
    template: WhatsappTemplate,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      // Buscar telefones de admins ativos
      const { data: admins, error: adminError } = await supabase
        .from('admin_phones')
        .select('id, phone, name, active')
        .eq('active', true);

      if (adminError || !admins || admins.length === 0) {
        console.log('[AdminNotificationService] Nenhum admin ativo para notificar');
        return;
      }

      const whatsappService = getWhatsAppService();
      if (!whatsappService) {
        console.log('[AdminNotificationService] WhatsApp não configurado');
        return;
      }

      // Formatar mensagem
      const statusIcon = success ? '✅' : '❌';
      const statusText = success ? 'Enviada com sucesso' : 'Falha no envio';
      const timestamp = new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      let message = `📬 *MENSAGEM ENVIADA*\n\n`;
      message += `*Cliente:* ${cliente.nome}\n`;
      message += `*Telefone:* ${cliente.telefone}\n`;
      message += `*Template:* ${template.name}\n`;
      message += `*Status:* ${statusIcon} ${statusText}\n`;
      if (error) {
        message += `*Erro:* ${error}\n`;
      }
      message += `*Horário:* ${timestamp}`;

      // Enviar para cada admin com delay
      for (const admin of admins) {
        try {
          await whatsappService.sendTextMessage(admin.phone, message, 1);
          console.log(`✅ Alerta enviado para admin: ${admin.name}`);
          
          // Pequeno delay entre envios
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`❌ Erro ao enviar alerta para admin ${admin.name}:`, error);
        }
      }

      // Registrar atividade
      await supabase.from('activity_logs').insert({
        user_id: null,
        action_type: 'admin_alert_sent',
        action_description: `Alerta de mensagem enviado para ${admins.length} administradores`,
        entity_type: 'notification',
        entity_id: cliente.id,
        metadata: {
          cliente_nome: cliente.nome,
          template_name: template.name,
          success,
          admins_notified: admins.length
        }
      });

    } catch (error) {
      console.error('[AdminNotificationService] Erro ao enviar alertas:', error);
      // Não lança erro para não bloquear o fluxo principal
    }
  }

  /**
   * Envia alerta quando um cliente expira
   */
  async notifyClientExpired(cliente: Cliente): Promise<void> {
    try {
      const { data: admins } = await supabase
        .from('admin_phones')
        .select('phone, name')
        .eq('active', true);

      if (!admins || admins.length === 0) return;

      const whatsappService = getWhatsAppService();
      if (!whatsappService) return;

      const message = `⚠️ *ASSINATURA EXPIRADA*\n\n` +
        `*Cliente:* ${cliente.nome}\n` +
        `*Telefone:* ${cliente.telefone}\n` +
        `*Plano:* ${cliente.plano}\n` +
        `*Valor:* R$ ${cliente.valorPago?.toFixed(2) || '0.00'}\n` +
        `*Vencimento:* ${new Date(cliente.dataVencimento).toLocaleDateString('pt-BR')}\n\n` +
        `🔴 Ação necessária: Entrar em contato com o cliente`;

      for (const admin of admins) {
        try {
          await whatsappService.sendTextMessage(admin.phone, message, 1);
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Erro ao notificar admin ${admin.name}:`, error);
        }
      }

      // Registrar atividade
      await supabase.from('activity_logs').insert({
        user_id: null,
        action_type: 'client_expired_alert',
        action_description: `Alerta de expiração enviado para administradores: ${cliente.nome}`,
        entity_type: 'cliente',
        entity_id: cliente.id,
        metadata: {
          cliente_nome: cliente.nome,
          plano: cliente.plano,
          data_vencimento: cliente.dataVencimento
        }
      });

    } catch (error) {
      console.error('[AdminNotificationService] Erro ao notificar expiração:', error);
    }
  }
}

export const adminNotificationService = new AdminNotificationService();
