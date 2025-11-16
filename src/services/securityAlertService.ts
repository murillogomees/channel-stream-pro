import { supabase } from "@/integrations/supabase/client";
import { securityMonitoringService } from "./securityMonitoringService";

export interface AlertConfig {
  id: string;
  alert_name: string;
  enabled: boolean;
  event_type: string;
  threshold: number;
  time_window_minutes: number;
  severity_level: string;
  notification_channels: string[];
  recipient_admin_ids?: string[];
  last_triggered_at?: string;
  trigger_count: number;
}

export const securityAlertService = {
  /**
   * Check alerts and send notifications if thresholds are exceeded
   */
  async checkAlerts(): Promise<void> {
    try {
      // Get all enabled alerts
      const { data: alerts, error } = await supabase
        .from('security_alert_config')
        .select('*')
        .eq('enabled', true);

      if (error || !alerts) {
        console.error('[SecurityAlerts] Failed to fetch alerts:', error);
        return;
      }

      for (const alert of alerts) {
        await this.checkSingleAlert(alert);
      }
    } catch (error) {
      console.error('[SecurityAlerts] Error checking alerts:', error);
    }
  },

  /**
   * Check a single alert configuration
   */
  async checkSingleAlert(alert: AlertConfig): Promise<void> {
    try {
      // Count events in time window
      const windowStart = new Date();
      windowStart.setMinutes(windowStart.getMinutes() - alert.time_window_minutes);

      const { data: events, error } = await supabase
        .from('security_events')
        .select('id')
        .eq('event_type', alert.event_type)
        .gte('created_at', windowStart.toISOString());

      if (error) {
        console.error('[SecurityAlerts] Failed to count events:', error);
        return;
      }

      const eventCount = events?.length || 0;

      // Check if threshold exceeded
      if (eventCount >= alert.threshold) {
        await this.triggerAlert(alert, eventCount);
      }
    } catch (error) {
      console.error('[SecurityAlerts] Error checking single alert:', error);
    }
  },

  /**
   * Trigger an alert and send notifications
   */
  async triggerAlert(alert: AlertConfig, eventCount: number): Promise<void> {
    try {
      // Check cooldown (don't spam - wait at least 15 minutes between same alert)
      if (alert.last_triggered_at) {
        const lastTriggered = new Date(alert.last_triggered_at);
        const cooldownMinutes = 15;
        const cooldownExpires = new Date(lastTriggered.getTime() + cooldownMinutes * 60000);
        
        if (new Date() < cooldownExpires) {
          console.log(`[SecurityAlerts] Alert "${alert.alert_name}" in cooldown`);
          return;
        }
      }

      // Update alert trigger count and timestamp
      await supabase
        .from('security_alert_config')
        .update({
          last_triggered_at: new Date().toISOString(),
          trigger_count: alert.trigger_count + 1
        })
        .eq('id', alert.id);

      // Log as security event
      await securityMonitoringService.logEvent({
        event_type: 'suspicious_activity',
        severity: alert.severity_level as any,
        event_details: {
          alert_name: alert.alert_name,
          event_type: alert.event_type,
          threshold: alert.threshold,
          actual_count: eventCount,
          time_window_minutes: alert.time_window_minutes
        }
      });

      // Send notifications based on channels
      const channels = alert.notification_channels || ['database'];
      
      if (channels.includes('whatsapp')) {
        await this.sendWhatsAppAlert(alert, eventCount);
      }

      console.log(`[SecurityAlerts] Alert "${alert.alert_name}" triggered: ${eventCount} events`);
    } catch (error) {
      console.error('[SecurityAlerts] Error triggering alert:', error);
    }
  },

  /**
   * Send WhatsApp alert to admins
   */
  async sendWhatsAppAlert(alert: AlertConfig, eventCount: number): Promise<void> {
    try {
      // Get admin phones
      const { data: adminPhones, error } = await supabase
        .from('admin_phones')
        .select('phone, name')
        .eq('active', true);

      if (error || !adminPhones || adminPhones.length === 0) {
        console.error('[SecurityAlerts] No admin phones found:', error);
        return;
      }

      const message = `🚨 *ALERTA DE SEGURANÇA*\n\n` +
        `*${alert.alert_name}*\n\n` +
        `📊 *Eventos detectados:* ${eventCount}\n` +
        `⏱️ *Período:* ${alert.time_window_minutes} minutos\n` +
        `🎯 *Limite:* ${alert.threshold}\n` +
        `⚠️ *Severidade:* ${alert.severity_level}\n\n` +
        `Acesse o Monitor de Segurança para mais detalhes.`;

      // Call WhatsApp notification service (would need to implement this)
      console.log('[SecurityAlerts] WhatsApp alert would be sent:', message);
      
    } catch (error) {
      console.error('[SecurityAlerts] Error sending WhatsApp alert:', error);
    }
  },

  /**
   * Get all alert configurations
   */
  async getAlertConfigs(): Promise<AlertConfig[]> {
    try {
      const { data, error } = await supabase
        .from('security_alert_config')
        .select('*')
        .order('severity_level', { ascending: false });

      if (error) {
        console.error('[SecurityAlerts] Failed to fetch configs:', error);
        return [];
      }

      return (data || []).map(config => ({
        ...config,
        notification_channels: Array.isArray(config.notification_channels) 
          ? config.notification_channels 
          : JSON.parse(config.notification_channels as string)
      })) as AlertConfig[];
    } catch (error) {
      console.error('[SecurityAlerts] Error getting alert configs:', error);
      return [];
    }
  },

  /**
   * Update alert configuration
   */
  async updateAlertConfig(id: string, updates: Partial<AlertConfig>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('security_alert_config')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('[SecurityAlerts] Failed to update config:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SecurityAlerts] Error updating alert config:', error);
      return false;
    }
  }
};
