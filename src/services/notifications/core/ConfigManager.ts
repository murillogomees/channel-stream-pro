/**
 * Gerenciador de Configuração Centralizado
 * Uses whatsapp_config table (existing schema)
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
   * whatsapp_config table has: app_key, auth_key
   */
  async getWhatsAppCredentials(): Promise<WhatsAppCredentials | null> {
    const { data, error } = await supabase
      .from('whatsapp_config')
      .select('app_key, auth_key, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.error('[ConfigManager] Erro ao buscar WhatsApp config:', error);
      return null;
    }

    if (!data.app_key || !data.auth_key) return null;
    
    return {
      appkey: data.app_key,
      authkey: data.auth_key,
    };
  }

  /**
   * Busca telefones de administradores ativos
   * Uses profiles table with admin role
   */
  async getActiveAdminPhones(): Promise<AdminPhone[]> {
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        profiles:user_id (
          id,
          contact_phone,
          nome
        )
      `)
      .in('role', ['admin', 'master']);

    if (error || !data) {
      console.error('[ConfigManager] Erro ao buscar admin phones:', error);
      return [];
    }

    return data
      .filter((r: any) => r.profiles?.contact_phone)
      .map((r: any) => ({
        id: r.profiles.id,
        phone: r.profiles.contact_phone,
        name: r.profiles.nome || 'Admin',
        active: true,
      }));
  }

  /**
   * Busca configuração completa de notificações
   */
  async getNotificationConfig(): Promise<NotificationConfig | null> {
    const whatsapp = await this.getWhatsAppCredentials();
    if (!whatsapp) return null;

    return {
      whatsapp,
      autoSendEnabled: true,
      sendHour: 10,
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
