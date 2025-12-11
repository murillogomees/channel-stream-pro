import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface ABTest {
  id: string;
  test_name: string;
  variant_a: any;
  variant_b: any;
  active: boolean;
  start_date: string;
  end_date?: string;
  created_at: string;
  created_by?: string;
}

export interface ABTestResult {
  id: string;
  test_id: string;
  client_id: string;
  variant_shown: 'A' | 'B';
  converted: boolean;
  shown_at: string;
  converted_at?: string;
}

export function useABTesting() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ab_test_offers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTests(data || []);
    } catch (error) {
      console.error('Error fetching A/B tests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();

    const channel = supabase
      .channel('ab_tests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ab_test_offers' }, () => {
        fetchTests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createTest = async (testData: Omit<ABTest, 'id' | 'created_at' | 'created_by'>) => {
    try {
      const { error } = await supabase
        .from('ab_test_offers')
        .insert([{
          ...testData,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }]);

      if (error) throw error;
      fetchTests();
      return { success: true };
    } catch (error) {
      console.error('Error creating A/B test:', error);
      return { success: false, error };
    }
  };

  const updateTest = async (id: string, updates: Partial<ABTest>) => {
    try {
      const { error } = await supabase
        .from('ab_test_offers')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      fetchTests();
      return { success: true };
    } catch (error) {
      console.error('Error updating A/B test:', error);
      return { success: false, error };
    }
  };

  const getTestResults = async (testId: string) => {
    try {
      const { data, error } = await supabase
        .from('ab_test_results')
        .select('*')
        .eq('test_id', testId);

      if (error) throw error;

      const variantA = data?.filter(r => r.variant_shown === 'A') || [];
      const variantB = data?.filter(r => r.variant_shown === 'B') || [];

      const statsA = {
        total: variantA.length,
        conversions: variantA.filter(r => r.converted).length,
        conversionRate: variantA.length > 0 
          ? (variantA.filter(r => r.converted).length / variantA.length) * 100 
          : 0
      };

      const statsB = {
        total: variantB.length,
        conversions: variantB.filter(r => r.converted).length,
        conversionRate: variantB.length > 0 
          ? (variantB.filter(r => r.converted).length / variantB.length) * 100 
          : 0
      };

      return { variantA: statsA, variantB: statsB };
    } catch (error) {
      console.error('Error getting test results:', error);
      return null;
    }
  };

  const assignVariant = async (testId: string, clientId: string): Promise<'A' | 'B'> => {
    const variant = Math.random() < 0.5 ? 'A' : 'B';

    try {
      await supabase
        .from('ab_test_results')
        .insert([{
          test_id: testId,
          client_id: clientId,
          variant_shown: variant
        }]);
    } catch (error) {
      console.error('Error assigning variant:', error);
    }

    return variant;
  };

  return {
    tests,
    loading,
    fetchTests,
    createTest,
    updateTest,
    getTestResults,
    assignVariant
  };
}
