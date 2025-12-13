/**
 * useProfiles - Hook unificado para gerenciar profiles/clientes
 * Usa Supabase Cloud SDK
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

async function callAdminData(action: string, data?: Record<string, unknown>): Promise<any> {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.access_token) {
    throw new Error('Not authenticated');
  }
  
  const { data: result, error } = await supabase.functions.invoke('admin-data', {
    body: { action, ...data }
  });

  if (error) {
    throw new Error(error.message || 'Request failed');
  }
  
  return result;
}

export interface UnifiedProfile {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  contact_phone?: string;
  telefone_whatsapp?: string;
  origem_cadastro?: string;
  created_at: string;
  updated_at: string;
  // Campos de cliente/assinatura
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
  // Roles
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
      const result = await callAdminData('list-profiles');
      setProfiles(result?.profiles || []);
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
    const result = await callAdminData('update-profile', { profileId: id, data: updates });
    if (result?.profile) {
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...result.profile } : p));
      return result.profile;
    }
  }, []);

  const deleteProfile = useCallback(async (id: string) => {
    await callAdminData('delete-profile', { profileId: id });
    setProfiles(prev => prev.filter(p => p.id !== id));
  }, []);

  const updateRole = useCallback(async (id: string, role: string) => {
    await callAdminData('update-role', { profileId: id, data: { role } });
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, roles: [role] } : p));
  }, []);

  const getStats = useCallback(() => {
    const total = profiles.length;
    const now = new Date();
    const cincoProximos = new Date();
    cincoProximos.setDate(now.getDate() + 5);

    // Ativos: cliente_ativo = true E situação = 'Ativo' E não vencido
    const ativos = profiles.filter(p => {
      if (!p.cliente_ativo || p.situacao !== 'Ativo') return false;
      if (!p.data_vencimento) return true;
      const vencimento = new Date(p.data_vencimento);
      return vencimento >= now;
    }).length;

    // Inativos: cliente_ativo = false OU situação = 'Inativo'
    const inativos = profiles.filter(p => 
      p.cliente_ativo === false || p.situacao === 'Inativo'
    ).length;

    // Vencendo nos próximos 5 dias
    const vencendoProximos5Dias = profiles.filter(p => {
      if (!p.data_vencimento) return false;
      const vencimento = new Date(p.data_vencimento);
      return vencimento >= now && vencimento <= cincoProximos;
    }).length;

    // Vencidos
    const vencidos = profiles.filter(p => {
      if (!p.data_vencimento) return false;
      const vencimento = new Date(p.data_vencimento);
      return vencimento < now;
    }).length;

    // Em teste
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