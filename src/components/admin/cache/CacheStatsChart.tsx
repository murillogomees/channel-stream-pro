import { useEffect, useState } from 'react';
import { smartCacheService, CacheStats } from '@/services/smartCacheService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export function CacheStatsChart() {
  const [stats, setStats] = useState<CacheStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await smartCacheService.getStats({ hoursAgo: 24 });
      if (error) throw error;
      setStats(data || []);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = stats.map((stat) => ({
    time: format(new Date(stat.collected_at), 'HH:mm'),
    hits: stat.hits,
    misses: stat.misses,
    hit_rate: stat.hits + stat.misses > 0 
      ? ((stat.hits / (stat.hits + stat.misses)) * 100).toFixed(1)
      : 0,
    avg_response_time: stat.avg_response_time_ms || 0,
  }));

  if (loading) {
    return <div className="text-center py-8">Carregando estatísticas...</div>;
  }

  if (stats.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma estatística disponível ainda
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium mb-4">Hit Rate (Últimas 24h)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="hits" stroke="#10b981" name="Hits" />
            <Line type="monotone" dataKey="misses" stroke="#ef4444" name="Misses" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Tempo de Resposta (ms)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="avg_response_time" 
              stroke="#3b82f6" 
              name="Tempo Médio (ms)" 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
