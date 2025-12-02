import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Clock, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CostMetrics {
  totalJobs: number;
  totalMinutes: number;
  estimatedCost: number;
  avgCostPerJob: number;
  costByPreset: { preset: string; cost: number; jobs: number }[];
}

export function TranscodeCostAnalytics() {
  const [metrics, setMetrics] = useState<CostMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Cloudflare Stream pricing (example rates)
  const COST_PER_MINUTE_ENCODING = 0.01; // $0.01 per minute
  const COST_PER_MINUTE_STORAGE = 0.005; // $0.005 per minute stored per month

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const { data: jobs, error } = await supabase
        .from('transcode_jobs')
        .select('*')
        .eq('status', 'ready');

      if (error) throw error;

      if (!jobs || jobs.length === 0) {
        setMetrics({
          totalJobs: 0,
          totalMinutes: 0,
          estimatedCost: 0,
          avgCostPerJob: 0,
          costByPreset: [],
        });
        setLoading(false);
        return;
      }

      // Calculate metrics
      let totalMinutes = 0;
      const presetCosts: Record<string, { cost: number; jobs: number }> = {};

      jobs.forEach((job) => {
        // Estimate 5 minutes per job as default duration
        const duration = 300; // 5 minutes in seconds
        const minutes = duration / 60;
        totalMinutes += minutes;

        const encodingCost = minutes * COST_PER_MINUTE_ENCODING;
        const storageCost = minutes * COST_PER_MINUTE_STORAGE;
        const totalCost = encodingCost + storageCost;

        const preset = job.ladder_preset;
        if (!presetCosts[preset]) {
          presetCosts[preset] = { cost: 0, jobs: 0 };
        }
        presetCosts[preset].cost += totalCost;
        presetCosts[preset].jobs += 1;
      });

      const totalCost = Object.values(presetCosts).reduce((sum, p) => sum + p.cost, 0);
      const costByPreset = Object.entries(presetCosts).map(([preset, data]) => ({
        preset,
        cost: data.cost,
        jobs: data.jobs,
      }));

      setMetrics({
        totalJobs: jobs.length,
        totalMinutes: Math.round(totalMinutes),
        estimatedCost: totalCost,
        avgCostPerJob: totalCost / jobs.length,
        costByPreset,
      });
    } catch (error) {
      console.error('Error loading cost metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando analytics...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.estimatedCost.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimativa de codificação + armazenamento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.avgCostPerJob.toFixed(3)}
            </div>
            <p className="text-xs text-muted-foreground">Por job concluído</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Minutos</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalMinutes}</div>
            <p className="text-xs text-muted-foreground">Conteúdo processado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jobs Concluídos</CardTitle>
            <Video className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalJobs}</div>
            <p className="text-xs text-muted-foreground">Com sucesso</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Custo por Preset</CardTitle>
          <CardDescription>Distribuição de custos por qualidade</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.costByPreset}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="preset" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => `$${value.toFixed(2)}`}
                labelFormatter={(label) => `Preset: ${label}`}
              />
              <Bar dataKey="cost" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 space-y-2">
            {metrics.costByPreset.map((preset) => (
              <div key={preset.preset} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{preset.preset}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {preset.jobs} jobs
                  </span>
                </div>
                <span className="font-bold text-green-600">
                  ${preset.cost.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
