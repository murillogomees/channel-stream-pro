import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ConversionMetric {
  id: string;
  client_id: string;
  trial_start_date: string;
  trial_end_date: string;
  converted: boolean;
  conversion_date?: string | null;
  converted_to_plan?: string | null;
  coupon_used?: string | null;
  days_to_convert?: number | null;
  touchpoints: any;
  created_at: string;
}

export interface ConversionStats {
  total_trials: number;
  total_conversions: number;
  conversion_rate: number;
  avg_days_to_convert: number;
}

export function useConversionMetrics(daysPeriod: number = 30) {
  const [metrics, setMetrics] = useState<ConversionMetric[]>([]);
  const [stats, setStats] = useState<ConversionStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysPeriod);

      const { data, error } = await supabase
        .from('conversion_metrics')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMetrics(data || []);

      // Fetch conversion stats
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_conversion_rate', { days_period: daysPeriod });

      if (statsError) throw statsError;
      if (statsData && statsData.length > 0) {
        setStats(statsData[0]);
      }
    } catch (error) {
      console.error('Error fetching conversion metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    const channel = supabase
      .channel('conversion_metrics_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversion_metrics' }, () => {
        fetchMetrics();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [daysPeriod]);

  const trackConversion = async (clientId: string, convertedToPlan: string, couponId?: string) => {
    try {
      const { data: metric, error: fetchError } = await supabase
        .from('conversion_metrics')
        .select('*')
        .eq('client_id', clientId)
        .single();

      if (fetchError) throw fetchError;

      const conversionDate = new Date();
      const daysToConvert = Math.ceil(
        (conversionDate.getTime() - new Date(metric.trial_start_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      const { error: updateError } = await supabase
        .from('conversion_metrics')
        .update({
          converted: true,
          conversion_date: conversionDate.toISOString(),
          converted_to_plan: convertedToPlan,
          coupon_used: couponId,
          days_to_convert: daysToConvert
        })
        .eq('id', metric.id);

      if (updateError) throw updateError;

      fetchMetrics();
    } catch (error) {
      console.error('Error tracking conversion:', error);
    }
  };

  return { metrics, stats, loading, fetchMetrics, trackConversion };
}
