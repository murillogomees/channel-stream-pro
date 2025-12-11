import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  valid_from: string;
  valid_until: string;
  max_uses?: number;
  current_uses: number;
  target_plan?: string;
  auto_generated: boolean;
  conditions?: any;
  created_at: string;
  created_by?: string;
  active: boolean;
}

export function useCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('discount_coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons((data || []) as Coupon[]);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();

    const channel = supabase
      .channel('coupons_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discount_coupons' }, () => {
        fetchCoupons();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createCoupon = async (couponData: Omit<Coupon, 'id' | 'created_at' | 'current_uses' | 'created_by' | 'auto_generated'> & { auto_generated?: boolean }) => {
    try {
      const { error } = await supabase
        .from('discount_coupons')
        .insert([{
          code: couponData.code,
          discount_type: couponData.discount_type as any,
          discount_value: couponData.discount_value,
          valid_from: couponData.valid_from,
          valid_until: couponData.valid_until,
          max_uses: couponData.max_uses,
          target_plan: couponData.target_plan,
          auto_generated: couponData.auto_generated,
          conditions: couponData.conditions,
          active: couponData.active,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }]);

      if (error) throw error;
      fetchCoupons();
      return { success: true };
    } catch (error) {
      console.error('Error creating coupon:', error);
      return { success: false, error };
    }
  };

  const updateCoupon = async (id: string, updates: Partial<Coupon>) => {
    try {
      const { error } = await supabase
        .from('discount_coupons')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      fetchCoupons();
      return { success: true };
    } catch (error) {
      console.error('Error updating coupon:', error);
      return { success: false, error };
    }
  };

  const deleteCoupon = async (id: string) => {
    try {
      const { error } = await supabase
        .from('discount_coupons')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchCoupons();
      return { success: true };
    } catch (error) {
      console.error('Error deleting coupon:', error);
      return { success: false, error };
    }
  };

  const validateCoupon = async (code: string): Promise<Coupon | null> => {
    try {
      const { data, error } = await supabase
        .from('discount_coupons')
        .select('*')
        .eq('code', code)
        .eq('active', true)
        .single();

      if (error) throw error;

      if (data) {
        const now = new Date();
        const validFrom = new Date(data.valid_from);
        const validUntil = new Date(data.valid_until);

        if (now < validFrom || now > validUntil) {
          return null;
        }

        if (data.max_uses && data.current_uses >= data.max_uses) {
          return null;
        }

        return data as Coupon;
      }

      return null;
    } catch (error) {
      console.error('Error validating coupon:', error);
      return null;
    }
  };

  return {
    coupons,
    loading,
    fetchCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    validateCoupon
  };
}
