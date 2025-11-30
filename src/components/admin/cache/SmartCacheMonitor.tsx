/**
 * Smart Cache Monitor Dashboard
 * 
 * Admin dashboard for monitoring intelligent cache system.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  HardDrive, 
  Flame, 
  TrendingUp, 
  Clock, 
  Trash2,
  Play,
  Pause,
  Zap,
  Activity,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { 
  streamCacheService,
  cacheWarmingService,
  predictiveCacheEngine,
  CacheStats,
  WarmingStats,
} from '@/services/cache';

export function SmartCacheMonitor() {
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [warmingStats, setWarmingStats] = useState<WarmingStats | null>(null);
  const [predictionStats, setPredictionStats] = useState<any>(null);
  const [isWarmingEnabled, setIsWarmingEnabled] = useState(true);
  const [isLowBandwidth, setIsLowBandwidth] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshStats = async () => {
    setIsRefreshing(true);
    try {
      await streamCacheService.updateStats();
      setCacheStats(streamCacheService.getStats());
      setWarmingStats(cacheWarmingService.getStats());
      setPredictionStats(predictiveCacheEngine.getStats());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = async () => {
    await cacheWarmingService.clearCache();
    await refreshStats();
  };

  const handleToggleWarming = (enabled: boolean) => {
    setIsWarmingEnabled(enabled);
    if (enabled) {
      cacheWarmingService.resume();
    } else {
      cacheWarmingService.pause();
    }
  };

  const handleToggleLowBandwidth = (enabled: boolean) => {
    setIsLowBandwidth(enabled);
    cacheWarmingService.setLowBandwidthMode(enabled);
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const formatDuration = (ms: number) => {
    if (ms >= 60000) return `${(ms / 60000).toFixed(1)} min`;
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
    return `${ms} ms`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Cache Inteligente
          </h2>
          <p className="text-muted-foreground">
            Sistema de cache preditivo com ML
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshStats}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleClearCache}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Cache
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cacheStats?.hitRate || 0}%
            </div>
            <Progress 
              value={cacheStats?.hitRate || 0} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {cacheStats?.hits || 0} hits / {cacheStats?.misses || 0} misses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Size</CardTitle>
            <HardDrive className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(cacheStats?.totalSize || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {cacheStats?.manifestsCached || 0} manifests, {cacheStats?.segmentsCached || 0} segments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warming Queue</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {warmingStats?.queueSize || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {warmingStats?.warmedManifests || 0} warmed, {warmingStats?.failedWarms || 0} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Warm Time</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(warmingStats?.avgWarmDuration || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Last: {warmingStats?.lastWarmTime 
                ? new Date(warmingStats.lastWarmTime).toLocaleTimeString() 
                : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="controls" className="space-y-4">
        <TabsList>
          <TabsTrigger value="controls">
            <Zap className="h-4 w-4 mr-2" />
            Controles
          </TabsTrigger>
          <TabsTrigger value="predictions">
            <Brain className="h-4 w-4 mr-2" />
            Predições
          </TabsTrigger>
          <TabsTrigger value="performance">
            <BarChart3 className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="controls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Warming</CardTitle>
              <CardDescription>
                Controle o comportamento do cache warming
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    {isWarmingEnabled ? (
                      <Play className="h-4 w-4 text-green-500" />
                    ) : (
                      <Pause className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="font-medium">Cache Warming</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Pré-carrega conteúdo baseado em predições
                  </p>
                </div>
                <Switch
                  checked={isWarmingEnabled}
                  onCheckedChange={handleToggleWarming}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Modo Baixa Banda</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Reduz agressividade do warming
                  </p>
                </div>
                <Switch
                  checked={isLowBandwidth}
                  onCheckedChange={handleToggleLowBandwidth}
                />
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">Status do Sistema</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={streamCacheService.isAvailable() ? "default" : "destructive"}>
                      {streamCacheService.isAvailable() ? "Ativo" : "Inativo"}
                    </Badge>
                    <span className="text-sm">Cache API</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isWarmingEnabled ? "default" : "secondary"}>
                      {isWarmingEnabled ? "Ativo" : "Pausado"}
                    </Badge>
                    <span className="text-sm">Warming Service</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engine de Predição</CardTitle>
              <CardDescription>
                Estatísticas do motor de predição ML-like
              </CardDescription>
            </CardHeader>
            <CardContent>
              {predictionStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Cache de Predições</p>
                      <p className="text-xl font-bold">{predictionStats.cacheSize}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Idade da Predição</p>
                      <p className="text-xl font-bold">
                        {formatDuration(predictionStats.lastPredictionAge)}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">Pesos do Algoritmo</h4>
                    <div className="space-y-2">
                      {Object.entries(predictionStats.config.weights).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <div className="flex items-center gap-2">
                            <Progress value={(value as number) * 100} className="w-20 h-2" />
                            <span className="text-sm font-mono w-12">
                              {((value as number) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Carregando...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Métricas de Performance</CardTitle>
              <CardDescription>
                Análise detalhada do sistema de cache
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Cache Efficiency */}
                <div>
                  <h4 className="font-medium mb-3">Eficiência do Cache</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Taxa de Acerto</span>
                      <span className="font-mono">{cacheStats?.hitRate || 0}%</span>
                    </div>
                    <Progress value={cacheStats?.hitRate || 0} />
                  </div>
                </div>

                {/* Warming Success */}
                <div>
                  <h4 className="font-medium mb-3">Sucesso do Warming</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Taxa de Sucesso</span>
                      <span className="font-mono">
                        {warmingStats && (warmingStats.warmedManifests + warmingStats.failedWarms) > 0
                          ? Math.round(
                              (warmingStats.warmedManifests / 
                                (warmingStats.warmedManifests + warmingStats.failedWarms)) * 100
                            )
                          : 0}%
                      </span>
                    </div>
                    <Progress 
                      value={
                        warmingStats && (warmingStats.warmedManifests + warmingStats.failedWarms) > 0
                          ? (warmingStats.warmedManifests / 
                              (warmingStats.warmedManifests + warmingStats.failedWarms)) * 100
                          : 0
                      } 
                    />
                  </div>
                </div>

                {/* Storage Usage */}
                <div>
                  <h4 className="font-medium mb-3">Uso de Storage</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{cacheStats?.manifestsCached || 0}</p>
                      <p className="text-xs text-muted-foreground">Manifests</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{cacheStats?.segmentsCached || 0}</p>
                      <p className="text-xs text-muted-foreground">Segments</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{formatBytes(cacheStats?.totalSize || 0)}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SmartCacheMonitor;
