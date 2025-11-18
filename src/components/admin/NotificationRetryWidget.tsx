import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, CheckCircle2, Clock, XCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface RetryStats {
  total: number;
  pending: number;
  retrying: number;
  succeeded: number;
  exhausted: number;
  avg_attempts: number;
  oldest_pending: string | null;
}

export function NotificationRetryWidget() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<RetryStats>({
    total: 0,
    pending: 0,
    retrying: 0,
    succeeded: 0,
    exhausted: 0,
    avg_attempts: 0,
    oldest_pending: null,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_notification_retry_stats');

      if (error) {
        console.error('Erro ao carregar estatísticas de retry:', error);
        return;
      }

      if (data) {
        // Parse do resultado JSON
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        setStats({
          total: parsed.total || 0,
          pending: parsed.pending || 0,
          retrying: parsed.retrying || 0,
          succeeded: parsed.succeeded || 0,
          exhausted: parsed.exhausted || 0,
          avg_attempts: parsed.avg_attempts || 0,
          oldest_pending: parsed.oldest_pending || null,
        });
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Erro ao buscar stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();

    // Realtime subscription
    const channel = supabase
      .channel('notification-retry-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_retry_queue',
        },
        () => {
          loadStats();
        }
      )
      .subscribe();

    // Refresh periódico a cada 30 segundos
    const interval = setInterval(loadStats, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Fila de Retry de Notificações
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const activeRetries = stats.pending + stats.retrying;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Fila de Retry
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/notification-retry')}
          >
            Ver Detalhes
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardTitle>
        <CardDescription>
          Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Aguardando</span>
            </div>
            <p className="text-2xl font-bold">{activeRetries}</p>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">
                {stats.pending} pendentes
              </Badge>
              {stats.retrying > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {stats.retrying} retrying
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Sucesso</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.succeeded}</p>
            <Badge variant="outline" className="text-xs">
              Taxa: {stats.total > 0 ? ((stats.succeeded / stats.total) * 100).toFixed(1) : 0}%
            </Badge>
          </div>
        </div>

        {stats.exhausted > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium">Falhas Permanentes</span>
            </div>
            <Badge variant="destructive">{stats.exhausted}</Badge>
          </div>
        )}

        {stats.avg_attempts > 0 && (
          <div className="text-xs text-muted-foreground">
            Média de tentativas: {stats.avg_attempts.toFixed(1)}
          </div>
        )}

        {activeRetries > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3 w-3" />
            <span>{activeRetries} notificação(ões) aguardando processamento</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
