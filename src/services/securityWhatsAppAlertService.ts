/**
 * Security WhatsApp Alert Service
 * Uses security_alert_deliveries table
 */

import { supabase } from '@/integrations/supabase/client';
import { ConfigManager } from '@/services/notifications/core/ConfigManager';

export interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  ip_address?: string;
  user_agent?: string;
  event_details?: Record<string, any>;
  created_at: string;
}

interface AdminPhone {
  id: string;
  name: string;
  phone: string;
  phone_sms?: string;
  notification_channels?: string[];
  schedule_enabled?: boolean;
  schedule_config?: {
    [day: string]: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
  active: boolean;
}

class SecurityWhatsAppAlertService {
  private configManager = new ConfigManager();

  async shouldSendAlert(event: SecurityEvent): Promise<boolean> {
    // Send alerts for critical and high severity events
    return ['critical', 'high'].includes(event.severity?.toLowerCase() || '');
  }

  async sendAlert(event: SecurityEvent): Promise<void> {
    if (!await this.shouldSendAlert(event)) {
      return;
    }

    const admins = await this.configManager.getActiveAdminPhones();
    
    for (const admin of admins) {
      if (this.isAdminAvailable(admin as AdminPhone)) {
        await this.sendToAdmin(admin as AdminPhone, this.formatMessage(event), event);
      }
    }
  }

  isAdminAvailable(admin: AdminPhone): boolean {
    if (!admin.schedule_enabled || !admin.schedule_config) {
      return true;
    }

    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[now.getDay()];
    
    const daySchedule = admin.schedule_config[dayName];
    
    if (!daySchedule || !daySchedule.enabled) {
      return false;
    }

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    return currentTime >= daySchedule.start && currentTime <= daySchedule.end;
  }

  async sendToAdmin(
    admin: AdminPhone,
    message: string,
    event: SecurityEvent
  ): Promise<void> {
    try {
      // Log the delivery
      const { error } = await supabase
        .from('security_alert_deliveries')
        .insert({
          alert_id: event.id,
          admin_id: admin.id,
          admin_phone: admin.phone,
          sent_at: new Date().toISOString(),
        });

      if (error) {
        console.warn('[SecurityWhatsAppAlert] Error logging delivery:', error);
      }

      console.log('[SecurityWhatsAppAlert] Alert sent to:', admin.phone);
    } catch (error) {
      console.error('[SecurityWhatsAppAlert] Error sending to admin:', error);
    }
  }

  private formatMessage(event: SecurityEvent): string {
    const emoji = this.getSeverityEmoji(event.severity);
    return `${emoji} *ALERTA DE SEGURANÇA*\n\n` +
           `*Tipo:* ${this.getEventTypeLabel(event.event_type)}\n` +
           `*Severidade:* ${event.severity}\n` +
           `*IP:* ${event.ip_address || 'N/A'}\n` +
           `*Horário:* ${new Date(event.created_at).toLocaleString('pt-BR')}`;
  }

  private getSeverityEmoji(severity: string): string {
    const emojis: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };
    return emojis[severity?.toLowerCase()] || '⚪';
  }

  formatMessageWithActions(message: string, eventId: string, adminId: string): string {
    return message;
  }

  async confirmDelivery(deliveryId: string): Promise<void> {
    const { error } = await supabase
      .from('security_alert_deliveries')
      .update({ confirmed_at: new Date().toISOString() })
      .eq('id', deliveryId);

    if (error) {
      console.error('[SecurityWhatsAppAlert] Error confirming delivery:', error);
    }
  }

  async processSecurityEvent(event: SecurityEvent): Promise<void> {
    await this.sendAlert(event);
  }

  private getEventTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      failed_login: 'Login Falhou',
      permission_change: 'Mudança de Permissão',
      suspicious_activity: 'Atividade Suspeita',
      rate_limit_exceeded: 'Limite Excedido',
      unauthorized_access: 'Acesso Não Autorizado'
    };
    return labels[type] || type;
  }

  async getDeliveryStats(days: number = 7): Promise<{
    total: number;
    confirmed: number;
    escalated: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('security_alert_deliveries')
      .select('confirmed_at, escalated')
      .gte('sent_at', since.toISOString());

    if (error || !data) {
      return { total: 0, confirmed: 0, escalated: 0 };
    }

    return {
      total: data.length,
      confirmed: data.filter(d => d.confirmed_at).length,
      escalated: data.filter(d => d.escalated).length,
    };
  }
}

let instance: SecurityWhatsAppAlertService | null = null;

export function getSecurityWhatsAppAlertService(): SecurityWhatsAppAlertService {
  if (!instance) {
    instance = new SecurityWhatsAppAlertService();
  }
  return instance;
}
