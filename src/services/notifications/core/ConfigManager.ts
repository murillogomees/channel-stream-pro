/**
 * Gerenciador de Configuração Centralizado
 * Migra configurações de localStorage para Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import { WhatsAppCredentials } from './WhatsAppClient';

export interface NotificationConfig {
  whatsapp: WhatsAppCredentials;
  autoSendEnabled: boolean;
  sendHour: number;
}

export interface AdminPhone {
  id: string;
  phone: string;
  name: string;
  active: boolean;
}

export class ConfigManager {
  /**
   * Busca credenciais WhatsApp do Supabase
   */
  async getWhatsAppCredentials(): Promise<WhatsAppCredentials | null> {
    const { data, error } = await supabase
      .from('whatsapp_config')
      .select('appkey, authkey')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.error('[ConfigManager] Erro ao buscar WhatsApp config:', error);
      return null;
    }

    if (!data.appkey || !data.authkey) return null;
    
    return {
      appkey: data.appkey,
      authkey: data.authkey,
    };
  }

  /**
   * Busca telefones de administradores ativos do Supabase
   */
  async getActiveAdminPhones(): Promise<AdminPhone[]> {
    const { data, error } = await supabase
      .from('admin_phones')
      .select('id, phone, name, active')
      .eq('active', true);

    if (error || !data) {
      console.error('[ConfigManager] Erro ao buscar admin phones:', error);
      return [];
    }

    return data;
  }

  /**
   * Busca configuração completa de notificações do Supabase
   */
  async getNotificationConfig(): Promise<NotificationConfig | null> {
    const whatsapp = await this.getWhatsAppCredentials();
    if (!whatsapp) return null;

    const { data: autoConfig, error } = await supabase
      .from('auto_notification_config')
      .select('enabled, send_hour')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[ConfigManager] Erro ao buscar auto config:', error);
    }

    return {
      whatsapp,
      autoSendEnabled: autoConfig?.enabled || false,
      sendHour: autoConfig?.send_hour || 10,
    };
  }

  /**
   * Valida se configuração está completa
   */
  async validateConfiguration(): Promise<{ valid: boolean; message: string }> {
    const config = await this.getNotificationConfig();
    
    if (!config) {
      return {
        valid: false,
        message: 'Credenciais WhatsApp não configuradas'
      };
    }

    const admins = await this.getActiveAdminPhones();
    if (admins.length === 0) {
      return {
        valid: false,
        message: 'Nenhum administrador ativo configurado'
      };
    }

    return {
      valid: true,
      message: 'Configuração válida'
    };
  }
}
