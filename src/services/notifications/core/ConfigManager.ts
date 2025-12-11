/**
 * Gerenciador de Configuração Centralizado
 * Uses whatsapp_config and admin_phones tables
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
  priority?: number;
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
   * First checks admin_phones table, then falls back to profiles
   */
  async getActiveAdminPhones(): Promise<AdminPhone[]> {
    // Try admin_phones table first
    const { data: adminPhones, error: phonesError } = await supabase
      .from('admin_phones')
      .select('id, admin_id, phone, priority, is_active')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (!phonesError && adminPhones?.length) {
      // Get admin names from profiles
      const adminIds = adminPhones.map(p => p.admin_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', adminIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.nome]) || []);

      return adminPhones.map(p => ({
        id: p.id,
        phone: p.phone,
        name: profileMap.get(p.admin_id) || 'Admin',
        active: p.is_active || false,
        priority: p.priority || 0,
      }));
    }

    // Fallback to profiles table with admin role
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

  /**
   * Add admin phone
   */
  async addAdminPhone(adminId: string, phone: string, priority: number = 0): Promise<boolean> {
    const { error } = await supabase
      .from('admin_phones')
      .insert({
        admin_id: adminId,
        phone,
        priority,
        is_active: true,
      });

    if (error) {
      console.error('[ConfigManager] Error adding admin phone:', error);
      return false;
    }

    return true;
  }

  /**
   * Remove admin phone
   */
  async removeAdminPhone(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('admin_phones')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[ConfigManager] Error removing admin phone:', error);
      return false;
    }

    return true;
  }
}
