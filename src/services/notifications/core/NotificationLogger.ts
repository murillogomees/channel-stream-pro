/**
 * Notification Logger - Simplified
 * Logs notifications using sent_notifications table
 */

import { supabase } from '@/integrations/supabase/client';

export interface NotificationLogEntry {
  recipient_id?: string;
  recipient_phone: string;
  template_key: string;
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
      const { error } = await supabase.from('sent_notifications').insert({
        recipient_id: entry.recipient_id || null,
        recipient_phone: entry.recipient_phone,
        template_key: entry.template_key,
        status: entry.status === 'success' ? 'sent' : 'failed',
        message_content: entry.message_content,
        error_message: entry.error_message || null,
        sent_at: new Date().toISOString(),
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
    recipientId?: string
  ): Promise<void> {
    await this.log({
      recipient_id: recipientId,
      recipient_phone: phone,
      template_key: templateName,
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
    recipientId?: string
  ): Promise<void> {
    await this.log({
      recipient_id: recipientId,
      recipient_phone: phone,
      template_key: templateName,
      status: 'error',
      message_content: message,
      error_message: errorMessage,
    });
  }
}
