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
   * Busca credenciais WhatsApp
   * TODO: Migrar de localStorage para Supabase
   */
  async getWhatsAppCredentials(): Promise<WhatsAppCredentials | null> {
    // Temporário: ainda usa localStorage
    const configStr = localStorage.getItem('whatsapp_config');
    if (!configStr) return null;

    try {
      const config = JSON.parse(configStr);
      if (!config.appkey || !config.authkey) return null;
      
      return {
        appkey: config.appkey,
        authkey: config.authkey,
      };
    } catch {
      return null;
    }
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
   * Busca configuração completa de notificações
   * TODO: Migrar completamente para Supabase
   */
  async getNotificationConfig(): Promise<NotificationConfig | null> {
    const whatsapp = await this.getWhatsAppCredentials();
    if (!whatsapp) return null;

    // Temporário: configurações de agendamento ainda em localStorage
    const autoConfigStr = localStorage.getItem('auto_notification_config');
    let autoConfig = { enabled: false, sendHour: 10 };
    
    if (autoConfigStr) {
      try {
        autoConfig = JSON.parse(autoConfigStr);
      } catch {}
    }

    return {
      whatsapp,
      autoSendEnabled: autoConfig.enabled,
      sendHour: autoConfig.sendHour,
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
