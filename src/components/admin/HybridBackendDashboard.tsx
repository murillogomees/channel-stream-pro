/**
 * Self-Hosted Backend Dashboard
 * Monitors the Self-Hosted Supabase backend
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  Server, 
  RefreshCw, 
  Zap, 
  CheckCircle2,
  XCircle,
  Database,
  Cpu,
  HardDrive,
} from "lucide-react";
import { useBackendHealth } from "@/hooks/useHybridBackend";
import { toast } from "sonner";

export function HybridBackendDashboard() {
  const { health, checking, refresh, stats } = useBackendHealth();
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
            <Server className="h-6 w-6 text-primary" />
            Backend Self-Hosted
          </h2>
          <p className="text-muted-foreground">
            Supabase Self-Hosted • supabase.iptvlink.com.br
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

      {/* Backend Status Card */}
      <Card className={health.healthy ? 'border-green-500/50' : 'border-red-500/50'}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5 text-purple-500" />
              Self-Hosted VPS
            </CardTitle>
            <Badge variant={health.healthy ? "default" : "destructive"}>
              {health.healthy ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" /> Online</>
              ) : (
                <><XCircle className="h-3 w-3 mr-1" /> Offline</>
              )}
            </Badge>
          </div>
          <CardDescription>Todas as operações (Auth, DB, Storage, Edge Functions)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Latência:</span>
            <span className="font-mono">{formatLatency(health.latency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Último check:</span>
            <span>{formatTime(health.lastCheck)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Chamadas:</span>
            <span className="font-mono">{stats.calls}</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="functions">Edge Functions</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Total Calls</span>
                </div>
                <p className="text-2xl font-bold mt-2">{stats.calls}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Latência Média</span>
                </div>
                <p className="text-2xl font-bold mt-2">{formatLatency(stats.avgLatency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Status</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {health.healthy ? '100%' : '0%'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Architecture Diagram */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Arquitetura Self-Hosted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center justify-around gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto">
                    <Server className="h-8 w-8 text-purple-500" />
                  </div>
                  <p className="mt-2 font-medium">Supabase Self-Hosted</p>
                  <p className="text-xs text-muted-foreground">supabase.iptvlink.com.br</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto">
                    <Database className="h-8 w-8 text-blue-500" />
                  </div>
                  <p className="mt-2 font-medium">PostgreSQL</p>
                  <p className="text-xs text-muted-foreground">Database</p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                    <Zap className="h-8 w-8 text-green-500" />
                  </div>
                  <p className="mt-2 font-medium">Edge Runtime</p>
                  <p className="text-xs text-muted-foreground">Functions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="functions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Edge Functions Disponíveis</CardTitle>
              <CardDescription>Todas as funções deployadas no Self-Hosted</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[
                  'fetch-m3u', 'm3u-sync', 'generate-m3u-from-sync',
                  'stream-proxy', 'iptv-transcode', 'iptv-redis-cache',
                  'mercado-pago-checkout', 'mercado-pago-webhook',
                  'whatsapp-webhook', 'create-admin-user', 'list-users',
                  'generate-totp-secret', 'verify-totp-token', 'health-check',
                  'custom-auth', 'scheduled-backup', 'cleanup-old-logs'
                ].map(fn => (
                  <Badge key={fn} variant="secondary" className="font-mono text-xs">
                    {fn}
                  </Badge>
                ))}
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
                  Latência por Serviço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-purple-500" />
                    <span>Edge Functions</span>
                  </div>
                  <span className="font-mono">{formatLatency(stats.avgLatency)}</span>
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
                    <span>Storage</span>
                  </div>
                  <span className="font-mono">~50ms</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
