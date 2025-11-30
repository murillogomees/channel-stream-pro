/**
 * CFStreamRetryManager - Gerenciador de retry automático com backoff exponencial
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  Settings2,
  Timer,
  Zap,
  RotateCcw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RetryQueueItem {
  id: string;
  channel_id: string;
  channel_name?: string;
  status: string;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  next_retry?: string;
  created_at: string;
  updated_at: string;
}

interface RetryConfig {
  auto_retry_enabled: boolean;
  max_retries: number;
  base_delay_minutes: number;
  max_delay_minutes: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  auto_retry_enabled: true,
  max_retries: 5,
  base_delay_minutes: 1,
  max_delay_minutes: 60,
};

export function CFStreamRetryManager() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<RetryConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);

  // Fetch retry queue
  const { data: retryQueue, isLoading } = useQuery({
    queryKey: ["cf-stream-retry-queue"],
    queryFn: async () => {
      const { data: uploads, error } = await supabase
        .from("cf_stream_uploads")
        .select("id, channel_id, status, retry_count, max_retries, error_message, metadata, created_at, updated_at")
        .in("status", ["retry_scheduled", "error"])
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch channel names
      const channelIds = [...new Set((uploads || []).map(u => u.channel_id))];
      let channelMap: Record<string, string> = {};

      if (channelIds.length > 0) {
        const { data: channels } = await supabase
          .from("m3u_channels")
          .select("id, name")
          .in("id", channelIds);

        if (channels) {
          channelMap = channels.reduce((acc, ch) => {
            acc[ch.id] = ch.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return (uploads || []).map(u => ({
        ...u,
        channel_name: channelMap[u.channel_id] || u.channel_id,
        next_retry: (u.metadata as any)?.next_retry,
      })) as RetryQueueItem[];
    },
    refetchInterval: 30000,
  });

  // Retry single upload
  const retryMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      const { error } = await supabase
        .from("cf_stream_uploads")
        .update({
          status: "queued",
          error_message: null,
          retry_count: 0,
          started_at: null,
          metadata: { manual_retry: true, retry_at: new Date().toISOString() },
        })
        .eq("id", uploadId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Upload recolocado na fila");
      queryClient.invalidateQueries({ queryKey: ["cf-stream-retry-queue"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao reprocessar", { description: err.message });
    },
  });

  // Retry all failed
  const retryAllMutation = useMutation({
    mutationFn: async () => {
      const failedItems = retryQueue?.filter(item => 
        item.status === "error" && item.retry_count < item.max_retries
      ) || [];

      for (const item of failedItems) {
        await supabase
          .from("cf_stream_uploads")
          .update({
            status: "queued",
            error_message: null,
            started_at: null,
            metadata: { manual_retry: true, retry_at: new Date().toISOString() },
          })
          .eq("id", item.id);
      }

      return failedItems.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} uploads recolocados na fila`);
      queryClient.invalidateQueries({ queryKey: ["cf-stream-retry-queue"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao reprocessar", { description: err.message });
    },
  });

  // Cancel retry
  const cancelMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      const { error } = await supabase
        .from("cf_stream_uploads")
        .update({
          status: "error",
          error_message: "Retry cancelado manualmente",
          metadata: { cancelled_at: new Date().toISOString() },
        })
        .eq("id", uploadId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Retry cancelado");
      queryClient.invalidateQueries({ queryKey: ["cf-stream-retry-queue"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao cancelar", { description: err.message });
    },
  });

  const scheduledCount = retryQueue?.filter(item => item.status === "retry_scheduled").length || 0;
  const errorCount = retryQueue?.filter(item => item.status === "error").length || 0;
  const retryableErrorCount = retryQueue?.filter(
    item => item.status === "error" && item.retry_count < item.max_retries
  ).length || 0;

  const formatNextRetry = (nextRetry?: string) => {
    if (!nextRetry) return "Agendado";
    const date = new Date(nextRetry);
    if (date <= new Date()) return "Pronto para retry";
    return `em ${formatDistanceToNow(date, { locale: ptBR })}`;
  };

  const calculateBackoff = (retryCount: number) => {
    const delay = config.base_delay_minutes * Math.pow(2, retryCount);
    return Math.min(delay, config.max_delay_minutes);
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Timer className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{scheduledCount}</p>
                <p className="text-xs text-muted-foreground">Retry Agendado</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{errorCount}</p>
                <p className="text-xs text-muted-foreground">Com Erro</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <RotateCcw className="h-4 w-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{retryableErrorCount}</p>
                <p className="text-xs text-muted-foreground">Recuperáveis</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{config.max_retries}</p>
                <p className="text-xs text-muted-foreground">Max Retries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Config Panel */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Configuração de Retry
              </CardTitle>
              <CardDescription>
                Backoff exponencial: delay = base × 2^retry_count
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
            >
              {showConfig ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        {showConfig && (
          <CardContent className="space-y-4 pt-0">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Retry Automático</Label>
                <p className="text-xs text-muted-foreground">
                  Processar automaticamente uploads falhos
                </p>
              </div>
              <Switch
                checked={config.auto_retry_enabled}
                onCheckedChange={(checked) => 
                  setConfig(prev => ({ ...prev, auto_retry_enabled: checked }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Max Retries: {config.max_retries}</Label>
              <Slider
                value={[config.max_retries]}
                onValueChange={([value]) => 
                  setConfig(prev => ({ ...prev, max_retries: value }))
                }
                min={1}
                max={10}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Delay Base: {config.base_delay_minutes} min</Label>
              <Slider
                value={[config.base_delay_minutes]}
                onValueChange={([value]) => 
                  setConfig(prev => ({ ...prev, base_delay_minutes: value }))
                }
                min={1}
                max={10}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Delay Máximo: {config.max_delay_minutes} min</Label>
              <Slider
                value={[config.max_delay_minutes]}
                onValueChange={([value]) => 
                  setConfig(prev => ({ ...prev, max_delay_minutes: value }))
                }
                min={10}
                max={120}
                step={5}
              />
            </div>

            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <div className="text-sm">
                  <strong>Exemplo de backoff:</strong>
                  <ul className="mt-1 space-y-1">
                    {[0, 1, 2, 3, 4].map(i => (
                      <li key={i}>
                        Retry {i + 1}: {calculateBackoff(i)} minutos
                      </li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => retryAllMutation.mutate()}
          disabled={retryableErrorCount === 0 || retryAllMutation.isPending}
        >
          <RefreshCw className={cn(
            "h-4 w-4 mr-2",
            retryAllMutation.isPending && "animate-spin"
          )} />
          Reprocessar Todos ({retryableErrorCount})
        </Button>
      </div>

      {/* Queue List */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Fila de Retry</CardTitle>
          <CardDescription>
            Uploads aguardando retry ou com erro
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (retryQueue?.length || 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>Nenhum upload na fila de retry</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {retryQueue?.map((item) => (
                  <Card key={item.id} className="border-border/50">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">
                            {item.channel_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.error_message || "Aguardando processamento"}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right text-xs text-muted-foreground">
                            <p>Retry {item.retry_count}/{item.max_retries}</p>
                            {item.status === "retry_scheduled" && (
                              <p className="text-orange-500">
                                {formatNextRetry(item.next_retry)}
                              </p>
                            )}
                          </div>

                          <Badge variant={item.status === "retry_scheduled" ? "secondary" : "destructive"}>
                            {item.status === "retry_scheduled" ? "Agendado" : "Erro"}
                          </Badge>

                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => retryMutation.mutate(item.id)}
                              disabled={retryMutation.isPending}
                              title="Reprocessar agora"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            {item.status === "retry_scheduled" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-600"
                                onClick={() => cancelMutation.mutate(item.id)}
                                disabled={cancelMutation.isPending}
                                title="Cancelar retry"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
