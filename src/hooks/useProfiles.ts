/**
 * useProfiles - Hook unificado e otimizado para gerenciar profiles
 * Usa projeções de colunas específicas para reduzir egress
 * Stats vêm da materialized view (pré-computados no banco)
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { profileService, ProfileListItem, ProfileStats } from '@/services/profileService';

export interface UnifiedProfile extends ProfileListItem {
  updated_at?: string;
  origem_cadastro?: string;
  valor_pago?: number;
  data_contratacao?: string;
  is_recorrente?: boolean;
  data_ultimo_pagamento?: string;
  forma_ultimo_pagamento?: string;
  dispositivo_contratado?: string;
  roles?: string[];
}

interface ProfileStatsExtended extends ProfileStats {
  total: number;
  ativos: number;
  inativos: number;
  vencendoProximos5Dias: number;
  vencidos: number;
  emTeste: number;
  porSituacao: Record<string, number>;
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<UnifiedProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ProfileStatsExtended | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Busca lista otimizada (apenas colunas necessárias)
      const profilesList = await profileService.getList();
      const profileIds = profilesList.map(p => p.id);
      
      // Busca roles separadamente
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

      // Mapeia profiles com roles
      const profilesWithRoles: UnifiedProfile[] = profilesList.map(profile => ({
        ...profile,
        roles: rolesMap.get(profile.id) || ['client'],
      }));

      setProfiles(profilesWithRoles);
      
      // Busca stats da materialized view
      const mvStats = await profileService.getStats();
      
      // Calcula stats adicionais a partir dos profiles carregados
      const now = new Date();
      const cincoProximos = new Date();
      cincoProximos.setDate(now.getDate() + 5);

      const porSituacao = profilesWithRoles.reduce((acc, p) => {
        const situacao = p.situacao || 'Indefinido';
        acc[situacao] = (acc[situacao] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const vencidos = profilesWithRoles.filter(p => {
        if (!p.data_vencimento) return false;
        return new Date(p.data_vencimento) < now;
      }).length;

      const vencendoProximos5Dias = profilesWithRoles.filter(p => {
        if (!p.data_vencimento) return false;
        const vencimento = new Date(p.data_vencimento);
        return vencimento >= now && vencimento <= cincoProximos;
      }).length;

      setStats({
        ...mvStats,
        total: mvStats.total_users,
        ativos: mvStats.active_users,
        inativos: mvStats.expired_users,
        vencendoProximos5Dias,
        vencidos,
        emTeste: mvStats.trial_users,
        porSituacao,
      });
      
    } catch (e: any) {
      console.error('[useProfiles] Error:', e);
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
    const { roles, ...updateData } = updates;
    const updated = await profileService.update(id, updateData);
    
    if (updated) {
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
    }
    
    return updated;
  }, []);

  const deleteProfile = useCallback(async (id: string) => {
    await profileService.delete(id);
    setProfiles(prev => prev.filter(p => p.id !== id));
  }, []);

  const updateRole = useCallback(async (id: string, role: string) => {
    await supabase.from('user_roles').delete().eq('user_id', id);
    
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: id, role: role as 'admin' | 'client' | 'master' });

    if (error) throw error;
    
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, roles: [role] } : p));
  }, []);

  const getStats = useCallback(() => {
    if (!stats) {
      return {
        total: profiles.length,
        ativos: 0,
        inativos: 0,
        vencendoProximos5Dias: 0,
        vencidos: 0,
        emTeste: 0,
        porSituacao: {},
      };
    }
    return stats;
  }, [stats, profiles.length]);

  return {
    profiles,
    loading,
    error,
    refresh: fetchProfiles,
    updateProfile,
    deleteProfile,
    updateRole,
    getStats,
  };
}
