/**
 * ObservabilityLoadTest - Load testing tools
 */

import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Square, Zap, Server, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TestResult {
  id: string;
  timestamp: Date;
  endpoint: string;
  duration: number;
  status: 'success' | 'error' | 'timeout';
  statusCode?: number;
  error?: string;
}

interface TestConfig {
  endpoint: string;
  concurrentUsers: number;
  requestsPerUser: number;
  delayMs: number;
}

interface TestSummary {
  totalRequests: number;
  successRate: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  errors: number;
}

export default function ObservabilityLoadTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const abortRef = useRef(false);

  const [config, setConfig] = useState<TestConfig>({
    endpoint: 'realtime-metrics',
    concurrentUsers: 5,
    requestsPerUser: 10,
    delayMs: 100
  });

  const endpoints = [
    { value: 'realtime-metrics', label: 'Realtime Metrics' },
    { value: 'system-health-check', label: 'System Health Check' },
    { value: 'predictive-preload', label: 'Predictive Preload' },
  ];

  const runTest = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults([]);
    setSummary(null);
    abortRef.current = false;

    const totalRequests = config.concurrentUsers * config.requestsPerUser;
    const allResults: TestResult[] = [];
    let completedRequests = 0;

    const runUserRequests = async (userId: number) => {
      for (let i = 0; i < config.requestsPerUser; i++) {
        if (abortRef.current) return;

        const start = performance.now();
        const result: TestResult = {
          id: `${userId}-${i}`,
          timestamp: new Date(),
          endpoint: config.endpoint,
          duration: 0,
          status: 'success'
        };

        try {
          const { data, error } = await supabase.functions.invoke(config.endpoint, {
            body: { timeRange: '1h', userId: `test-${userId}` }
          });

          result.duration = Math.round(performance.now() - start);
          
          if (error) {
            result.status = 'error';
            result.error = error.message;
          } else {
            result.statusCode = 200;
          }
        } catch (error) {
          result.duration = Math.round(performance.now() - start);
          result.status = result.duration > 30000 ? 'timeout' : 'error';
          result.error = error instanceof Error ? error.message : 'Unknown error';
        }

        allResults.push(result);
        completedRequests++;
        setProgress(Math.round((completedRequests / totalRequests) * 100));

        // Delay between requests
        if (config.delayMs > 0) {
          await new Promise(r => setTimeout(r, config.delayMs));
        }
      }
    };

    // Run concurrent users
    const userPromises = Array.from({ length: config.concurrentUsers }, (_, i) => 
      runUserRequests(i)
    );

    await Promise.all(userPromises);

    setResults(allResults);
    calculateSummary(allResults);
    setIsRunning(false);
  };

  const calculateSummary = (testResults: TestResult[]) => {
    if (testResults.length === 0) return;

    const latencies = testResults.map(r => r.duration).sort((a, b) => a - b);
    const successCount = testResults.filter(r => r.status === 'success').length;

    setSummary({
      totalRequests: testResults.length,
      successRate: (successCount / testResults.length) * 100,
      avgLatency: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      minLatency: latencies[0],
      maxLatency: latencies[latencies.length - 1],
      p95Latency: latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1],
      errors: testResults.length - successCount
    });
  };

  const stopTest = () => {
    abortRef.current = true;
    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      {/* Config Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Configuração do Teste de Carga
          </CardTitle>
          <CardDescription>
            Configure os parâmetros para simular tráfego no sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Endpoint</Label>
              <Select
                value={config.endpoint}
                onValueChange={(v) => setConfig({ ...config, endpoint: v })}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {endpoints.map(ep => (
                    <SelectItem key={ep.value} value={ep.value}>
                      {ep.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Delay entre requisições (ms)</Label>
              <Input
                type="number"
                value={config.delayMs}
                onChange={(e) => setConfig({ ...config, delayMs: Number(e.target.value) })}
                disabled={isRunning}
                min={0}
                max={5000}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Usuários Simultâneos: {config.concurrentUsers}</Label>
            <Slider
              value={[config.concurrentUsers]}
              onValueChange={([v]) => setConfig({ ...config, concurrentUsers: v })}
              disabled={isRunning}
              min={1}
              max={50}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label>Requisições por Usuário: {config.requestsPerUser}</Label>
            <Slider
              value={[config.requestsPerUser]}
              onValueChange={([v]) => setConfig({ ...config, requestsPerUser: v })}
              disabled={isRunning}
              min={1}
              max={100}
              step={1}
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Server className="h-4 w-4" />
            <span>
              Total: {config.concurrentUsers * config.requestsPerUser} requisições
            </span>
          </div>

          <div className="flex gap-2">
            {isRunning ? (
              <Button onClick={stopTest} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
                Parar
              </Button>
            ) : (
              <Button onClick={runTest}>
                <Play className="h-4 w-4 mr-2" />
                Iniciar Teste
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {isRunning && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Progresso</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">{progress}% concluído</p>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Resultados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{summary.totalRequests}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className={`text-2xl font-bold ${summary.successRate >= 95 ? 'text-green-500' : summary.successRate >= 80 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {summary.successRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Sucesso</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{summary.avgLatency}ms</p>
                <p className="text-xs text-muted-foreground">Média</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{summary.minLatency}ms</p>
                <p className="text-xs text-muted-foreground">Mínimo</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{summary.p95Latency}ms</p>
                <p className="text-xs text-muted-foreground">P95</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className={`text-2xl font-bold ${summary.errors === 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {summary.errors}
                </p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex gap-2 mt-4">
              {summary.successRate >= 99 && summary.avgLatency < 200 && (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Excelente Performance
                </Badge>
              )}
              {summary.avgLatency > 500 && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Latência Alta
                </Badge>
              )}
              {summary.errors > summary.totalRequests * 0.05 && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Taxa de Erro Alta
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas Requisições</CardTitle>
            <CardDescription>10 requisições mais recentes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-auto">
              {results.slice(-10).reverse().map((result) => (
                <div key={result.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    {result.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-mono text-xs">{result.endpoint}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{result.duration}ms</span>
                    <Badge variant={result.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                      {result.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
