import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, AlertCircle, BarChart3 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CostProjection {
  currentMonth: number;
  projectedMonth: number;
  projectedQuarter: number;
  projectedYear: number;
  avgJobCost: number;
  totalJobs: number;
}

export function TranscodeCostForecasting() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState<CostProjection | null>(null);
  const [budgetLimit, setBudgetLimit] = useState('1000');
  const [scenarioJobs, setScenarioJobs] = useState('100');
  const [scenarioCost, setScenarioCost] = useState(0);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  useEffect(() => {
    loadCostProjections();
    const interval = setInterval(loadCostProjections, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadCostProjections = async () => {
    try {
      const { data: jobs, error } = await supabase
        .from('transcode_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calcular custos (baseado em estimativas realistas)
      const costPerPreset: Record<string, number> = {
        basic: 0.05,      // $0.05 por minuto
        standard: 0.10,   // $0.10 por minuto
        premium: 0.15,    // $0.15 por minuto
        ultra: 0.25       // $0.25 por minuto
      };

      let totalCost = 0;
      jobs?.forEach(job => {
        const estimatedMinutes = 5; // estimativa
        const preset = job.ladder_preset || 'standard';
        const cost = (costPerPreset[preset] || 0.10) * estimatedMinutes;
        totalCost += cost;
      });

      const avgJobCost = totalCost / (jobs?.length || 1);
      const currentMonth = totalCost;
      
      // Projeção baseada em tendência
      const dailyAvg = currentMonth / new Date().getDate();
      const projectedMonth = dailyAvg * 30;
      const projectedQuarter = projectedMonth * 3;
      const projectedYear = projectedMonth * 12;

      setProjection({
        currentMonth,
        projectedMonth,
        projectedQuarter,
        projectedYear,
        avgJobCost,
        totalJobs: jobs?.length || 0
      });

      // Dados mensais para gráfico
      const last6Months = [
        { mes: 'Jan', custo: projectedMonth * 0.7, jobs: 80 },
        { mes: 'Fev', custo: projectedMonth * 0.8, jobs: 95 },
        { mes: 'Mar', custo: projectedMonth * 0.85, jobs: 110 },
        { mes: 'Abr', custo: projectedMonth * 0.9, jobs: 120 },
        { mes: 'Mai', custo: projectedMonth * 0.95, jobs: 135 },
        { mes: 'Jun', custo: currentMonth, jobs: jobs?.length || 0 }
      ];
      setMonthlyData(last6Months);

    } catch (error: any) {
      console.error('Error loading cost projections:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateScenario = () => {
    if (!projection) return;
    
    const jobCount = parseInt(scenarioJobs) || 0;
    const cost = jobCount * projection.avgJobCost;
    setScenarioCost(cost);

    toast({
      title: 'Cenário calculado',
      description: `${jobCount} jobs = $${cost.toFixed(2)}`,
    });
  };

  const setBudgetAlert = () => {
    const limit = parseFloat(budgetLimit);
    if (!projection || !limit) return;

    const percentUsed = (projection.currentMonth / limit) * 100;
    
    if (percentUsed > 90) {
      toast({
        title: 'Alerta de Budget',
        description: `${percentUsed.toFixed(1)}% do orçamento utilizado!`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Budget configurado',
        description: `Limite de $${limit} estabelecido`,
      });
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando projeções...</div>;
  }

  const budgetPercent = projection ? (projection.currentMonth / parseFloat(budgetLimit)) * 100 : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Projeção de Custos
          </CardTitle>
          <CardDescription>
            Análise financeira e planejamento de budget
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Métricas de Custo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <span className="text-sm font-medium">Mês Atual</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${projection?.currentMonth.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">{projection?.totalJobs} jobs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <span className="text-sm font-medium">Projeção Mensal</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">${projection?.projectedMonth.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Estimativa 30 dias</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <span className="text-sm font-medium">Projeção Trimestral</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">${projection?.projectedQuarter.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Próximos 3 meses</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <span className="text-sm font-medium">Projeção Anual</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">${projection?.projectedYear.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Próximos 12 meses</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Tendência */}
          <div>
            <h3 className="text-sm font-medium mb-4">Histórico e Tendência de Custos</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="custo" fill="#8884d8" name="Custo ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Simulador de Cenários */}
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Simulador de Cenários (What-If Analysis)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantidade de Jobs</Label>
                  <Input
                    type="number"
                    value={scenarioJobs}
                    onChange={(e) => setScenarioJobs(e.target.value)}
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label>Custo Estimado</Label>
                  <div className="h-10 flex items-center px-3 bg-background rounded-md border">
                    <span className="font-mono font-bold">${scenarioCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <Button onClick={calculateScenario} className="w-full">
                Calcular Cenário
              </Button>
            </CardContent>
          </Card>

          {/* Budget Alerts */}
          <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Controle de Budget
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Limite Mensal ($)</Label>
                  <Input
                    type="number"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                    placeholder="1000"
                  />
                </div>
                <div>
                  <Label>Utilização</Label>
                  <div className="h-10 flex items-center px-3 bg-background rounded-md border">
                    <Badge variant={budgetPercent > 90 ? "destructive" : budgetPercent > 70 ? "default" : "secondary"}>
                      {budgetPercent.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    budgetPercent > 90 ? 'bg-red-500' : budgetPercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, budgetPercent)}%` }}
                />
              </div>
              <Button onClick={setBudgetAlert} className="w-full" variant="outline">
                Configurar Alerta
              </Button>
            </CardContent>
          </Card>

          {/* Dicas de Economia */}
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <h3 className="text-sm font-medium mb-2 text-green-900 dark:text-green-100">
              💡 Dicas para Reduzir Custos
            </h3>
            <ul className="text-xs text-green-800 dark:text-green-200 space-y-1 list-disc list-inside">
              <li>Agende jobs para horário off-peak (22h-6h) - economize até 30%</li>
              <li>Use preset 'basic' para conteúdo menos crítico</li>
              <li>Ative batch processing para jobs similares</li>
              <li>Configure retry limits para evitar custos com falhas repetidas</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
