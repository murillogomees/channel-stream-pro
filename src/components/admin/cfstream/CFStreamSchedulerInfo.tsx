/**
 * CFStreamSchedulerInfo - Informações sobre o scheduler automático
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Settings, Zap, RefreshCw } from "lucide-react";

interface SchedulerConfig {
  maxParallelUploads: number;
  batchSize: number;
  cronInterval: string;
  maxRetries: number;
  stuckTimeout: number;
}

interface CFStreamSchedulerInfoProps {
  config?: SchedulerConfig;
  lastRun?: string;
  nextRun?: string;
}

export function CFStreamSchedulerInfo({ 
  config = {
    maxParallelUploads: 5,
    batchSize: 10,
    cronInterval: "*/5 * * * *",
    maxRetries: 3,
    stuckTimeout: 30,
  },
  lastRun,
  nextRun 
}: CFStreamSchedulerInfoProps) {
  const configItems = [
    { label: "Uploads Paralelos", value: config.maxParallelUploads, icon: Zap },
    { label: "Batch Size", value: config.batchSize, icon: Settings },
    { label: "Max Retries", value: config.maxRetries, icon: RefreshCw },
    { label: "Timeout (min)", value: config.stuckTimeout, icon: Clock },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuração do Scheduler
          </CardTitle>
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            Ativo
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cron Info */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Intervalo</span>
          </div>
          <code className="text-xs bg-background px-2 py-1 rounded">
            A cada 5 minutos
          </code>
        </div>

        {/* Config Grid */}
        <div className="grid grid-cols-2 gap-3">
          {configItems.map((item) => (
            <div 
              key={item.label}
              className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
              <span className="text-sm font-medium">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Run Info */}
        <div className="space-y-2 text-xs">
          {lastRun && (
            <div className="flex justify-between text-muted-foreground">
              <span>Última execução:</span>
              <span>{new Date(lastRun).toLocaleString('pt-BR')}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Próxima execução:</span>
            <span>~5 minutos</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
