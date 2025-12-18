/**
 * ProfileService - Serviço centralizado e otimizado para operações de profiles
 * Otimizado para reduzir egress com projeções de colunas específicas
 */

import { supabase } from '@/integrations/supabase/client';

// Projeções de colunas por caso de uso (reduz egress significativamente)
const COLUMNS = {
  // Lista básica (admin table) - 7 colunas vs 25
  list: 'id,nome,email,contact_phone,situacao,plano,data_vencimento,cliente_ativo,created_at',
  
  // Detalhes completos (formulário de edição)
  detail: 'id,nome,email,contact_phone,origem_cadastro,situacao,plano,data_vencimento,valor_pago,data_contratacao,cliente_ativo,is_recorrente,data_ultimo_pagamento,forma_ultimo_pagamento,dispositivo_contratado,created_at,updated_at',
  
  // Auth context - mínimo necessário
  auth: 'id,nome,email,contact_phone,origem_cadastro,situacao,plano,data_vencimento,valor_pago,cliente_ativo,created_at,updated_at',
  
  // Identificação (nome/email para logs, etc)
  identity: 'id,nome,email',
  
  // Status de assinatura
  subscription: 'id,plano,situacao,data_vencimento,cliente_ativo',
  
  // Contato (WhatsApp/notificações)
  contact: 'id,nome,contact_phone',
} as const;

export type ProfileProjection = keyof typeof COLUMNS;

export interface ProfileListItem {
  id: string;
  nome: string;
  email: string;
  contact_phone?: string;
  situacao?: string;
  plano?: string;
  data_vencimento?: string;
  cliente_ativo?: boolean;
  created_at: string;
}

export interface ProfileDetail extends ProfileListItem {
  origem_cadastro?: string;
  valor_pago?: number;
  data_contratacao?: string;
  is_recorrente?: boolean;
  data_ultimo_pagamento?: string;
  forma_ultimo_pagamento?: string;
  dispositivo_contratado?: string;
  updated_at: string;
}

export interface ProfileIdentity {
  id: string;
  nome: string;
  email: string;
}

export interface ProfileSubscription {
  id: string;
  plano?: string;
  situacao?: string;
  data_vencimento?: string;
  cliente_ativo?: boolean;
}

export interface ProfileContact {
  id: string;
  nome: string;
  contact_phone?: string;
}

// Stats da materialized view (pré-computados no banco)
export interface ProfileStats {
  total_users: number;
  active_users: number;
  trial_users: number;
  expired_users: number;
  expiring_soon: number;
  last_refresh: string;
}

class ProfileService {
  /**
   * Busca lista de profiles com projeção otimizada
   */
  async getList(): Promise<ProfileListItem[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select(COLUMNS.list)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Busca profile completo por ID
   */
  async getById(id: string): Promise<ProfileDetail | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select(COLUMNS.detail)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Busca identidades (nome/email) para lista de IDs
   * Útil para logs e referências cruzadas
   */
  async getIdentities(ids: string[]): Promise<Map<string, ProfileIdentity>> {
    if (ids.length === 0) return new Map();
    
    const { data, error } = await supabase
      .from('profiles')
      .select(COLUMNS.identity)
      .in('id', ids);

    if (error) throw error;
    
    const map = new Map<string, ProfileIdentity>();
    data?.forEach(p => map.set(p.id, p));
    return map;
  }

  /**
   * Busca status de assinatura por ID
   */
  async getSubscription(id: string): Promise<ProfileSubscription | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select(COLUMNS.subscription)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Busca contatos para notificações
   */
  async getContacts(ids?: string[]): Promise<ProfileContact[]> {
    let query = supabase
      .from('profiles')
      .select(COLUMNS.contact)
      .not('contact_phone', 'is', null);
    
    if (ids?.length) {
      query = query.in('id', ids);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Busca stats da materialized view (MUITO mais eficiente)
   * Retorna dados pré-computados, não precisa processar no frontend
   */
  async getStats(): Promise<ProfileStats> {
    const { data, error } = await supabase
      .from('mv_dashboard_summary')
      .select('total_users,active_users,trial_users,expired_users,expiring_soon,last_refresh')
      .limit(1)
      .single();

    if (error) {
      console.warn('[ProfileService] mv_dashboard_summary error, falling back:', error);
      // Fallback com contagem simples se view não existir
      return this.getStatsFallback();
    }
    
    return data;
  }

  /**
   * Fallback para stats se materialized view não disponível
   */
  private async getStatsFallback(): Promise<ProfileStats> {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    return {
      total_users: count || 0,
      active_users: 0,
      trial_users: 0,
      expired_users: 0,
      expiring_soon: 0,
      last_refresh: new Date().toISOString(),
    };
  }

  /**
   * Atualiza profile
   */
  async update(id: string, data: Partial<ProfileDetail>): Promise<ProfileDetail | null> {
    // Remove campos readonly
    const { id: _, created_at, ...updateData } = data as any;
    
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(COLUMNS.detail)
      .single();

    if (error) throw error;
    return updated;
  }

  /**
   * Deleta profile (e roles associadas)
   */
  async delete(id: string): Promise<void> {
    // Deleta roles primeiro
    await supabase.from('user_roles').delete().eq('user_id', id);
    
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
  }

  /**
   * Busca profile para AuthContext (projeção específica)
   */
  async getForAuth(id: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select(COLUMNS.auth)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

export const profileService = new ProfileService();
