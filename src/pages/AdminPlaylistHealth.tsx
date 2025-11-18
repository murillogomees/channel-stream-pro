import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Activity, RefreshCw, CheckCircle, XCircle, AlertCircle, Clock, Bell, BellOff, Wifi } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { playlistHealthService, PlaylistHealthStats, PlaylistHealthCheck } from '@/services/playlistHealthService';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AdminPlaylistHealth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  
  const [stats, setStats] = useState<PlaylistHealthStats | null>(null);
  const [allChecks, setAllChecks] = useState<PlaylistHealthCheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/auth');
      return;
    }

    loadStats();
    
    // Real-time subscription for playlist health checks
    const channel = supabase
      .channel('playlist-health-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playlist_health_checks'
        },
        (payload) => {
          console.log('🔄 Real-time playlist health update:', payload);
          loadStats();
        }
      )
      .subscribe();

    // Periodic refresh every 60 seconds
    const interval = setInterval(() => {
      loadStats();
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [authLoading, isAdmin, navigate]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const [statsData, checksData] = await Promise.all([
        playlistHealthService.getHealthStats(),
        playlistHealthService.getAllHealthChecks(),
      ]);
      setStats(statsData);
      setAllChecks(checksData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as estatísticas.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSnooze = async (playlistId: string, hours: number) => {
    try {
      const result = await playlistHealthService.snoozePlaylist(playlistId, hours);
      
      if (result.success) {
        toast({
          title: 'Alertas pausados',
          description: result.message,
        });
        await loadStats();
      } else {
        toast({
          title: 'Erro',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleUnsnooze = async (playlistId: string) => {
    try {
      const result = await playlistHealthService.unsnoozePlaylist(playlistId);
      
      if (result.success) {
        toast({
          title: 'Alertas reativados',
          description: result.message,
        });
        await loadStats();
      } else {
        toast({
          title: 'Erro',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRunHealthCheck = async () => {
    setIsRunning(true);
    try {
      const result = await playlistHealthService.runHealthCheck();
      
      if (result.success) {
        toast({
          title: 'Verificação concluída',
          description: result.message,
        });
        
        // Recarregar estatísticas
        await loadStats();
      } else {
        toast({
          title: 'Erro na verificação',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao executar verificação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const healthPercentage = stats ? (stats.active / stats.total) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/admin/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Saúde das Playlists</h1>
              <p className="text-muted-foreground">
                Monitoramento de playlists M3U do SmartOne
              </p>
            </div>
          </div>
          
          <Button onClick={handleRunHealthCheck} disabled={isRunning}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Verificando...' : 'Executar Verificação'}
          </Button>
        </div>

        {/* Estatísticas Gerais */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">Playlists monitoradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ativas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.active || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.total ? Math.round((stats.active / stats.total) * 100) : 0}% do total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inativas</CardTitle>
              <XCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats?.inactive || 0}</div>
              <p className="text-xs text-muted-foreground">Verificar urgente</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Com Erro</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats?.error || 0}</div>
              <p className="text-xs text-muted-foreground">Requerem atenção</p>
            </CardContent>
          </Card>
        </div>

        {/* Saúde Geral */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Saúde Geral do Sistema</CardTitle>
            <CardDescription>
              Percentual de playlists funcionando corretamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status Geral</span>
                <Badge variant={healthPercentage >= 90 ? 'default' : healthPercentage >= 70 ? 'secondary' : 'destructive'}>
                  {healthPercentage.toFixed(1)}%
                </Badge>
              </div>
              <Progress value={healthPercentage} className="h-2" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Tempo Médio de Resposta</span>
                </div>
                <p className="text-2xl font-bold">{stats?.avgResponseTime || 0}ms</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Última Verificação</span>
                </div>
                <p className="text-sm">
                  {stats?.lastCheck
                    ? new Date(stats.lastCheck).toLocaleString('pt-BR')
                    : 'Nunca executada'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Playlists com Gerenciamento de Snooze */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Gerenciar Alertas das Playlists</CardTitle>
            <CardDescription>
              Pausar ou reativar alertas para playlists específicas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allChecks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma playlist encontrada
                </p>
              ) : (
                allChecks.map((check) => {
                  const isSnoozed = check.snoozed_until && new Date(check.snoozed_until) > new Date();
                  const statusIcon = check.status === 'active' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : check.status === 'inactive' ? (
                    <XCircle className="h-5 w-5 text-orange-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  );

                  return (
                    <div key={check.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          {statusIcon}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">{check.playlist_id}</p>
                              {isSnoozed && (
                                <Badge variant="secondary" className="text-xs">
                                  <BellOff className="h-3 w-3 mr-1" />
                                  Pausado
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{check.m3u_url}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Última verificação: {new Date(check.last_checked_at).toLocaleString('pt-BR')}
                            </p>
                            {isSnoozed && check.snoozed_until && (
                              <p className="text-xs text-orange-600 mt-1">
                                Alertas pausados até: {new Date(check.snoozed_until).toLocaleString('pt-BR')}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isSnoozed ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnsnooze(check.playlist_id)}
                            >
                              <Bell className="h-4 w-4 mr-1" />
                              Reativar Alertas
                            </Button>
                          ) : (
                            <Select onValueChange={(value) => handleSnooze(check.playlist_id, parseInt(value))}>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Pausar alertas" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">Por 1 hora</SelectItem>
                                <SelectItem value="4">Por 4 horas</SelectItem>
                                <SelectItem value="12">Por 12 horas</SelectItem>
                                <SelectItem value="24">Por 24 horas</SelectItem>
                                <SelectItem value="72">Por 3 dias</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Informações */}
        <Card>
          <CardHeader>
            <CardTitle>Sobre o Monitoramento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Como Funciona</h3>
              <p className="text-sm text-muted-foreground">
                O sistema verifica periodicamente se as URLs das playlists M3U estão respondendo corretamente.
                Cada verificação registra o tempo de resposta e o status HTTP retornado.
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-2">Status das Playlists</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span><strong>Ativa:</strong> Playlist respondendo corretamente (HTTP 200)</span>
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-orange-500" />
                  <span><strong>Inativa:</strong> URL acessível mas retornou erro HTTP</span>
                </li>
                <li className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span><strong>Erro:</strong> Não foi possível acessar a URL (timeout, rede, etc)</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium mb-2">Gerenciamento de Alertas</h3>
              <p className="text-sm text-muted-foreground">
                Você pode pausar alertas de playlists específicas por um período determinado. Durante o snooze,
                o sistema continuará monitorando as playlists, mas não enviará notificações. Os alertas são
                reativados automaticamente após o período escolhido.
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-2">Verificação Automática</h3>
              <p className="text-sm text-muted-foreground">
                O sistema executa verificações automáticas a cada hora. Você também pode executar
                verificações manuais clicando no botão "Executar Verificação" acima.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
