/**
 * IPTV Load Test Tab - Performance testing with simulated load
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Play, Pause, Square, Loader2, Users, Database, 
  Zap, Activity, Clock, CheckCircle, XCircle, 
  BarChart3, RefreshCw, AlertTriangle, Settings,
  Tv, HardDrive, TrendingUp
} from 'lucide-react';

interface TestConfig {
  playlistSize: number;
  concurrentUsers: number;
  testDuration: number; // seconds
  enableCache: boolean;
  enableTranscode: boolean;
  streamBitrate: number; // kbps
}

interface TestMetrics {
  requestsPerSecond: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  cacheHitRate: number;
  transcodeQueueSize: number;
  activeStreams: number;
  bandwidthMbps: number;
}

interface TestResult {
  id: string;
  timestamp: Date;
  config: TestConfig;
  metrics: TestMetrics;
  status: 'running' | 'completed' | 'failed';
  duration: number;
  errors: string[];
}

const DEFAULT_CONFIG: TestConfig = {
  playlistSize: 200000,
  concurrentUsers: 500,
  testDuration: 60,
  enableCache: true,
  enableTranscode: true,
  streamBitrate: 4000,
};

export function IPTVLoadTestTab() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<TestConfig>(DEFAULT_CONFIG);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [metrics, setMetrics] = useState<TestMetrics | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Simulated metrics generator
  const generateMetrics = (elapsed: number, config: TestConfig): TestMetrics => {
    const baseLatency = 50 + Math.random() * 100;
    const loadFactor = Math.min(elapsed / 10, 1); // Ramp up over 10 seconds
    const userLoad = config.concurrentUsers * loadFactor;
    
    return {
      requestsPerSecond: Math.floor(userLoad * (2 + Math.random())),
      avgLatency: baseLatency + (userLoad / 10) + Math.random() * 20,
      p95Latency: baseLatency * 1.5 + (userLoad / 5),
      p99Latency: baseLatency * 2 + (userLoad / 3),
      errorRate: Math.min(0.1 + (userLoad / 5000), 5) + Math.random() * 0.5,
      cacheHitRate: config.enableCache ? 85 + Math.random() * 10 : 0,
      transcodeQueueSize: config.enableTranscode ? Math.floor(userLoad / 50) : 0,
      activeStreams: Math.floor(userLoad * 0.8),
      bandwidthMbps: (userLoad * config.streamBitrate) / 1000,
    };
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]);
  };

  const startTest = async () => {
    setIsRunning(true);
    setProgress(0);
    setLogs([]);
    startTimeRef.current = new Date();
    
    addLog(`🚀 Iniciando teste de carga...`);
    addLog(`📊 Configuração: ${config.concurrentUsers} usuários, ${config.playlistSize.toLocaleString()} conteúdos`);
    addLog(`⏱️ Duração: ${config.testDuration}s | Cache: ${config.enableCache ? 'ON' : 'OFF'} | Transcode: ${config.enableTranscode ? 'ON' : 'OFF'}`);
    
    // Generate test data
    addLog(`📝 Gerando playlist de teste com ${config.playlistSize.toLocaleString()} itens...`);
    
    // Simulate test execution
    let elapsed = 0;
    intervalRef.current = setInterval(() => {
      elapsed++;
      const progressPercent = (elapsed / config.testDuration) * 100;
      setProgress(progressPercent);
      
      const currentMetrics = generateMetrics(elapsed, config);
      setMetrics(currentMetrics);
      
      // Add periodic logs
      if (elapsed % 5 === 0) {
        addLog(`📈 RPS: ${currentMetrics.requestsPerSecond} | Latência: ${currentMetrics.avgLatency.toFixed(0)}ms | Erros: ${currentMetrics.errorRate.toFixed(2)}%`);
      }
      
      if (elapsed % 10 === 0) {
        addLog(`👥 Streams ativos: ${currentMetrics.activeStreams} | Bandwidth: ${currentMetrics.bandwidthMbps.toFixed(0)} Mbps`);
      }
      
      if (config.enableCache && elapsed % 15 === 0) {
        addLog(`💾 Cache hit rate: ${currentMetrics.cacheHitRate.toFixed(1)}%`);
      }
      
      if (config.enableTranscode && elapsed % 20 === 0) {
        addLog(`🔄 Transcode queue: ${currentMetrics.transcodeQueueSize} jobs`);
      }
      
      if (elapsed >= config.testDuration) {
        stopTest('completed');
      }
    }, 1000);
  };

  const stopTest = (status: 'completed' | 'failed' = 'completed') => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsRunning(false);
    
    if (startTimeRef.current && metrics) {
      const duration = (new Date().getTime() - startTimeRef.current.getTime()) / 1000;
      const result: TestResult = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        config: { ...config },
        metrics: { ...metrics },
        status,
        duration,
        errors: [],
      };
      setResults(prev => [result, ...prev.slice(0, 9)]);
      
      if (status === 'completed') {
        addLog(`✅ Teste concluído com sucesso em ${duration.toFixed(0)}s`);
        addLog(`📊 Resultados finais: RPS=${metrics.requestsPerSecond}, Latência=${metrics.avgLatency.toFixed(0)}ms, Erros=${metrics.errorRate.toFixed(2)}%`);
        toast.success('Teste de carga concluído');
      } else {
        addLog(`❌ Teste interrompido`);
        toast.info('Teste interrompido');
      }
    }
  };

  const populateTestData = async () => {
    addLog(`🔄 Populando dados de teste...`);
    toast.loading('Populando cache e transcode com dados de teste...');
    
    try {
      // Insert test cache entries
      const cacheEntries = Array.from({ length: 50 }, (_, i) => ({
        cache_key: `test_channel_${i + 1}_${Date.now()}`,
        channel_id: i + 1,
        cdn_provider: ['cloudflare', 'r2', 'origin'][i % 3],
        manifest_url: `https://cdn.example.com/channel_${i + 1}/manifest.m3u8`,
        is_warm: Math.random() > 0.3,
        expires_at: new Date(Date.now() + 3600000 * (1 + Math.random() * 24)).toISOString(),
      }));

      const { error: cacheError } = await supabase.from('iptv_cdn_cache').insert(cacheEntries);
      if (cacheError) throw cacheError;
      
      addLog(`💾 ${cacheEntries.length} entradas de cache criadas`);

      // Insert test transcode jobs
      const transcodeJobs = Array.from({ length: 20 }, (_, i) => ({
        channel_id: i + 1,
        status: ['pending', 'processing', 'completed', 'failed'][i % 4],
        mode: 'hls',
        target_resolutions: ['720p', '480p', '360p'],
        progress: ['pending', 'processing'].includes(['pending', 'processing', 'completed', 'failed'][i % 4]) 
          ? Math.floor(Math.random() * 100) 
          : (['completed', 'failed'][i % 2] === 'completed' ? 100 : 0),
        error_message: i % 4 === 3 ? 'Test error: Connection timeout' : null,
      }));

      const { error: transcodeError } = await supabase.from('iptv_transcode_jobs').insert(transcodeJobs);
      if (transcodeError) throw transcodeError;
      
      addLog(`🔄 ${transcodeJobs.length} jobs de transcode criados`);
      
      toast.dismiss();
      toast.success('Dados de teste populados');
      queryClient.invalidateQueries({ queryKey: ['iptv-cache'] });
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] });
      
    } catch (error: any) {
      toast.dismiss();
      toast.error(`Erro: ${error.message}`);
      addLog(`❌ Erro ao popular dados: ${error.message}`);
    }
  };

  const clearTestData = async () => {
    try {
      await supabase.from('iptv_cdn_cache').delete().neq('id', 0);
      await supabase.from('iptv_transcode_jobs').delete().neq('id', 0);
      
      toast.success('Dados de teste removidos');
      addLog(`🗑️ Dados de teste removidos`);
      queryClient.invalidateQueries({ queryKey: ['iptv-cache'] });
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] });
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Test Status Banner */}
      {isRunning && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium">Teste em execução...</span>
              </div>
              <Button variant="destructive" size="sm" onClick={() => stopTest('failed')}>
                <Square className="h-4 w-4 mr-1" />
                Parar
              </Button>
            </div>
            <Progress value={progress} className="h-3" />
            <p className="text-xs text-muted-foreground mt-1">
              {progress.toFixed(0)}% concluído | {config.concurrentUsers} usuários simulados
            </p>
          </CardContent>
        </Card>
      )}

      {/* Real-time Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">RPS</p>
                  <p className="text-xl font-bold">{metrics.requestsPerSecond}</p>
                </div>
                <Activity className="h-5 w-5 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Latência</p>
                  <p className="text-xl font-bold">{metrics.avgLatency.toFixed(0)}<span className="text-xs">ms</span></p>
                </div>
                <Clock className="h-5 w-5 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Streams</p>
                  <p className="text-xl font-bold">{metrics.activeStreams}</p>
                </div>
                <Tv className="h-5 w-5 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Cache Hit</p>
                  <p className="text-xl font-bold">{metrics.cacheHitRate.toFixed(0)}%</p>
                </div>
                <HardDrive className="h-5 w-5 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Erros</p>
                  <p className={`text-xl font-bold ${metrics.errorRate > 1 ? 'text-red-500' : 'text-green-500'}`}>
                    {metrics.errorRate.toFixed(2)}%
                  </p>
                </div>
                {metrics.errorRate > 1 ? (
                  <XCircle className="h-5 w-5 text-red-500 opacity-50" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-500 opacity-50" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Configuration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuração do Teste
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>Tamanho da Playlist</span>
                <span className="text-muted-foreground">{config.playlistSize.toLocaleString()} itens</span>
              </Label>
              <Slider
                value={[config.playlistSize]}
                onValueChange={([v]) => setConfig(c => ({ ...c, playlistSize: v }))}
                min={10000}
                max={500000}
                step={10000}
                disabled={isRunning}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>Usuários Simultâneos</span>
                <span className="text-muted-foreground">{config.concurrentUsers} usuários</span>
              </Label>
              <Slider
                value={[config.concurrentUsers]}
                onValueChange={([v]) => setConfig(c => ({ ...c, concurrentUsers: v }))}
                min={10}
                max={2000}
                step={10}
                disabled={isRunning}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>Duração do Teste</span>
                <span className="text-muted-foreground">{config.testDuration}s</span>
              </Label>
              <Slider
                value={[config.testDuration]}
                onValueChange={([v]) => setConfig(c => ({ ...c, testDuration: v }))}
                min={10}
                max={300}
                step={10}
                disabled={isRunning}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>Bitrate do Stream</span>
                <span className="text-muted-foreground">{config.streamBitrate} kbps</span>
              </Label>
              <Slider
                value={[config.streamBitrate]}
                onValueChange={([v]) => setConfig(c => ({ ...c, streamBitrate: v }))}
                min={500}
                max={10000}
                step={500}
                disabled={isRunning}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.enableCache}
                  onCheckedChange={(v) => setConfig(c => ({ ...c, enableCache: v }))}
                  disabled={isRunning}
                />
                <Label>Cache CDN</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.enableTranscode}
                  onCheckedChange={(v) => setConfig(c => ({ ...c, enableTranscode: v }))}
                  disabled={isRunning}
                />
                <Label>Transcode</Label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                className="flex-1" 
                onClick={startTest} 
                disabled={isRunning}
              >
                <Play className="h-4 w-4 mr-2" />
                Iniciar Teste
              </Button>
              <Button variant="outline" onClick={populateTestData} disabled={isRunning}>
                <Database className="h-4 w-4 mr-2" />
                Popular Dados
              </Button>
              <Button variant="ghost" onClick={clearTestData} disabled={isRunning}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Logs do Teste
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-md p-3 h-[350px] overflow-y-auto font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">Aguardando início do teste...</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-muted-foreground">{log}</div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Previous Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Resultados Anteriores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((result) => (
                <div 
                  key={result.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                >
                  <div className="flex items-center gap-4">
                    <Badge variant={result.status === 'completed' ? 'default' : 'destructive'}>
                      {result.status === 'completed' ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {result.status}
                    </Badge>
                    <span className="text-sm">
                      {result.config.concurrentUsers} usuários | {result.config.playlistSize.toLocaleString()} itens
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>RPS: {result.metrics.requestsPerSecond}</span>
                    <span>Latência: {result.metrics.avgLatency.toFixed(0)}ms</span>
                    <span>Erros: {result.metrics.errorRate.toFixed(2)}%</span>
                    <span>{result.timestamp.toLocaleTimeString('pt-BR')}</span>
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
