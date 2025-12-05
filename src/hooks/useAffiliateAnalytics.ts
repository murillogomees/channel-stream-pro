import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AffiliateAnalyticsData {
  id: string;
  affiliate_id: string;
  period_start: string;
  period_end: string;
  clicks: number;
  conversions: number;
  conversion_rate: number;
  revenue_generated: number;
  commission_earned: number;
  avg_order_value: number;
}

export interface AffiliateLinkClick {
  id: string;
  affiliate_id: string;
  ip_address: string;
  user_agent: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  landing_page: string;
  converted: boolean;
  converted_at: string | null;
  clicked_at: string;
}

export interface AffiliateLeaderboardEntry {
  id: string;
  name: string;
  total_referrals: number;
  total_earnings: number;
  conversion_rate: number;
  tier_name: string;
  tier_color: string;
}

export function useAffiliateAnalytics(affiliateId?: string) {
  const [analytics, setAnalytics] = useState<AffiliateAnalyticsData[]>([]);
  const [clicks, setClicks] = useState<AffiliateLinkClick[]>([]);
  const [leaderboard, setLeaderboard] = useState<AffiliateLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClicks: 0,
    totalConversions: 0,
    totalRevenue: 0,
    totalCommission: 0,
    avgConversionRate: 0
  });

  const fetchAnalytics = async () => {
    try {
      let query = supabase
        .from('affiliate_analytics')
        .select('*')
        .order('period_start', { ascending: false });

      if (affiliateId) {
        query = query.eq('affiliate_id', affiliateId);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      setAnalytics(data || []);
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchClicks = async (limit = 100) => {
    try {
      let query = supabase
        .from('affiliate_link_clicks')
        .select('*')
        .order('clicked_at', { ascending: false });

      if (affiliateId) {
        query = query.eq('affiliate_id', affiliateId);
      }

      const { data, error } = await query.limit(limit);
      if (error) throw error;
      setClicks(data || []);
    } catch (error: any) {
      console.error('Error fetching clicks:', error);
    }
  };

  const fetchLeaderboard = async (limit = 10) => {
    try {
      const { data, error } = await supabase
        .from('affiliates')
        .select(`
          id, name, total_referrals, total_earnings, conversion_rate,
          affiliate_tiers(name, color)
        `)
        .eq('status', 'active')
        .order('total_earnings', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const formatted = (data || []).map(a => ({
        id: a.id,
        name: a.name,
        total_referrals: a.total_referrals,
        total_earnings: a.total_earnings,
        conversion_rate: a.conversion_rate || 0,
        tier_name: (a.affiliate_tiers as any)?.name || 'Bronze',
        tier_color: (a.affiliate_tiers as any)?.color || '#CD7F32'
      }));

      setLeaderboard(formatted);
    } catch (error: any) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const fetchStats = async () => {
    try {
      let query = supabase.from('affiliates').select('total_clicks, total_referrals, total_earnings, conversion_rate');
      
      if (affiliateId) {
        query = query.eq('id', affiliateId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const totals = (data || []).reduce((acc, curr) => ({
        totalClicks: acc.totalClicks + (curr.total_clicks || 0),
        totalConversions: acc.totalConversions + (curr.total_referrals || 0),
        totalRevenue: acc.totalRevenue + (curr.total_earnings || 0),
        totalCommission: acc.totalCommission + (curr.total_earnings || 0),
        avgConversionRate: 0
      }), { totalClicks: 0, totalConversions: 0, totalRevenue: 0, totalCommission: 0, avgConversionRate: 0 });

      totals.avgConversionRate = totals.totalClicks > 0 
        ? (totals.totalConversions / totals.totalClicks) * 100 
        : 0;

      setStats(totals);
    } catch (error: any) {
      console.error('Error fetching stats:', error);
    }
  };

  const trackClick = async (
    targetAffiliateId: string,
    metadata: {
      ip_address?: string;
      user_agent?: string;
      referrer?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      landing_page?: string;
    }
  ) => {
    try {
      const { data, error } = await supabase.rpc('track_affiliate_click', {
        p_affiliate_id: targetAffiliateId,
        p_ip_address: metadata.ip_address || null,
        p_user_agent: metadata.user_agent || null,
        p_referrer: metadata.referrer || null,
        p_utm_source: metadata.utm_source || null,
        p_utm_medium: metadata.utm_medium || null,
        p_utm_campaign: metadata.utm_campaign || null,
        p_landing_page: metadata.landing_page || null
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error tracking click:', error);
      throw error;
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchAnalytics(),
        fetchClicks(),
        fetchLeaderboard(),
        fetchStats()
      ]);
      setLoading(false);
    };
    loadAll();
  }, [affiliateId]);

  return {
    analytics,
    clicks,
    leaderboard,
    stats,
    loading,
    fetchAnalytics,
    fetchClicks,
    fetchLeaderboard,
    fetchStats,
    trackClick
  };
}
