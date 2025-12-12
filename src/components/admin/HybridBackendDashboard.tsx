/**
 * Hybrid Backend Dashboard
 * Monitors and manages Cloud + Self-Hosted backends
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  Cloud, 
  Server, 
  RefreshCw, 
  Zap, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Database,
  Cpu,
  HardDrive,
} from "lucide-react";
import { useBackendHealth } from "@/hooks/useHybridBackend";
import { toast } from "sonner";

export function HybridBackendDashboard() {
  const { health, checking, refresh, isSelfHostedConfigured, stats } = useBackendHealth();
  const [activeTab, setActiveTab] = useState("overview");

  const handleRefresh = async () => {
    await refresh();
    toast.success("Health check atualizado");
  };

  const formatLatency = (ms: number) => {
    if (ms === 0) return "N/A";
    if (ms < 100) return `${Math.round(ms)}ms 🚀`;
    if (ms < 500) return `${Math.round(ms)}ms ✓`;
    return `${Math.round(ms)}ms ⚠️`;
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return "Nunca";
    return new Date(timestamp).toLocaleTimeString('pt-BR');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-primary" />
            Backend Híbrido
          </h2>
          <p className="text-muted-foreground">
            Monitoramento Cloud + Self-Hosted
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={checking}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Backend Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lovable Cloud */}
        <Card className={health.cloud.healthy ? 'border-green-500/50' : 'border-red-500/50'}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Cloud className="h-5 w-5 text-blue-500" />
                Lovable Cloud
              </CardTitle>
              <Badge variant={health.cloud.healthy ? "default" : "destructive"}>
                {health.cloud.healthy ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Online</>
                ) : (
                  <><XCircle className="h-3 w-3 mr-1" /> Offline</>
                )}
              </Badge>
            </div>
            <CardDescription>Operações leves (Auth, Pagamentos, Notificações)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Latência:</span>
              <span className="font-mono">{formatLatency(health.cloud.latency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Último check:</span>
              <span>{formatTime(health.cloud.lastCheck)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Chamadas:</span>
              <span className="font-mono">{stats.cloudCalls}</span>
            </div>
          </CardContent>
        </Card>

        {/* Self-Hosted VPS */}
        <Card className={
          !isSelfHostedConfigured 
            ? 'border-yellow-500/50' 
            : health.selfHosted.healthy 
              ? 'border-green-500/50' 
              : 'border-red-500/50'
        }>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="h-5 w-5 text-purple-500" />
                Self-Hosted VPS
              </CardTitle>
              {!isSelfHostedConfigured ? (
                <Badge variant="outline" className="text-yellow-600">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Não Configurado
                </Badge>
              ) : (
                <Badge variant={health.selfHosted.healthy ? "default" : "destructive"}>
                  {health.selfHosted.healthy ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Online</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Offline</>
                  )}
                </Badge>
              )}
            </div>
            <CardDescription>Operações pesadas (M3U, Streaming, CDN)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isSelfHostedConfigured ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Latência:</span>
                  <span className="font-mono">{formatLatency(health.selfHosted.latency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Último check:</span>
                  <span>{formatTime(health.selfHosted.lastCheck)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Chamadas:</span>
                  <span className="font-mono">{stats.selfHostedCalls}</span>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                Configure as variáveis de ambiente:
                <code className="block mt-2 p-2 bg-muted rounded text-xs">
                  VITE_SUPABASE_SELFHOSTED_URL<br/>
                  VITE_SUPABASE_SELFHOSTED_KEY
                </code>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="routing">Roteamento</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Cloud Calls</span>
                </div>
                <p className="text-2xl font-bold mt-2">{stats.cloudCalls}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Self-Hosted Calls</span>
                </div>
                <p className="text-2xl font-bold mt-2">{stats.selfHostedCalls}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Fallbacks</span>
                </div>
                <p className="text-2xl font-bold mt-2">{stats.fallbacks}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Eficiência</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {stats.cloudCalls + stats.selfHostedCalls > 0
                    ? Math.round((stats.selfHostedCalls / (stats.cloudCalls + stats.selfHostedCalls)) * 100)
                    : 0}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Architecture Diagram */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Arquitetura Híbrida</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center justify-around gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto">
                    <Cloud className="h-8 w-8 text-blue-500" />
                  </div>
                  <p className="mt-2 font-medium">Lovable Cloud</p>
                  <p className="text-xs text-muted-foreground">Auth, Pagamentos</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Roteamento Inteligente</span>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto">
                    <Server className="h-8 w-8 text-purple-500" />
                  </div>
                  <p className="mt-2 font-medium">Self-Hosted VPS</p>
                  <p className="text-xs text-muted-foreground">M3U, Streaming</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Regras de Roteamento</CardTitle>
              <CardDescription>Funções e seus backends designados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <Server className="h-4 w-4 text-purple-500" />
                    Self-Hosted (Operações Pesadas)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'fetch-m3u', 'm3u-sync', 'generate-m3u-from-sync',
                      'stream-proxy', 'transcode-processor', 'cdn-bulk-downloader',
                      'iptv-m3u-generator', 'r2-migration-worker'
                    ].map(fn => (
                      <Badge key={fn} variant="secondary" className="font-mono text-xs">
                        {fn}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <Cloud className="h-4 w-4 text-blue-500" />
                    Lovable Cloud (Operações Leves)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'mercado-pago-checkout', 'mercado-pago-webhook',
                      'whatsapp-webhook', 'create-admin-user', 'list-users',
                      'generate-totp-secret', 'verify-totp-token'
                    ].map(fn => (
                      <Badge key={fn} variant="outline" className="font-mono text-xs">
                        {fn}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  VPS Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>RAM (32GB)</span>
                    <span>~40% utilizado</span>
                  </div>
                  <Progress value={40} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>CPU</span>
                    <span>~25% utilizado</span>
                  </div>
                  <Progress value={25} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Disco</span>
                    <span>~15% utilizado</span>
                  </div>
                  <Progress value={15} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Latência Média
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-blue-500" />
                    <span>Cloud</span>
                  </div>
                  <span className="font-mono">{formatLatency(stats.avgCloudLatency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-purple-500" />
                    <span>Self-Hosted</span>
                  </div>
                  <span className="font-mono">{formatLatency(stats.avgSelfHostedLatency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-green-500" />
                    <span>Database</span>
                  </div>
                  <span className="font-mono">~15ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-orange-500" />
                    <span>Redis Cache</span>
                  </div>
                  <span className="font-mono">~2ms</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
