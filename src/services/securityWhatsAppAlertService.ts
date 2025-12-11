// Simplified Security WhatsApp Alert Service - Placeholder implementation

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
  async shouldSendAlert(event: SecurityEvent): Promise<boolean> {
    console.log('[SecurityWhatsAppAlertService] shouldSendAlert - placeholder');
    return false;
  }

  async sendAlert(event: SecurityEvent): Promise<void> {
    console.log('[SecurityWhatsAppAlertService] sendAlert - placeholder');
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
    console.log('[SecurityWhatsAppAlertService] sendToAdmin - placeholder');
  }

  formatMessageWithActions(message: string, eventId: string, adminId: string): string {
    return message;
  }

  async confirmDelivery(deliveryId: string): Promise<void> {
    console.log('[SecurityWhatsAppAlertService] confirmDelivery - placeholder');
  }

  async processSecurityEvent(event: SecurityEvent): Promise<void> {
    console.log('[SecurityWhatsAppAlertService] processSecurityEvent - placeholder');
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
}

let instance: SecurityWhatsAppAlertService | null = null;

export function getSecurityWhatsAppAlertService(): SecurityWhatsAppAlertService {
  if (!instance) {
    instance = new SecurityWhatsAppAlertService();
  }
  return instance;
}
