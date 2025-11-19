import { supabase } from '@/integrations/supabase/client';
import { NotificationLog } from '@/types/whatsapp';

export function useNotificationLogs() {
  const addLog = async (log: Omit<NotificationLog, 'id' | 'dataEnvio'>) => {
    try {
      await supabase.from('notification_logs').insert({
        cliente_id: log.clienteId,
        phone: log.telefone,
        template_name: log.template,
        message_content: log.tipo,
        status: log.status,
        error_message: log.erro,
      });
    } catch (error) {
      console.error('Erro ao salvar log:', error);
    }
  };

  return { addLog };
}
