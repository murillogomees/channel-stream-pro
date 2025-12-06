/**
 * Logger de Notificações
 * Responsável por registrar logs de notificações no Supabase
 */

import { supabase } from '@/integrations/supabase/client';

export interface NotificationLogEntry {
  cliente_id?: string;
  phone: string;
  template_name: string;
  status: 'success' | 'error';
  message_content: string;
  error_message?: string;
}

export class NotificationLogger {
  /**
   * Registra log de notificação no Supabase
   */
  async log(entry: NotificationLogEntry): Promise<void> {
    try {
      const { error } = await supabase.from('notification_logs').insert({
        cliente_id: entry.cliente_id,
        phone: entry.phone,
        template_name: entry.template_name,
        status: entry.status,
        message_content: entry.message_content,
        error_message: entry.error_message,
      });

      if (error) {
        console.error('[NotificationLogger] Erro ao registrar:', error);
      }
    } catch (error) {
      console.error('[NotificationLogger] Exceção ao registrar:', error);
    }
  }

  /**
   * Registra sucesso
   */
  async logSuccess(
    phone: string,
    templateName: string,
    message: string,
    clienteId?: string
  ): Promise<void> {
    await this.log({
      cliente_id: clienteId,
      phone,
      template_name: templateName,
      status: 'success',
      message_content: message,
    });
  }

  /**
   * Registra erro
   */
  async logError(
    phone: string,
    templateName: string,
    message: string,
    errorMessage: string,
    clienteId?: string
  ): Promise<void> {
    await this.log({
      cliente_id: clienteId,
      phone,
      template_name: templateName,
      status: 'error',
      message_content: message,
      error_message: errorMessage,
    });
  }
}
