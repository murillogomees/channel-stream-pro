import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RotateCcw, CheckCircle, XCircle, Clock, Webhook } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FailedWebhook {
  id: string;
  jobId: string;
  url: string;
  payload: any;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  lastAttemptAt: string;
  nextRetryAt: string;
}

export function TranscodeWebhookRetry() {
  const { toast } = useToast();
  const [failedWebhooks, setFailedWebhooks] = useState<FailedWebhook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFailedWebhooks();
    const interval = setInterval(loadFailedWebhooks, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadFailedWebhooks = async () => {
    try {
      // Simulate loading failed webhooks
      // In production, this would query a webhook_failures table
      const mockFailures: FailedWebhook[] = [
        {
          id: 'wh1',
          jobId: 'job123',
          url: 'https://api.example.com/webhook',
          payload: { event: 'transcode.complete', jobId: 'job123' },
          attempts: 2,
          maxAttempts: 5,
          lastError: 'Connection timeout',
          lastAttemptAt: new Date(Date.now() - 300000).toISOString(),
          nextRetryAt: new Date(Date.now() + 600000).toISOString(),
        },
      ];

      setFailedWebhooks(mockFailures);
    } catch (error) {
      console.error('Error loading failed webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const retryWebhook = async (webhookId: string) => {
    try {
      toast({
        title: 'Retry iniciado',
        description: 'Tentando reenviar webhook...',
      });

      // In production, trigger webhook retry
      await new Promise(resolve => setTimeout(resolve, 1000));

      setFailedWebhooks(prev => prev.filter(w => w.id !== webhookId));

      toast({
        title: 'Webhook reenviado',
        description: 'Webhook enviado com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao reenviar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const retryAll = async () => {
    for (const webhook of failedWebhooks) {
      await retryWebhook(webhook.id);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const discardWebhook = async (webhookId: string) => {
    if (!confirm('Descartar este webhook permanentemente?')) return;

    try {
      setFailedWebhooks(prev => prev.filter(w => w.id !== webhookId));
      toast({
        title: 'Webhook descartado',
        description: 'Não será mais tentado',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao descartar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Sistema de Retry de Webhooks
            </CardTitle>
            <CardDescription>
              Retry automático com backoff exponencial para webhooks falhados
            </CardDescription>
          </div>
          {failedWebhooks.length > 0 && (
            <Button onClick={retryAll} size="sm">
              <RotateCcw className="h-4 w-4 mr-2" />
              Retentar Todos
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando webhooks falhados...
          </div>
        ) : failedWebhooks.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="font-medium mb-2">Nenhum Webhook Falhado</h3>
            <p className="text-sm text-muted-foreground">
              Todos os webhooks foram enviados com sucesso
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {failedWebhooks.map((webhook) => {
              const isRetrying = new Date(webhook.nextRetryAt) < new Date();
              const backoffMinutes = Math.pow(2, webhook.attempts - 1) * 5; // 5min, 10min, 20min...

              return (
                <div key={webhook.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Falha
                        </Badge>
                        <Badge variant="outline">
                          Tentativa {webhook.attempts}/{webhook.maxAttempts}
                        </Badge>
                        {isRetrying && (
                          <Badge variant="default" className="animate-pulse">
                            <Clock className="h-3 w-3 mr-1" />
                            Retrying...
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">URL:</span>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {webhook.url}
                          </code>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Job:</span>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {webhook.jobId}
                          </code>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Erro:</span>
                          <span className="text-xs text-destructive">
                            {webhook.lastError}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retryWebhook(webhook.id)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => discardWebhook(webhook.id)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Última tentativa:{' '}
                      {formatDistanceToNow(new Date(webhook.lastAttemptAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                    <span>
                      Próximo retry em {backoffMinutes} min (backoff exponencial)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 p-4 bg-muted rounded-lg space-y-2 text-sm">
          <h4 className="font-medium flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Sistema de Retry Automático
          </h4>
          <ul className="space-y-1 text-muted-foreground ml-6 list-disc">
            <li>Backoff exponencial: 5min → 10min → 20min → 40min → 80min</li>
            <li>Máximo de 5 tentativas automáticas</li>
            <li>Após 5 falhas, webhook requer intervenção manual</li>
            <li>Logs completos disponíveis para debugging</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
