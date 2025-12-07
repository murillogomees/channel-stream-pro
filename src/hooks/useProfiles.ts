/**
 * useProfiles - Hook unificado para gerenciar profiles/clientes
 * Substitui useClientesDb após unificação das tabelas
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UnifiedProfile {
  id: string;
  nome: string;
  email: string;
  telefone: string;
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
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<UnifiedProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Buscar todos os profiles (admins têm acesso via RLS policy)
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar profiles:', error);
        throw error;
      }

      setProfiles(data || []);
    } catch (e: any) {
      console.error('Erro ao carregar profiles:', e);
      setError(e?.message || 'Erro ao carregar profiles');
      // Em caso de erro, definir array vazio para evitar crashes
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();

    // Realtime subscription
    const subscription = supabase
      .channel('profiles_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' }, 
        () => {
          fetchProfiles();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfiles]);

  const updateProfile = useCallback(async (id: string, updates: Partial<UnifiedProfile>) => {
    const { data, error } = await (supabase as any)
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    if (data) {
      setProfiles(prev => prev.map(p => p.id === id ? data : p));
      return data;
    }
  }, []);

  const deleteProfile = useCallback(async (id: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
    setProfiles(prev => prev.filter(p => p.id !== id));
  }, []);

  const getStats = useCallback(() => {
    const total = profiles.length;
    const now = new Date();
    const cincoProximos = new Date();
    cincoProximos.setDate(now.getDate() + 5);

    // Ativos: cliente_ativo = true E situação = 'Ativo' E não vencido
    const ativos = profiles.filter(p => {
      if (!p.cliente_ativo || p.situacao !== 'Ativo') return false;
      if (!p.data_vencimento) return true; // Sem data = considerado ativo
      const vencimento = new Date(p.data_vencimento);
      return vencimento >= now;
    }).length;

    // Inativos: cliente_ativo = false OU situação = 'Inativo'
    const inativos = profiles.filter(p => 
      p.cliente_ativo === false || p.situacao === 'Inativo'
    ).length;

    // Vencendo nos próximos 5 dias (com assinatura ainda válida)
    const vencendoProximos5Dias = profiles.filter(p => {
      if (!p.data_vencimento) return false;
      const vencimento = new Date(p.data_vencimento);
      return vencimento >= now && vencimento <= cincoProximos;
    }).length;

    // Vencidos: data_vencimento < hoje (independente do status)
    const vencidos = profiles.filter(p => {
      if (!p.data_vencimento) return false;
      const vencimento = new Date(p.data_vencimento);
      return vencimento < now;
    }).length;

    // Em teste: situação = 'Testando'
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
    getStats: () => stats,
  };
}
