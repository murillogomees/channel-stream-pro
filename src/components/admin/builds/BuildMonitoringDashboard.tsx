/**
 * BuildMonitoringDashboard - Monitoramento em tempo real dos builds
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity, 
  Clock, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  Terminal,
  Cpu,
  HardDrive
} from "lucide-react";
import { useBuildSystem } from "./hooks/useBuildSystem";
import { PLATFORM_LABELS, BUILD_STATUS_COLORS } from "./types";
import { cn } from "@/lib/utils";

export function BuildMonitoringDashboard() {
  const { jobs } = useBuildSystem();

  const activeJobs = jobs.filter(j => 
    ['queued', 'building', 'testing', 'deploying'].includes(j.status)
  );

  const recentJobs = jobs
    .filter(j => ['success', 'failed', 'cancelled'].includes(j.status))
    .slice(-5)
    .reverse();

  // Simulated system metrics
  const systemMetrics = {
    cpu: 45,
    memory: 62,
    disk: 78,
    network: 'Stable'
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Active Jobs */}
      <Card className="lg:col-span-2 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-500" />
            Jobs Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mb-2 opacity-50" />
              <p>Nenhum job em execução</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeJobs.map((job) => (
                <div key={job.id} className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{PLATFORM_LABELS[job.platform]}</span>
                      <Badge className={cn("text-xs", BUILD_STATUS_COLORS[job.status])}>
                        {job.status}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(job.progress)}%
                    </span>
                  </div>
                  <Progress value={job.progress} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    {job.logs[job.logs.length - 1]}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Metrics */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Métricas do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">CPU</span>
              <span>{systemMetrics.cpu}%</span>
            </div>
            <Progress value={systemMetrics.cpu} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Memória</span>
              <span>{systemMetrics.memory}%</span>
            </div>
            <Progress value={systemMetrics.memory} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Disco</span>
              <span>{systemMetrics.disk}%</span>
            </div>
            <Progress value={systemMetrics.disk} className="h-2" />
          </div>

          <div className="flex justify-between text-sm p-2 rounded bg-muted/50">
            <span className="text-muted-foreground">Rede</span>
            <Badge variant="outline" className="text-green-500">
              {systemMetrics.network}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Recent Completions */}
      <Card className="lg:col-span-2 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Completados Recentemente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhum build completado ainda
            </p>
          ) : (
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <div 
                  key={job.id} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {job.status === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : job.status === 'failed' ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium">{PLATFORM_LABELS[job.platform]}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.completedAt && new Date(job.completedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge className={cn(BUILD_STATUS_COLORS[job.status])}>
                    {job.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Console Output */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Console
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] rounded-lg bg-black/90 p-3">
            <div className="font-mono text-xs text-green-400 space-y-1">
              {jobs.length === 0 ? (
                <p className="text-muted-foreground">Aguardando jobs...</p>
              ) : (
                jobs.slice(-10).flatMap(job => 
                  job.logs.map((log, i) => (
                    <p key={`${job.id}-${i}`}>
                      <span className="text-blue-400">[{job.platform}]</span> {log}
                    </p>
                  ))
                )
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
