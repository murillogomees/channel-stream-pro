import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Activity, RefreshCw, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { playlistHealthService, PlaylistHealthStats } from '@/services/playlistHealthService';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function AdminPlaylistHealth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  
  const [stats, setStats] = useState<PlaylistHealthStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/auth');
      return;
    }

    loadStats();
  }, [authLoading, isAdmin, navigate]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const data = await playlistHealthService.getHealthStats();
      setStats(data);
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
