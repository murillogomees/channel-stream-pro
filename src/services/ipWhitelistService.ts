/**
 * SERVIÇO DE GERENCIAMENTO DE WHITELIST DE IPs
 * 
 * Gerencia IPs confiáveis que nunca são bloqueados
 */

import { supabase } from '@/integrations/supabase/client';

export interface IPWhitelist {
  id: string;
  ip_address: string;
  description: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
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

      return data || [];
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
          added_by: user?.id
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
        .single();

      if (error && error.code !== 'PGRST116') {
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
