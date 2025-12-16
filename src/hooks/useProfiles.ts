/**
 * useProfiles - Hook unificado para gerenciar profiles/clientes
 * Usa queries diretas ao Supabase (sem Edge Functions)
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UnifiedProfile {
  id: string;
  nome: string;
  email: string;
  contact_phone?: string;
  origem_cadastro?: string;
  created_at: string;
  updated_at: string;
  situacao?: string;
  plano?: string;
  data_vencimento?: string;
  data_contratacao?: string;
  valor_pago?: number;
  cliente_ativo?: boolean;
  data_ultimo_pagamento?: string;
  forma_ultimo_pagamento?: string;
  is_recorrente?: boolean;
  dispositivo_contratado?: string;
  roles?: string[];
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<UnifiedProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Query profiles directly
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get roles for all profiles
      const profileIds = profilesData?.map(p => p.id) || [];
      
      let rolesMap = new Map<string, string[]>();
      
      if (profileIds.length > 0) {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', profileIds);

        rolesData?.forEach(r => {
          const existing = rolesMap.get(r.user_id) || [];
          existing.push(r.role);
          rolesMap.set(r.user_id, existing);
        });
      }

      // Map profiles with roles
      const profilesWithRoles: UnifiedProfile[] = (profilesData || []).map(profile => ({
        id: profile.id,
        nome: profile.nome || '',
        email: profile.email || '',
        contact_phone: profile.contact_phone,
        origem_cadastro: profile.origem_cadastro,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        situacao: profile.situacao,
        plano: profile.plano,
        data_vencimento: profile.data_vencimento,
        data_contratacao: profile.data_contratacao,
        valor_pago: profile.valor_pago,
        cliente_ativo: profile.cliente_ativo,
        data_ultimo_pagamento: profile.data_ultimo_pagamento,
        forma_ultimo_pagamento: profile.forma_ultimo_pagamento,
        is_recorrente: profile.is_recorrente,
        dispositivo_contratado: profile.dispositivo_contratado,
        roles: rolesMap.get(profile.id) || ['client'],
      }));

      setProfiles(profilesWithRoles);
    } catch (e: any) {
      console.error('Erro ao carregar profiles:', e);
      setError(e?.message || 'Erro ao carregar profiles');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const updateProfile = useCallback(async (id: string, updates: Partial<UnifiedProfile>) => {
    // Remove readonly fields
    const { roles, ...updateData } = updates;
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (data) {
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
      return data;
    }
  }, []);

  const deleteProfile = useCallback(async (id: string) => {
    // Delete roles first
    await supabase.from('user_roles').delete().eq('user_id', id);
    
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
    
    setProfiles(prev => prev.filter(p => p.id !== id));
  }, []);

  const updateRole = useCallback(async (id: string, role: string) => {
    // Delete existing roles
    await supabase.from('user_roles').delete().eq('user_id', id);
    
    // Insert new role
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: id, role: role as 'admin' | 'client' | 'master' });

    if (error) throw error;
    
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, roles: [role] } : p));
  }, []);

  const getStats = useCallback(() => {
    const total = profiles.length;
    const now = new Date();
    const cincoProximos = new Date();
    cincoProximos.setDate(now.getDate() + 5);

    const ativos = profiles.filter(p => {
      if (!p.cliente_ativo || p.situacao !== 'Ativo') return false;
      if (!p.data_vencimento) return true;
      const vencimento = new Date(p.data_vencimento);
      return vencimento >= now;
    }).length;

    const inativos = profiles.filter(p => 
      p.cliente_ativo === false || p.situacao === 'Inativo'
    ).length;

    const vencendoProximos5Dias = profiles.filter(p => {
      if (!p.data_vencimento) return false;
      const vencimento = new Date(p.data_vencimento);
      return vencimento >= now && vencimento <= cincoProximos;
    }).length;

    const vencidos = profiles.filter(p => {
      if (!p.data_vencimento) return false;
      const vencimento = new Date(p.data_vencimento);
      return vencimento < now;
    }).length;

    const emTeste = profiles.filter(p => p.situacao === 'Testando').length;

    const porSituacao = profiles.reduce((acc, p) => {
      const situacao = p.situacao || 'Indefinido';
      acc[situacao] = (acc[situacao] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { 
      total, 
      ativos,
      inativos,
      vencendoProximos5Dias, 
      vencidos,
      emTeste,
      porSituacao 
    };
  }, [profiles]);

  const stats = useMemo(() => getStats(), [getStats]);

  return {
    profiles,
    loading,
    error,
    refresh: fetchProfiles,
    updateProfile,
    deleteProfile,
    updateRole,
    getStats: () => stats,
  };
}
