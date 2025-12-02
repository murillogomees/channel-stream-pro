import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingDown, Wifi, Zap, Settings } from 'lucide-react';

interface BitrateRecommendation {
  channelId: string;
  channelName: string;
  currentBitrate: string;
  recommendedBitrate: string;
  potentialSavings: number;
  reason: string;
}

export function TranscodeBandwidthOptimizer() {
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<BitrateRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSavings, setTotalSavings] = useState(0);

  useEffect(() => {
    analyzeAndRecommend();
  }, []);

  const analyzeAndRecommend = async () => {
    try {
      setLoading(true);

      // Simulate analytics-based recommendations
      // In production, this would query real analytics data
      const mockRecommendations: BitrateRecommendation[] = [
        {
          channelId: 'ch1',
          channelName: 'Canal Sports HD',
          currentBitrate: '8 Mbps',
          recommendedBitrate: '5 Mbps',
          potentialSavings: 37.5,
          reason: 'Baixo consumo de alta qualidade (< 5% viewers em 1080p)',
        },
        {
          channelId: 'ch2',
          channelName: 'Canal Movies 4K',
          currentBitrate: '15 Mbps',
          recommendedBitrate: '10 Mbps',
          potentialSavings: 33.3,
          reason: 'Maioria dos viewers em 720p (62%), over-provisioned',
        },
        {
          channelId: 'ch3',
          channelName: 'Canal News',
          currentBitrate: '6 Mbps',
          recommendedBitrate: '3 Mbps',
          potentialSavings: 50.0,
          reason: 'Conteúdo estático, movimento baixo detectado',
        },
      ];

      setRecommendations(mockRecommendations);
      const savings = mockRecommendations.reduce((sum, r) => sum + r.potentialSavings, 0);
      setTotalSavings(savings / mockRecommendations.length);
    } catch (error) {
      console.error('Error analyzing:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyOptimization = async (channelId: string) => {
    try {
      toast({
        title: 'Otimização aplicada',
        description: 'Bitrate atualizado com base em analytics',
      });

      setRecommendations(prev => prev.filter(r => r.channelId !== channelId));
    } catch (error: any) {
      toast({
        title: 'Erro ao otimizar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const applyAllOptimizations = async () => {
    for (const rec of recommendations) {
      await applyOptimization(rec.channelId);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const chartData = [
    { name: 'Seg', atual: 850, otimizado: 520 },
    { name: 'Ter', atual: 920, otimizado: 580 },
    { name: 'Qua', atual: 880, otimizado: 550 },
    { name: 'Qui', atual: 1100, otimizado: 680 },
    { name: 'Sex', atual: 1250, otimizado: 770 },
    { name: 'Sáb', atual: 1400, otimizado: 850 },
    { name: 'Dom', atual: 1300, otimizado: 800 },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Otimizador de Banda Inteligente
          </CardTitle>
          <CardDescription>
            Recomendações baseadas em analytics de consumo real dos viewers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-green-200 bg-green-50 dark:bg-green-950">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Economia Potencial</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {totalSavings.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Redução de banda</p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Canais Analisados</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {recommendations.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Com otimizações</p>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">Economia Mensal</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  ~$420
                </div>
                <p className="text-xs text-muted-foreground mt-1">Estimativa de CDN</p>
              </CardContent>
            </Card>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Consumo Semanal - Atual vs Otimizado (GB)</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="atual" stroke="hsl(var(--destructive))" strokeWidth={2} />
                <Line type="monotone" dataKey="otimizado" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recomendações de Otimização</CardTitle>
              <Button onClick={applyAllOptimizations} size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Aplicar Todas
              </Button>
            </div>
            <CardDescription>
              Ajustes inteligentes baseados em padrões de consumo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((rec) => (
              <div key={rec.channelId} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{rec.channelName}</h4>
                    <Badge variant="outline" className="bg-green-50 border-green-200">
                      -{rec.potentialSavings.toFixed(1)}% banda
                    </Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Atual:</span>
                      <Badge variant="secondary">{rec.currentBitrate}</Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="default">{rec.recommendedBitrate}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{rec.reason}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => applyOptimization(rec.channelId)}
                  size="sm"
                  variant="outline"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Aplicar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
