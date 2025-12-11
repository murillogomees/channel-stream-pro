import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Affiliate {
  id: string;
  user_id?: string;
  cliente_id?: string;
  name: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended';
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  total_referrals: number;
  total_earnings: number;
  available_balance: number;
  pix_key?: string;
  pix_key_type?: 'cpf' | 'phone' | 'email' | 'random';
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // New fields from affiliate system expansion
  custom_slug?: string;
  tier_id?: string;
  is_recurring_enabled?: boolean;
  fraud_score?: number;
  last_click_at?: string;
  total_clicks?: number;
  conversion_rate?: number;
}

export interface AffiliateReferral {
  id: string;
  affiliate_id: string;
  referred_user_id?: string;
  referred_cliente_id?: string;
  coupon_id?: string;
  plan_purchased?: string;
  plan_value?: number;
  commission_type: string;
  commission_value: number;
  commission_earned: number;
  status: 'pending' | 'confirmed' | 'paid' | 'cancelled';
  confirmed_at?: string;
  paid_at?: string;
  created_at: string;
}

export interface AffiliateWithdrawal {
  id: string;
  affiliate_id: string;
  amount: number;
  withdrawal_type: 'pix' | 'credit';
  pix_key?: string;
  pix_key_type?: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  processed_by?: string;
  processed_at?: string;
  rejection_reason?: string;
  transaction_id?: string;
  notes?: string;
  created_at: string;
}

export function useAffiliates() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAffiliates = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAffiliates((data || []) as Affiliate[]);
    } catch (error) {
      console.error('Error fetching affiliates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAffiliates();
  }, [fetchAffiliates]);

  const createAffiliate = async (affiliateData: Omit<Affiliate, 'id' | 'created_at' | 'updated_at' | 'total_referrals' | 'total_earnings' | 'available_balance'>) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .insert({
          name: affiliateData.name,
          code: affiliateData.name?.toLowerCase().replace(/\s+/g, '-') || `aff-${Date.now()}`,
          user_id: affiliateData.user_id || null,
          status: affiliateData.status || 'active',
          commission_type: affiliateData.commission_type || 'percentage',
          commission_value: affiliateData.commission_value || 10,
          is_active: affiliateData.status === 'active',
        });

      if (error) throw error;
      await fetchAffiliates();
      return { success: true };
    } catch (error) {
      console.error('Error creating affiliate:', error);
      return { success: false, error };
    }
  };

  const updateAffiliate = async (id: string, updates: Partial<Affiliate>) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await fetchAffiliates();
      return { success: true };
    } catch (error) {
      console.error('Error updating affiliate:', error);
      return { success: false, error };
    }
  };

  const deleteAffiliate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchAffiliates();
      return { success: true };
    } catch (error) {
      console.error('Error deleting affiliate:', error);
      return { success: false, error };
    }
  };

  return {
    affiliates,
    loading,
    fetchAffiliates,
    createAffiliate,
    updateAffiliate,
    deleteAffiliate,
  };
}

// Hook for affiliate's own data
export function useMyAffiliate() {
  const { user } = useAuth();
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([]);
  const [withdrawals, setWithdrawals] = useState<AffiliateWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyAffiliate = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setAffiliate(data as Affiliate | null);

      if (data) {
        // Fetch referrals
        const { data: refs } = await supabase
          .from('affiliate_referrals')
          .select('*')
          .eq('affiliate_id', data.id)
          .order('created_at', { ascending: false });
        setReferrals((refs || []) as AffiliateReferral[]);

        // Fetch withdrawals
        const { data: withs } = await supabase
          .from('affiliate_withdrawals')
          .select('*')
          .eq('affiliate_id', data.id)
          .order('created_at', { ascending: false });
        setWithdrawals((withs || []) as AffiliateWithdrawal[]);
      }
    } catch (error) {
      console.error('Error fetching my affiliate data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyAffiliate();
  }, [fetchMyAffiliate]);

  const updatePixInfo = async (pixKey: string, pixKeyType: 'cpf' | 'phone' | 'email' | 'random') => {
    if (!affiliate) return { success: false, error: 'No affiliate found' };
    
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ pix_key: pixKey, pix_key_type: pixKeyType, updated_at: new Date().toISOString() })
        .eq('id', affiliate.id);

      if (error) throw error;
      await fetchMyAffiliate();
      return { success: true };
    } catch (error) {
      console.error('Error updating pix info:', error);
      return { success: false, error };
    }
  };

  const requestWithdrawal = async (amount: number, type: 'pix' | 'credit') => {
    if (!affiliate) return { success: false, error: 'No affiliate found' };
    
    if (amount > affiliate.available_balance) {
      return { success: false, error: 'Saldo insuficiente' };
    }

    try {
      const { error } = await supabase
        .from('affiliate_withdrawals')
        .insert([{
          affiliate_id: affiliate.id,
          amount,
          withdrawal_type: type,
          pix_key: affiliate.pix_key,
          pix_key_type: affiliate.pix_key_type,
        }]);

      if (error) throw error;
      await fetchMyAffiliate();
      return { success: true };
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
      return { success: false, error };
    }
  };

  return {
    affiliate,
    referrals,
    withdrawals,
    loading,
    refresh: fetchMyAffiliate,
    updatePixInfo,
    requestWithdrawal,
  };
}

// Hook for admin to manage referrals
export function useAffiliateReferrals() {
  const [referrals, setReferrals] = useState<(AffiliateReferral & { affiliate?: Affiliate })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReferrals = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('affiliate_referrals')
        .select('*, affiliates(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReferrals((data || []).map((r: any) => ({
        ...r,
        affiliate: r.affiliates,
      })));
    } catch (error) {
      console.error('Error fetching referrals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const confirmReferral = async (id: string) => {
    try {
      const { error } = await supabase
        .from('affiliate_referrals')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await fetchReferrals();
      return { success: true };
    } catch (error) {
      console.error('Error confirming referral:', error);
      return { success: false, error };
    }
  };

  const cancelReferral = async (id: string) => {
    try {
      const { error } = await supabase
        .from('affiliate_referrals')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
      await fetchReferrals();
      return { success: true };
    } catch (error) {
      console.error('Error cancelling referral:', error);
      return { success: false, error };
    }
  };

  return {
    referrals,
    loading,
    refresh: fetchReferrals,
    confirmReferral,
    cancelReferral,
  };
}

// Hook for admin to manage withdrawals
export function useAffiliateWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<(AffiliateWithdrawal & { affiliate?: Affiliate })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithdrawals = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('affiliate_withdrawals')
        .select('*, affiliates(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWithdrawals((data || []).map((w: any) => ({
        ...w,
        affiliate: w.affiliates,
      })));
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const processWithdrawal = async (id: string, status: 'completed' | 'rejected', reason?: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('affiliate_withdrawals')
        .update({
          status,
          processed_by: user.user?.id,
          processed_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', id);

      if (error) throw error;
      await fetchWithdrawals();
      return { success: true };
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      return { success: false, error };
    }
  };

  return {
    withdrawals,
    loading,
    refresh: fetchWithdrawals,
    processWithdrawal,
  };
}
