import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight, Wifi } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { subDays } from 'date-fns';

interface NotificationStats {
  total_24h: number;
  success_24h: number;
  error_24h: number;
  success_rate_24h: number;
  total_7d: number;
  success_7d: number;
  error_7d: number;
  success_rate_7d: number;
}

export function NotificationStatsWidget() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<NotificationStats>({
    total_24h: 0,
    success_24h: 0,
    error_24h: 0,
    success_rate_24h: 0,
    total_7d: 0,
    success_7d: 0,
    error_7d: 0,
    success_rate_7d: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadStats = async () => {
    try {
      const now = new Date();
      const last24h = subDays(now, 1).toISOString();
      const last7d = subDays(now, 7).toISOString();

      const { data: logs24h } = await supabase.from('notification_logs').select('status').gte('sent_at', last24h);
      const { data: logs7d } = await supabase.from('notification_logs').select('status').gte('sent_at', last7d);

      const success24h = logs24h?.filter(l => l.status === 'success').length || 0;
      const error24h = logs24h?.filter(l => l.status === 'error').length || 0;
      const total24h = logs24h?.length || 0;

      const success7d = logs7d?.filter(l => l.status === 'success').length || 0;
      const error7d = logs7d?.filter(l => l.status === 'error').length || 0;
      const total7d = logs7d?.length || 0;

      setStats({
        total_24h: total24h,
        success_24h: success24h,
        error_24h: error24h,
        success_rate_24h: total24h > 0 ? (success24h / total24h) * 100 : 0,
        total_7d: total7d,
        success_7d: success7d,
        error_7d: error7d,
        success_rate_7d: total7d > 0 ? (success7d / total7d) * 100 : 0,
      });

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao buscar stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    const channel = supabase.channel('notification-logs-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'notification_logs' }, () => loadStats()).subscribe();
    const interval = setInterval(loadStats, 30000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  if (loading) return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 animate-pulse" />Estatísticas de Notificações</CardTitle></CardHeader></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Bell className="h-5 w-5" />Notificações (Tempo Real)</div>
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-green-500" />
            <Badge variant="outline" className="text-xs">Ao vivo</Badge>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/notification-stats')}>Ver Detalhes<ArrowRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </CardTitle>
        <CardDescription>Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold mb-2">Últimas 24 horas</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{stats.total_24h}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" />Sucesso</p>
              <p className="text-lg font-bold text-green-600">{stats.success_24h}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" />Erros</p>
              <p className="text-lg font-bold text-destructive">{stats.error_24h}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge variant={stats.success_rate_24h >= 90 ? 'default' : 'destructive'}>Taxa: {stats.success_rate_24h.toFixed(1)}%</Badge>
          </div>
        </div>
        <div className="pt-3 border-t">
          <h4 className="text-sm font-semibold mb-2">Últimos 7 dias</h4>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{stats.total_7d}</p>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-5 w-5 ${stats.success_rate_7d >= 90 ? 'text-green-600' : 'text-orange-500'}`} />
              <Badge variant={stats.success_rate_7d >= 90 ? 'default' : 'secondary'}>{stats.success_rate_7d.toFixed(1)}% sucesso</Badge>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground text-center">{stats.success_7d} sucesso • {stats.error_7d} erros</div>
        </div>
      </CardContent>
    </Card>
  );
}
