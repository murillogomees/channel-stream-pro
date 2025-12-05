import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AffiliateTier {
  id: string;
  name: string;
  min_referrals: number;
  min_revenue: number;
  commission_percentage: number;
  bonus_amount: number;
  icon: string;
  color: string;
  description: string;
  created_at: string;
}

export function useAffiliateTiers() {
  const [tiers, setTiers] = useState<AffiliateTier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('affiliate_tiers')
        .select('*')
        .order('commission_percentage', { ascending: true });

      if (error) throw error;
      setTiers(data || []);
    } catch (error: any) {
      console.error('Error fetching tiers:', error);
      toast.error('Erro ao carregar tiers');
    } finally {
      setLoading(false);
    }
  };

  const createTier = async (tier: Omit<AffiliateTier, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('affiliate_tiers')
        .insert(tier)
        .select()
        .single();

      if (error) throw error;
      setTiers(prev => [...prev, data]);
      toast.success('Tier criado com sucesso');
      return data;
    } catch (error: any) {
      console.error('Error creating tier:', error);
      toast.error('Erro ao criar tier');
      throw error;
    }
  };

  const updateTier = async (id: string, updates: Partial<AffiliateTier>) => {
    try {
      const { data, error } = await supabase
        .from('affiliate_tiers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setTiers(prev => prev.map(t => t.id === id ? data : t));
      toast.success('Tier atualizado com sucesso');
      return data;
    } catch (error: any) {
      console.error('Error updating tier:', error);
      toast.error('Erro ao atualizar tier');
      throw error;
    }
  };

  const deleteTier = async (id: string) => {
    try {
      const { error } = await supabase
        .from('affiliate_tiers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTiers(prev => prev.filter(t => t.id !== id));
      toast.success('Tier removido com sucesso');
    } catch (error: any) {
      console.error('Error deleting tier:', error);
      toast.error('Erro ao remover tier');
      throw error;
    }
  };

  useEffect(() => {
    fetchTiers();
  }, []);

  return {
    tiers,
    loading,
    fetchTiers,
    createTier,
    updateTier,
    deleteTier
  };
}
