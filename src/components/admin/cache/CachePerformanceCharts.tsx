import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, TrendingUp, Database, Zap } from 'lucide-react';

interface CacheStats {
  id: string;
  rule_id: string | null;
  hits: number;
  misses: number;
  stale_hits: number;
  errors: number;
  avg_response_time_ms: number | null;
  p95_response_time_ms: number | null;
  bandwidth_saved_bytes: number | null;
  window_start: string;
  window_end: string;
  collected_at: string;
}

interface CachePerformanceChartsProps {
  stats: CacheStats[];
}

export function CachePerformanceCharts({ stats }: CachePerformanceChartsProps) {
  // Aggregate stats by time window
  const timeSeriesData = useMemo(() => {
    const grouped = stats.reduce((acc, stat) => {
      const time = new Date(stat.window_start).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      if (!acc[time]) {
        acc[time] = {
          time,
          hits: 0,
          misses: 0,
          stale_hits: 0,
          total_requests: 0,
          avg_response_time: 0,
          bandwidth_saved_mb: 0,
        };
      }
      
      acc[time].hits += stat.hits;
      acc[time].misses += stat.misses;
      acc[time].stale_hits += stat.stale_hits;
      acc[time].total_requests += stat.hits + stat.misses;
      acc[time].avg_response_time += stat.avg_response_time_ms || 0;
      acc[time].bandwidth_saved_mb += (stat.bandwidth_saved_bytes || 0) / (1024 * 1024);
      
      return acc;
    }, {} as Record<string, any>);
    
    return Object.values(grouped).slice(-12); // Last 12 windows
  }, [stats]);

  // Calculate hit rate distribution
  const hitRateData = useMemo(() => {
    const totalHits = stats.reduce((sum, s) => sum + s.hits, 0);
    const totalMisses = stats.reduce((sum, s) => sum + s.misses, 0);
    const totalStale = stats.reduce((sum, s) => sum + s.stale_hits, 0);
    const total = totalHits + totalMisses;

    return [
      { name: 'Cache Hits', value: totalHits, percentage: total > 0 ? ((totalHits / total) * 100).toFixed(1) : 0 },
      { name: 'Cache Misses', value: totalMisses, percentage: total > 0 ? ((totalMisses / total) * 100).toFixed(1) : 0 },
      { name: 'Stale Hits', value: totalStale, percentage: total > 0 ? ((totalStale / total) * 100).toFixed(1) : 0 },
    ];
  }, [stats]);

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const totalRequests = stats.reduce((sum, s) => sum + s.hits + s.misses, 0);
    const totalHits = stats.reduce((sum, s) => sum + s.hits, 0);
    const hitRate = totalRequests > 0 ? ((totalHits / totalRequests) * 100).toFixed(1) : '0';
    
    const avgResponseTime = stats.length > 0
      ? (stats.reduce((sum, s) => sum + (s.avg_response_time_ms || 0), 0) / stats.length).toFixed(0)
      : '0';
    
    const totalBandwidthSaved = stats.reduce((sum, s) => sum + (s.bandwidth_saved_bytes || 0), 0);
    const bandwidthSavedGB = (totalBandwidthSaved / (1024 * 1024 * 1024)).toFixed(2);

    return { hitRate, avgResponseTime, bandwidthSavedGB, totalRequests };
  }, [stats]);

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryMetrics.hitRate}%</div>
            <p className="text-xs text-muted-foreground">
              {summaryMetrics.totalRequests} requisições
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryMetrics.avgResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">
              Tempo de resposta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Banda Economizada</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryMetrics.bandwidthSavedGB} GB</div>
            <p className="text-xs text-muted-foreground">
              Desde último reset
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Saudável</div>
            <p className="text-xs text-muted-foreground">
              Cache operando normalmente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hit Rate Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Cache Hit Rate (Últimas Horas)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="hits" stroke="hsl(var(--chart-1))" name="Hits" strokeWidth={2} />
                <Line type="monotone" dataKey="misses" stroke="hsl(var(--chart-2))" name="Misses" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hit Rate Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Cache</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={hitRateData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {hitRateData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Response Time */}
        <Card>
          <CardHeader>
            <CardTitle>Tempo de Resposta (ms)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avg_response_time" fill="hsl(var(--chart-3))" name="Tempo Médio" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bandwidth Saved */}
        <Card>
          <CardHeader>
            <CardTitle>Banda Economizada (MB)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="bandwidth_saved_mb" fill="hsl(var(--chart-4))" name="MB Economizados" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
