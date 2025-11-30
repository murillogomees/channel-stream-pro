import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, RefreshCw, CheckCircle, XCircle, AlertCircle, Clock, Bell, BellOff, Wifi, ExternalLink, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { playlistHealthService, PlaylistHealthStats, M3UListWithHealth } from '@/services/playlistHealthService';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function AdminPlaylistHealth() {
  const { toast } = useToast();
  
  const [stats, setStats] = useState<PlaylistHealthStats | null>(null);
  const [listsWithHealth, setListsWithHealth] = useState<M3UListWithHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResults, setLastResults] = useState<any[] | null>(null);
  const [checkProgress, setCheckProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    loadData();
    
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
        () => {
          console.log('🔄 Real-time playlist health update');
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsData, listsData] = await Promise.all([
        playlistHealthService.getHealthStats(),
        playlistHealthService.getM3UListsWithHealth(),
      ]);
      setStats(statsData);
      setListsWithHealth(listsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as estatísticas.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunHealthCheck = async () => {
    setIsRunning(true);
    setLastResults(null);
    setCheckProgress({ current: 0, total: listsWithHealth.length });
    
    try {
      // Simular progresso inicial
      const progressInterval = setInterval(() => {
        setCheckProgress(prev => {
          if (!prev || prev.current >= prev.total) return prev;
          return { ...prev, current: Math.min(prev.current + 1, prev.total) };
        });
      }, 500);

      const result = await playlistHealthService.runHealthCheck();
      
      clearInterval(progressInterval);
      setCheckProgress({ current: listsWithHealth.length, total: listsWithHealth.length });
      
      if (result.success) {
        toast({
          title: '✅ Verificação concluída',
          description: result.message,
        });
        
        if (result.results) {
          setLastResults(result.results);
        }
        
        // Recarregar dados imediatamente
        await loadData();
        
        // Forçar re-render após pequeno delay para garantir atualização visual
        setTimeout(() => {
          loadData();
        }, 500);
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
      setTimeout(() => setCheckProgress(null), 1000);
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
        await loadData();
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
        await loadData();
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

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'inactive':
        return <XCircle className="h-5 w-5 text-orange-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Ativa</Badge>;
      case 'inactive':
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">Inativa</Badge>;
      case 'error':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Erro</Badge>;
      default:
        return <Badge variant="secondary">Não verificada</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const healthPercentage = stats && stats.total > 0 ? (stats.active / stats.total) * 100 : 0;

  return (
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-2xl font-bold truncate">Saúde das Listas M3U</h2>
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
            Monitoramento e verificação das listas M3U do sistema
          </p>
        </div>
          
        <Button onClick={handleRunHealthCheck} disabled={isRunning} size="lg" className="w-full sm:w-auto flex-shrink-0">
          <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Verificando...' : 'Verificar Todas'}
        </Button>
      </div>

      {/* Barra de Progresso durante verificação */}
      {isRunning && checkProgress && (
        <Card className="border-primary/50 bg-primary/5 animate-pulse">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Verificando playlists...</span>
                  <span className="text-muted-foreground">
                    {checkProgress.current} / {checkProgress.total}
                  </span>
                </div>
                <Progress 
                  value={(checkProgress.current / checkProgress.total) * 100} 
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className={isRunning ? 'animate-pulse opacity-75' : 'transition-all duration-300'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Listas</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold transition-all duration-500">{listsWithHealth.length}</div>
            <p className="text-xs text-muted-foreground">Listas M3U cadastradas</p>
          </CardContent>
        </Card>

        <Card className={isRunning ? 'animate-pulse opacity-75' : 'transition-all duration-300'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativas</CardTitle>
            <CheckCircle className={`h-4 w-4 text-green-500 ${isRunning ? 'animate-spin' : ''}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 transition-all duration-500">{stats?.active || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.total ? Math.round((stats.active / stats.total) * 100) : 0}% do total verificado
            </p>
          </CardContent>
        </Card>

        <Card className={isRunning ? 'animate-pulse opacity-75' : 'transition-all duration-300'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inativas</CardTitle>
            <XCircle className={`h-4 w-4 text-orange-500 ${isRunning ? 'animate-spin' : ''}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 transition-all duration-500">{stats?.inactive || 0}</div>
            <p className="text-xs text-muted-foreground">Verificar urgente</p>
          </CardContent>
        </Card>

        <Card className={isRunning ? 'animate-pulse opacity-75' : 'transition-all duration-300'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Erro</CardTitle>
            <AlertCircle className={`h-4 w-4 text-red-500 ${isRunning ? 'animate-spin' : ''}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 transition-all duration-500">{stats?.error || 0}</div>
            <p className="text-xs text-muted-foreground">Requerem atenção</p>
          </CardContent>
        </Card>
      </div>

      {/* Saúde Geral */}
      <Card>
        <CardHeader>
          <CardTitle>Saúde Geral do Sistema</CardTitle>
          <CardDescription>
            Percentual de listas M3U funcionando corretamente
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

      {/* Resultados da Última Verificação */}
      {lastResults && lastResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados da Verificação</CardTitle>
            <CardDescription>
              Detalhes da última verificação executada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lista</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Canais</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lastResults.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{result.name}</TableCell>
                    <TableCell>{getStatusBadge(result.status)}</TableCell>
                    <TableCell>{result.responseTime}ms</TableCell>
                    <TableCell>{result.channels ?? '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {result.error || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Lista de Playlists M3U */}
      <Card>
        <CardHeader>
          <CardTitle>Listas M3U Cadastradas</CardTitle>
          <CardDescription>
            Status de saúde de cada lista M3U do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {listsWithHealth.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma lista M3U cadastrada
              </p>
            ) : (
              listsWithHealth.map((list) => {
                const isSnoozed = list.lastCheck?.snoozed_until && 
                  new Date(list.lastCheck.snoozed_until) > new Date();

                return (
                  <div key={list.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        {getStatusIcon(list.lastCheck?.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-medium">{list.name}</p>
                            {getStatusBadge(list.lastCheck?.status)}
                            {isSnoozed && (
                              <Badge variant="secondary" className="text-xs">
                                <BellOff className="h-3 w-3 mr-1" />
                                Pausado
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate max-w-md">
                            {list.file_url}
                          </p>
                          {list.lastCheck && (
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>
                                Última verificação: {new Date(list.lastCheck.last_checked_at).toLocaleString('pt-BR')}
                              </span>
                              {list.lastCheck.response_time_ms && (
                                <span>{list.lastCheck.response_time_ms}ms</span>
                              )}
                              {list.lastCheck.error_message && (
                                <span className="text-red-500">{list.lastCheck.error_message}</span>
                              )}
                            </div>
                          )}
                          {isSnoozed && list.lastCheck?.snoozed_until && (
                            <p className="text-xs text-orange-600 mt-1">
                              Alertas pausados até: {new Date(list.lastCheck.snoozed_until).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(list.file_url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        
                        {isSnoozed ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnsnooze(list.id)}
                          >
                            <Bell className="h-4 w-4 mr-1" />
                            Reativar
                          </Button>
                        ) : (
                          <Select onValueChange={(value) => handleSnooze(list.id, parseInt(value))}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="Pausar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 hora</SelectItem>
                              <SelectItem value="4">4 horas</SelectItem>
                              <SelectItem value="12">12 horas</SelectItem>
                              <SelectItem value="24">24 horas</SelectItem>
                              <SelectItem value="72">3 dias</SelectItem>
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
              O sistema verifica se as URLs das listas M3U estão respondendo corretamente,
              conta o número de canais disponíveis e registra o tempo de resposta.
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-2">Status das Listas</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span><strong>Ativa:</strong> Lista respondendo corretamente (HTTP 200)</span>
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
            <h3 className="font-medium mb-2">Verificação Manual</h3>
            <p className="text-sm text-muted-foreground">
              Clique no botão "Executar Verificação" para verificar todas as listas M3U imediatamente.
              Os resultados serão exibidos na tabela acima.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
