/**
 * IP Whitelist Service - Simplified
 * Uses ip_whitelist table (existing schema only)
 */

import { supabase } from '@/integrations/supabase/client';

export interface IPWhitelist {
  id: string;
  ip_address: string;
  description: string | null;
  added_by: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

export const ipWhitelistService = {
  /**
   * Busca todos os IPs na whitelist
   */
  async getWhitelistedIPs(): Promise<IPWhitelist[]> {
    try {
      const { data, error } = await supabase
        .from('ip_whitelist')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[IPWhitelist] Erro ao buscar IPs:', error);
        return [];
      }

      return (data || []) as IPWhitelist[];
    } catch (error) {
      console.error('[IPWhitelist] Erro ao buscar IPs:', error);
      return [];
    }
  },

  /**
   * Adiciona IP à whitelist
   */
  async addToWhitelist(ipAddress: string, description?: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('ip_whitelist')
        .insert({
          ip_address: ipAddress,
          description: description || null,
          added_by: user?.id || null,
          is_active: true,
        });

      if (error) {
        console.error('[IPWhitelist] Erro ao adicionar IP:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[IPWhitelist] Erro ao adicionar IP:', error);
      return false;
    }
  },

  /**
   * Remove IP da whitelist
   */
  async removeFromWhitelist(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ip_whitelist')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[IPWhitelist] Erro ao remover IP:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[IPWhitelist] Erro ao remover IP:', error);
      return false;
    }
  },

  /**
   * Atualiza descrição de IP na whitelist
   */
  async updateWhitelistEntry(id: string, description: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ip_whitelist')
        .update({ description })
        .eq('id', id);

      if (error) {
        console.error('[IPWhitelist] Erro ao atualizar IP:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[IPWhitelist] Erro ao atualizar IP:', error);
      return false;
    }
  },

  /**
   * Verifica se um IP está na whitelist
   */
  async isWhitelisted(ipAddress: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('ip_whitelist')
        .select('id')
        .eq('ip_address', ipAddress)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('[IPWhitelist] Erro ao verificar IP:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('[IPWhitelist] Erro ao verificar IP:', error);
      return false;
    }
  }
};
