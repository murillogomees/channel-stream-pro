import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/cliente';

interface SmartOneSyncFailureAlert {
  clienteId: string;
  clienteNome: string;
  clienteMac: string;
  errorMessage: string;
  attemptsMade: number;
  timestamp: string;
}

export class SmartOneSyncAlertService {
  /**
   * Envia alerta via WhatsApp para todos os administradores ativos quando
   * uma sincronização SmartOne falha após todas as tentativas de retry
   */
  async notifyAdminsOfSyncFailure(
    cliente: Cliente,
    error: string,
    attemptsMade: number
  ): Promise<void> {
    try {
      console.log('[SmartOneAlert] Iniciando envio de alertas para admins...');

      // Criar alerta desktop se estiver no dashboard
      try {
        const { getAdminAlertService } = await import('./adminAlertService');
        const alertService = getAdminAlertService();
        alertService.createAlert({
          type: 'smartone_sync_failure',
          severity: 'critical',
          title: 'Falha na Sincronização SmartOne',
          message: `Cliente ${cliente.nome} falhou após ${attemptsMade} tentativas: ${error}`,
          data: {
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            clienteMac: cliente.macSmartOne,
            error,
            attemptsMade,
          },
        });
      } catch (alertError) {
        console.error('[SmartOneAlert] Erro ao criar alerta desktop:', alertError);
      }
      
      // Buscar telefones de administradores ativos
      const { data: adminPhones, error: fetchError } = await supabase
        .from('admin_phones')
        .select('phone, name')
        .eq('active', true);

      if (fetchError) {
        console.error('[SmartOneAlert] Erro ao buscar telefones de admins:', fetchError);
        return;
      }

      if (!adminPhones || adminPhones.length === 0) {
        console.warn('[SmartOneAlert] Nenhum telefone de admin ativo encontrado');
        return;
      }

      // Preparar dados do alerta
      const alertData: SmartOneSyncFailureAlert = {
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        clienteMac: cliente.macSmartOne || 'N/A',
        errorMessage: error,
        attemptsMade,
        timestamp: new Date().toISOString(),
      };

      // Compor mensagem de alerta
      const message = this.composeAlertMessage(alertData);

      // Enviar notificação para cada admin
      const promises = adminPhones.map(admin => 
        this.sendWhatsAppAlert(admin.phone, admin.name, message, alertData)
      );

      await Promise.allSettled(promises);

      console.log(`[SmartOneAlert] Alertas enviados para ${adminPhones.length} administradores`);
    } catch (error) {
      console.error('[SmartOneAlert] Erro ao enviar alertas:', error);
    }
  }

  /**
   * Compõe a mensagem de alerta formatada para WhatsApp
   */
  private composeAlertMessage(data: SmartOneSyncFailureAlert): string {
    return `🚨 *ALERTA: Falha na Sincronização SmartOne*

⚠️ *Cliente:* ${data.clienteNome}
📱 *MAC:* ${data.clienteMac}
🔄 *Tentativas:* ${data.attemptsMade}
❌ *Erro:* ${data.errorMessage}

🕒 *Horário:* ${new Date(data.timestamp).toLocaleString('pt-BR')}

⚡ *Ação necessária:* Verifique o status do cliente e tente sincronizar manualmente.

🔗 Acesse o painel administrativo para mais detalhes.`;
  }

  /**
   * Envia alerta via WhatsApp para um admin específico
   */
  private async sendWhatsAppAlert(
    phone: string,
    adminName: string,
    message: string,
    alertData: SmartOneSyncFailureAlert
  ): Promise<void> {
    try {
      console.log(`[SmartOneAlert] Enviando alerta para ${adminName} (${phone})`);

      // Chamar edge function para enviar WhatsApp
      const { error } = await supabase.functions.invoke('whatsapp-webhook', {
        body: {
          action: 'send_admin_alert',
          phone,
          message,
          metadata: {
            alert_type: 'smartone_sync_failure',
            admin_name: adminName,
            cliente_id: alertData.clienteId,
            cliente_nome: alertData.clienteNome,
            timestamp: alertData.timestamp,
          },
        },
      });

      if (error) {
        console.error(`[SmartOneAlert] Erro ao enviar para ${adminName}:`, error);
        return;
      }

      console.log(`[SmartOneAlert] ✓ Alerta enviado para ${adminName}`);

      // Registrar log da notificação
      await this.logNotification(phone, message, alertData);
    } catch (error) {
      console.error(`[SmartOneAlert] Erro ao processar envio para ${adminName}:`, error);
    }
  }

  /**
   * Registra log da notificação no banco de dados
   */
  private async logNotification(
    phone: string,
    message: string,
    alertData: SmartOneSyncFailureAlert
  ): Promise<void> {
    try {
      await supabase.from('notification_logs').insert({
        phone,
        message_content: message,
        status: 'sent',
        template_name: 'smartone_sync_failure_alert',
        cliente_id: alertData.clienteId,
        sent_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[SmartOneAlert] Erro ao registrar log:', error);
    }
  }
}

// Singleton instance
let smartoneSyncAlertServiceInstance: SmartOneSyncAlertService | null = null;

export const getSmartOneSyncAlertService = (): SmartOneSyncAlertService => {
  if (!smartoneSyncAlertServiceInstance) {
    smartoneSyncAlertServiceInstance = new SmartOneSyncAlertService();
  }
  return smartoneSyncAlertServiceInstance;
};
