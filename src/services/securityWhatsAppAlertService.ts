import { supabase } from "@/integrations/supabase/client";
import { WhatsAppAdapter } from "./notifications/core/WhatsAppAdapter";
import { SecurityEvent } from "./securityMonitoringService";
import { SecurityAlertTemplate } from "@/types/securityAlert";

interface AdminPhone {
  id: string;
  name: string;
  phone: string;
  active: boolean;
}

interface AlertConfig {
  id: string;
  alert_name: string;
  event_type: string;
  threshold: number;
  time_window_minutes: number;
  severity_level: string;
  enabled: boolean;
  last_triggered_at?: string;
  notification_channels: string[];
}

interface AlertDelivery {
  id: string;
  security_event_id: string;
  admin_phone_id: string;
  sent_at: string;
  confirmed_at?: string;
  escalated: boolean;
  delivery_status: string;
}

class SecurityWhatsAppAlertService {
  private whatsAppAdapter: WhatsAppAdapter;
  private alertCooldown = 10 * 60 * 1000; // 10 minutos entre alertas do mesmo tipo

  constructor() {
    this.whatsAppAdapter = new WhatsAppAdapter();
  }

  /**
   * Verifica se deve enviar alerta para um evento
   */
  async shouldSendAlert(event: SecurityEvent): Promise<boolean> {
    // Só envia para eventos críticos ou warnings específicos
    if (event.severity !== 'critical' && 
        !['failed_login', 'permission_change', 'suspicious_activity'].includes(event.event_type)) {
      return false;
    }

    // Verifica se WhatsApp está configurado
    if (!this.whatsAppAdapter.isConfigured()) {
      console.log('[SecurityAlert] WhatsApp não configurado');
      return false;
    }

    // Busca configuração do alerta
    const config = await this.getAlertConfig(event.event_type);
    if (!config || !config.enabled) {
      return false;
    }

    // Verifica threshold (número de eventos no período)
    const recentCount = await this.countRecentEvents(
      event.event_type,
      config.time_window_minutes
    );

    if (recentCount < config.threshold) {
      return false;
    }

    // Verifica cooldown
    if (config.last_triggered_at) {
      const lastTrigger = new Date(config.last_triggered_at).getTime();
      const now = Date.now();
      if (now - lastTrigger < this.alertCooldown) {
        console.log('[SecurityAlert] Cooldown ativo para', event.event_type);
        return false;
      }
    }

    return true;
  }

  /**
   * Envia alerta para admins
   */
  async sendAlert(event: SecurityEvent): Promise<void> {
    try {
      const admins = await this.getActiveAdmins();
      
      if (admins.length === 0) {
        console.log('[SecurityAlert] Nenhum admin ativo para notificar');
        return;
      }

      const message = await this.formatAlertMessage(event);

      // Envia para todos os admins ativos em paralelo
      const sendPromises = admins.map(admin => 
        this.sendToAdmin(admin, message, event)
      );

      await Promise.allSettled(sendPromises);

      // Atualiza última vez que o alerta foi disparado
      await this.updateLastTriggered(event.event_type);

      console.log(`[SecurityAlert] Alerta enviado para ${admins.length} admin(s)`);
    } catch (error) {
      console.error('[SecurityAlert] Erro ao enviar alerta:', error);
    }
  }

  /**
   * Envia mensagem para um admin específico
   */
  private async sendToAdmin(
    admin: AdminPhone,
    message: string,
    event: SecurityEvent
  ): Promise<void> {
    try {
      await this.whatsAppAdapter.sendText(admin.phone, message);
      
      // Registra entrega para tracking de confirmação
      await this.recordDelivery(event.id, admin.id, 'sent');
      
      console.log(`[SecurityAlert] Alerta enviado para ${admin.name} (${admin.phone})`);
    } catch (error) {
      await this.recordDelivery(event.id, admin.id, 'failed', error as Error);
      console.error(`[SecurityAlert] Falha ao enviar para ${admin.name}:`, error);
    }
  }

  /**
   * Registra entrega de alerta
   */
  private async recordDelivery(
    eventId: string,
    adminId: string,
    status: string,
    error?: Error
  ): Promise<void> {
    try {
      await supabase
        .from('security_alert_deliveries')
        .insert({
          security_event_id: eventId,
          admin_phone_id: adminId,
          delivery_status: status,
          error_message: error?.message,
        });
    } catch (error) {
      console.error('[SecurityAlert] Erro ao registrar entrega:', error);
    }
  }

  /**
   * Confirma recebimento de alerta (webhook ou API)
   */
  async confirmDelivery(deliveryId: string): Promise<void> {
    try {
      await supabase
        .from('security_alert_deliveries')
        .update({ 
          confirmed_at: new Date().toISOString(),
          delivery_status: 'confirmed'
        })
        .eq('id', deliveryId);
      
      console.log(`[SecurityAlert] Entrega confirmada: ${deliveryId}`);
    } catch (error) {
      console.error('[SecurityAlert] Erro ao confirmar entrega:', error);
    }
  }

  /**
   * Formata mensagem de alerta usando template customizado
   */
  private async formatAlertMessage(event: SecurityEvent): Promise<string> {
    // Busca template customizado
    const template = await this.getTemplate(event.event_type);
    
    if (!template) {
      // Fallback para mensagem padrão se não houver template
      return this.formatDefaultMessage(event);
    }

    // Substitui variáveis no template
    return this.fillTemplate(template.message_template, event);
  }

  /**
   * Busca template para tipo de evento
   */
  private async getTemplate(eventType: string): Promise<SecurityAlertTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('security_alert_templates')
        .select('*')
        .eq('event_type', eventType)
        .eq('enabled', true)
        .single();

      if (error) {
        console.log('[SecurityAlert] Template não encontrado para', eventType);
        return null;
      }

      return data as SecurityAlertTemplate;
    } catch (error) {
      console.error('[SecurityAlert] Erro ao buscar template:', error);
      return null;
    }
  }

  /**
   * Preenche template com dados do evento
   */
  private fillTemplate(template: string, event: SecurityEvent): string {
    const timestamp = new Date(event.created_at).toLocaleString('pt-BR');
    
    let message = template;
    
    // Variáveis comuns
    message = message.replace(/{timestamp}/g, timestamp);
    message = message.replace(/{severity}/g, event.severity.toUpperCase());
    message = message.replace(/{ip_address}/g, event.ip_address || 'N/A');
    message = message.replace(/{event_type}/g, this.getEventTypeLabel(event.event_type));

    // Variáveis específicas por tipo
    if (event.event_details) {
      const details = event.event_details as any;
      
      message = message.replace(/{email}/g, details.email || 'N/A');
      message = message.replace(/{old_role}/g, details.old_role || 'N/A');
      message = message.replace(/{new_role}/g, details.new_role || 'N/A');
      message = message.replace(/{description}/g, details.description || 'N/A');
      message = message.replace(/{endpoint}/g, details.endpoint || 'N/A');
      message = message.replace(/{resource}/g, details.resource || 'N/A');
    }

    return message;
  }

  /**
   * Mensagem padrão (fallback)
   */
  private formatDefaultMessage(event: SecurityEvent): string {
    const timestamp = new Date(event.created_at).toLocaleString('pt-BR');
    const severityEmoji = event.severity === 'critical' ? '🚨' : '⚠️';
    
    let message = `${severityEmoji} *ALERTA DE SEGURANÇA*\n\n`;
    message += `*Tipo:* ${this.getEventTypeLabel(event.event_type)}\n`;
    message += `*Severidade:* ${event.severity.toUpperCase()}\n`;
    message += `*Data/Hora:* ${timestamp}\n`;

    if (event.ip_address) {
      message += `*IP:* ${event.ip_address}\n`;
    }

    message += `\n_Acesse o painel de segurança para mais detalhes._`;

    return message;
  }

  /**
   * Retorna label legível para tipo de evento
   */
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

  /**
   * Busca admins ativos para notificação
   */
  private async getActiveAdmins(): Promise<AdminPhone[]> {
    try {
      const { data, error } = await supabase
        .from('admin_phones')
        .select('*')
        .eq('active', true);

      if (error) {
        console.error('[SecurityAlert] Erro ao buscar admins:', error);
        return [];
      }

      return (data || []) as AdminPhone[];
    } catch (error) {
      console.error('[SecurityAlert] Erro ao buscar admins:', error);
      return [];
    }
  }

  /**
   * Busca configuração de alerta para um tipo de evento
   */
  private async getAlertConfig(eventType: string): Promise<AlertConfig | null> {
    try {
      const { data, error } = await supabase
        .from('security_alert_config')
        .select('*')
        .eq('event_type', eventType)
        .eq('enabled', true)
        .single();

      if (error) {
        // Se não encontrou, retorna null (não é necessariamente erro)
        return null;
      }

      return data as AlertConfig;
    } catch (error) {
      console.error('[SecurityAlert] Erro ao buscar config:', error);
      return null;
    }
  }

  /**
   * Conta eventos recentes de um tipo
   */
  private async countRecentEvents(
    eventType: string,
    windowMinutes: number
  ): Promise<number> {
    try {
      const windowStart = new Date();
      windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

      const { count, error } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', eventType)
        .gte('created_at', windowStart.toISOString());

      if (error) {
        console.error('[SecurityAlert] Erro ao contar eventos:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('[SecurityAlert] Erro ao contar eventos:', error);
      return 0;
    }
  }

  /**
   * Atualiza timestamp do último disparo
   */
  private async updateLastTriggered(eventType: string): Promise<void> {
    try {
      // First get current count
      const { data: current } = await supabase
        .from('security_alert_config')
        .select('trigger_count')
        .eq('event_type', eventType)
        .single();

      const newCount = (current?.trigger_count || 0) + 1;

      await supabase
        .from('security_alert_config')
        .update({ 
          last_triggered_at: new Date().toISOString(),
          trigger_count: newCount
        })
        .eq('event_type', eventType);
    } catch (error) {
      console.error('[SecurityAlert] Erro ao atualizar last_triggered:', error);
    }
  }

  /**
   * Processa um evento de segurança (chamado automaticamente)
   */
  async processSecurityEvent(event: SecurityEvent): Promise<void> {
    const shouldSend = await this.shouldSendAlert(event);
    
    if (shouldSend) {
      await this.sendAlert(event);
    }
  }
}

// Singleton
let instance: SecurityWhatsAppAlertService | null = null;

export function getSecurityWhatsAppAlertService(): SecurityWhatsAppAlertService {
  if (!instance) {
    instance = new SecurityWhatsAppAlertService();
  }
  return instance;
}

export { SecurityWhatsAppAlertService };
