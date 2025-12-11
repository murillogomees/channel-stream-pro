import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ChartData {
  date: string;
  clicks: number;
  conversions: number;
  revenue: number;
}

interface Props {
  affiliateId?: string;
}

export function AffiliatePerformanceChart({ affiliateId }: Props) {
  const [data, setData] = useState<ChartData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Get last 30 days of referrals
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let query = supabase
        .from('affiliate_referrals')
        .select('created_at, commission_earned, plan_value, status')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      if (affiliateId) {
        query = query.eq('affiliate_id', affiliateId);
      }

      const { data: referrals, error } = await query;
      
      if (error) {
        console.error('Error fetching chart data:', error);
        return;
      }

      // Group by date
      const grouped: Record<string, ChartData> = {};
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        grouped[dateStr] = { date: dateStr, clicks: 0, conversions: 0, revenue: 0 };
      }

      (referrals || []).forEach(ref => {
        const dateStr = ref.created_at.split('T')[0];
        if (grouped[dateStr]) {
          grouped[dateStr].conversions++;
          if (ref.status === 'confirmed') {
            grouped[dateStr].revenue += Number(ref.plan_value) || 0;
          }
        }
      });

      // Also get clicks
      let clicksQuery = supabase
        .from('affiliate_link_clicks')
        .select('clicked_at')
        .gte('clicked_at', thirtyDaysAgo.toISOString());

      if (affiliateId) {
        clicksQuery = clicksQuery.eq('affiliate_id', affiliateId);
      }

      const { data: clicks } = await clicksQuery;

      (clicks || []).forEach(click => {
        const dateStr = click.clicked_at.split('T')[0];
        if (grouped[dateStr]) {
          grouped[dateStr].clicks++;
        }
      });

      setData(Object.values(grouped));
    };

    fetchData();
  }, [affiliateId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDate}
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
          />
          <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
            labelFormatter={formatDate}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="clicks" 
            stroke="hsl(var(--primary))" 
            name="Cliques"
            strokeWidth={2}
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="conversions" 
            stroke="#22c55e" 
            name="Conversões"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
