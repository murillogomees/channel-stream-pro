import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificationSchedule {
  id: string;
  cliente_id: string;
  notification_type: string;
  scheduled_for: string;
  days_before_due: number;
  status: string;
  attempts: number;
  last_attempt_at: string;
  sent_at: string;
  error_message: string;
  metadata: any;
  created_at: string;
}

export default function AdminNotificationQueue() {
  const [notifications, setNotifications] = useState<NotificationSchedule[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    sent: 0,
    failed: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      // Buscar notificações do dia
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from('notification_schedule')
        .select('*')
        .gte('scheduled_for', today.toISOString())
        .lt('scheduled_for', tomorrow.toISOString())
        .order('scheduled_for', { ascending: true });

      if (error) throw error;

      setNotifications(data || []);

      // Calcular estatísticas
      const stats = {
        pending: data?.filter(n => n.status === 'pending').length || 0,
        sent: data?.filter(n => n.status === 'sent').length || 0,
        failed: data?.filter(n => n.status === 'failed').length || 0,
        total: data?.length || 0
      };
      setStats(stats);

    } catch (error) {
      console.error('Erro ao carregar fila:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a fila de notificações',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const retryFailed = async () => {
    try {
      const { error } = await supabase
        .from('notification_schedule')
        .update({ status: 'pending', attempts: 0 })
        .eq('status', 'failed')
        .gte('scheduled_for', new Date().toISOString());

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Notificações falhadas reenviadas para a fila',
      });

      loadData();
    } catch (error) {
      console.error('Erro ao reprocessar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível reprocessar as notificações',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    loadData();

    // Atualizar a cada 30 segundos
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: 'secondary', icon: Clock, text: 'Pendente' },
      sent: { variant: 'default', icon: CheckCircle, text: 'Enviado' },
      failed: { variant: 'destructive', icon: XCircle, text: 'Falhou' }
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant as any} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 py-4 sm:py-8 space-y-4 sm:space-y-6 max-w-7xl overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">Fila de Notificações</h1>
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
            Monitoramento em tempo real do sistema de notificações automáticas
          </p>
        </div>
        <Button onClick={loadData} disabled={loading} className="w-full sm:w-auto flex-shrink-0">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <h3 className="text-2xl font-bold">{stats.total}</h3>
            </div>
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
              <h3 className="text-2xl font-bold">{stats.pending}</h3>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Enviados</p>
              <h3 className="text-2xl font-bold">{stats.sent}</h3>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Falharam</p>
              <h3 className="text-2xl font-bold">{stats.failed}</h3>
            </div>
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
        </Card>
      </div>

      {/* Botão de Retry */}
      {stats.failed > 0 && (
        <Card className="p-3 sm:p-4 bg-destructive/10 border-destructive">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              <p className="text-xs sm:text-sm font-medium">
                {stats.failed} notificação(ões) falharam. Deseja tentar reenviar?
              </p>
            </div>
            <Button onClick={retryFailed} variant="destructive" className="w-full sm:w-auto flex-shrink-0">
              Reprocessar Falhas
            </Button>
          </div>
        </Card>
      )}

      {/* Lista de Notificações */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Notificações de Hoje</h2>
        
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma notificação agendada para hoje
            </p>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{notif.metadata?.cliente_nome || 'Cliente'}</p>
                    {getStatusBadge(notif.status)}
                    {notif.attempts > 1 && (
                      <Badge variant="outline">
                        {notif.attempts} tentativas
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {notif.metadata?.telefone} • {notif.days_before_due} dias antes
                  </p>
                  {notif.error_message && (
                    <p className="text-sm text-destructive">
                      Erro: {notif.error_message}
                    </p>
                  )}
                </div>

                <div className="text-right text-sm text-muted-foreground">
                  {notif.sent_at ? (
                    <span>Enviado {format(new Date(notif.sent_at), 'HH:mm', { locale: ptBR })}</span>
                  ) : notif.last_attempt_at ? (
                    <span>Última tentativa {format(new Date(notif.last_attempt_at), 'HH:mm', { locale: ptBR })}</span>
                  ) : (
                    <span>Agendado para {format(new Date(notif.scheduled_for), 'HH:mm', { locale: ptBR })}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Informações do Sistema */}
      <Card className="p-6 bg-primary/5">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary" />
          Sistema Automático Ativo
        </h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>✓ Agendamento diário às 6:00 AM</li>
          <li>✓ Processamento a cada 5 minutos</li>
          <li>✓ Retry automático em falhas (até 3 tentativas)</li>
          <li>✓ Logs completos de todas as tentativas</li>
        </ul>
      </Card>
    </div>
  );
}
