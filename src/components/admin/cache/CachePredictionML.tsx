import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Brain, TrendingUp, Loader2, CheckCircle } from 'lucide-react';

interface Prediction {
  pattern: string;
  confidence: number;
  suggested_ttl: number;
  reasoning: string;
}

export function CachePredictionML() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);

  const handleAnalyze = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('cache-prediction');

      if (error) throw error;

      setPredictions(data.predictions || []);
      setLastAnalysis(data.timestamp);

      toast({
        title: 'Análise concluída',
        description: `${data.predictions?.length || 0} otimizações sugeridas`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro na análise',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTTL = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Cache Prediction ML
            </CardTitle>
            <CardDescription>
              Sistema de aprendizado que sugere otimizações automáticas
            </CardDescription>
          </div>
          <Button onClick={handleAnalyze} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Analisar Padrões
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {predictions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {loading ? 'Analisando dados históricos...' : 'Clique em "Analisar Padrões" para começar'}
          </div>
        ) : (
          <div className="space-y-4">
            {predictions.map((prediction, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-mono text-sm mb-1 break-all">
                      {prediction.pattern}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        TTL sugerido: {formatTTL(prediction.suggested_ttl)}
                      </Badge>
                      <Badge variant="secondary">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Confiança: {(prediction.confidence * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="default">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Aplicar
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {prediction.reasoning}
                </p>
              </div>
            ))}
            
            {lastAnalysis && (
              <p className="text-xs text-muted-foreground text-center pt-4">
                Última análise: {new Date(lastAnalysis).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
