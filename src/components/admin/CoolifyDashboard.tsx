import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Server, 
  Database, 
  Globe, 
  Activity, 
  RefreshCw, 
  Play, 
  Square, 
  RotateCcw,
  Folder,
  Box,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Key
} from 'lucide-react';
import { coolifyService, COOLIFY_ACTIONS, type CoolifyServer, type CoolifyProject, type CoolifyServiceType } from '@/services/coolifyService';
import { SSHKeyManager } from './SSHKeyManager';

interface EnvironmentData {
  servers: CoolifyServer[];
  projects: CoolifyProject[];
  services: CoolifyServiceType[];
  databases: unknown[];
  applications: unknown[];
  version: string;
  healthy: boolean;
}

export function CoolifyDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [environment, setEnvironment] = useState<EnvironmentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<Array<{
    action: string;
    status: 'success' | 'error' | 'pending';
    message: string;
    timestamp: Date;
  }>>([]);

  const addLog = (action: string, status: 'success' | 'error' | 'pending', message: string) => {
    setActionLog(prev => [{
      action,
      status,
      message,
      timestamp: new Date()
    }, ...prev.slice(0, 49)]);
  };

  const fetchEnvironment = async () => {
    setRefreshing(true);
    addLog('Reconhecimento', 'pending', 'Iniciando varredura do ambiente...');

    try {
      // Parallel fetching for efficiency
      const [
        healthRes,
        versionRes,
        serversRes,
        projectsRes,
        servicesRes,
        databasesRes,
        applicationsRes
      ] = await Promise.allSettled([
        coolifyService.getHealth(),
        coolifyService.getVersion(),
        coolifyService.listServers(),
        coolifyService.listProjects(),
        coolifyService.listServices(),
        coolifyService.listDatabases(),
        coolifyService.listApplications()
      ]);

      const env: EnvironmentData = {
        servers: serversRes.status === 'fulfilled' && serversRes.value.success ? serversRes.value.data : [],
        projects: projectsRes.status === 'fulfilled' && projectsRes.value.success ? projectsRes.value.data : [],
        services: servicesRes.status === 'fulfilled' && servicesRes.value.success ? servicesRes.value.data : [],
        databases: databasesRes.status === 'fulfilled' && databasesRes.value.success ? databasesRes.value.data : [],
        applications: applicationsRes.status === 'fulfilled' && applicationsRes.value.success ? applicationsRes.value.data : [],
        version: versionRes.status === 'fulfilled' && versionRes.value.success ? String(versionRes.value.data) : 'N/A',
        healthy: healthRes.status === 'fulfilled' && healthRes.value.success
      };

      setEnvironment(env);
      setError(null);
      addLog('Reconhecimento', 'success', `Ambiente mapeado: ${env.servers.length} servidores, ${env.projects.length} projetos, ${env.services.length} serviços`);
      toast.success('Ambiente Coolify carregado com sucesso');

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      addLog('Reconhecimento', 'error', message);
      toast.error('Falha ao conectar com Coolify');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEnvironment();
  }, []);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      running: { variant: 'default', icon: <CheckCircle2 className="w-3 h-3" /> },
      stopped: { variant: 'secondary', icon: <Square className="w-3 h-3" /> },
      error: { variant: 'destructive', icon: <XCircle className="w-3 h-3" /> },
      starting: { variant: 'outline', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    };
    const config = variants[status?.toLowerCase()] || variants.stopped;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {status || 'Unknown'}
      </Badge>
    );
  };

  // Group actions by category
  const actionsByCategory = Object.entries(COOLIFY_ACTIONS).reduce((acc, [key, value]) => {
    if (!acc[value.category]) {
      acc[value.category] = [];
    }
    acc[value.category].push({ key, ...value });
    return acc;
  }, {} as Record<string, Array<{ key: string; name: string; description: string; category: string }>>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Conectando ao Coolify...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${environment?.healthy ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <div>
            <h3 className="font-semibold">Coolify Dashboard</h3>
            <p className="text-sm text-muted-foreground">
              Versão: {environment?.version || 'N/A'} | URL: dashboard.iptvlink.com.br
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchEnvironment}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="servers">Servidores</TabsTrigger>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="ssh" className="flex items-center gap-1">
            <Key className="w-3 h-3" />
            SSH
          </TabsTrigger>
          <TabsTrigger value="actions">Ações API</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Servidores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{environment?.servers?.length || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Folder className="w-4 h-4" />
                  Projetos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{environment?.projects?.length || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Box className="w-4 h-4" />
                  Serviços
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{environment?.services?.length || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Bancos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(environment?.databases as unknown[])?.length || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Status Cards */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Projetos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {environment?.projects?.map((project) => (
                  <div key={project.uuid} className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <span className="font-medium">{project.name}</span>
                    <Badge variant="outline">{project.environments?.length || 0} envs</Badge>
                  </div>
                )) || <p className="text-muted-foreground text-sm">Nenhum projeto encontrado</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Serviços Ativos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {environment?.services?.slice(0, 5).map((service) => (
                  <div key={service.uuid} className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <span className="font-medium">{service.name}</span>
                    {getStatusBadge(service.status)}
                  </div>
                )) || <p className="text-muted-foreground text-sm">Nenhum serviço encontrado</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Servers Tab */}
        <TabsContent value="servers" className="space-y-4">
          {environment?.servers?.map((server) => (
            <Card key={server.uuid}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Server className="w-5 h-5" />
                    <div>
                      <CardTitle>{server.name}</CardTitle>
                      <CardDescription>{server.ip}:{server.port}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {server.is_reachable ? (
                      <Badge variant="default" className="bg-green-500">Alcançável</Badge>
                    ) : (
                      <Badge variant="destructive">Inacessível</Badge>
                    )}
                    {server.is_usable && (
                      <Badge variant="outline">Usável</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    coolifyService.validateServer(server.uuid).then(res => {
                      if (res.success) {
                        toast.success('Servidor validado com sucesso');
                        addLog('validate-server', 'success', `Servidor ${server.name} validado`);
                      } else {
                        toast.error('Falha na validação');
                        addLog('validate-server', 'error', `Falha ao validar ${server.name}`);
                      }
                    });
                  }}>
                    <Activity className="w-4 h-4 mr-1" />
                    Validar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    coolifyService.getServerResources(server.uuid).then(res => {
                      console.log('Server Resources:', res);
                      toast.info(`Recursos: ${JSON.stringify(res.data).slice(0, 100)}...`);
                    });
                  }}>
                    <Globe className="w-4 h-4 mr-1" />
                    Recursos
                  </Button>
                </div>
              </CardContent>
            </Card>
          )) || (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nenhum servidor encontrado
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          {environment?.services?.map((service) => (
            <Card key={service.uuid}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Box className="w-5 h-5" />
                    <div>
                      <CardTitle>{service.name}</CardTitle>
                      <CardDescription>{service.type} • {service.environment_name}</CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(service.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    coolifyService.startService(service.uuid).then(res => {
                      toast.success(res.success ? 'Serviço iniciado' : 'Falha ao iniciar');
                      addLog('start-service', res.success ? 'success' : 'error', `${service.name}`);
                    });
                  }}>
                    <Play className="w-4 h-4 mr-1" />
                    Iniciar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    coolifyService.stopService(service.uuid).then(res => {
                      toast.success(res.success ? 'Serviço parado' : 'Falha ao parar');
                      addLog('stop-service', res.success ? 'success' : 'error', `${service.name}`);
                    });
                  }}>
                    <Square className="w-4 h-4 mr-1" />
                    Parar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    coolifyService.restartService(service.uuid).then(res => {
                      toast.success(res.success ? 'Serviço reiniciado' : 'Falha ao reiniciar');
                      addLog('restart-service', res.success ? 'success' : 'error', `${service.name}`);
                    });
                  }}>
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reiniciar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )) || (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nenhum serviço encontrado
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Ações Disponíveis via API
              </CardTitle>
              <CardDescription>
                Lista completa de todas as operações que podem ser executadas no Coolify
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {Object.entries(actionsByCategory).map(([category, actions]) => (
                  <div key={category} className="mb-6">
                    <h4 className="font-semibold text-sm text-primary mb-3">{category}</h4>
                    <div className="space-y-2">
                      {actions.map(action => (
                        <div 
                          key={action.key}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div>
                            <span className="font-medium">{action.name}</span>
                            <p className="text-xs text-muted-foreground">{action.description}</p>
                          </div>
                          <code className="text-xs bg-background px-2 py-1 rounded">
                            {action.key}
                          </code>
                        </div>
                      ))}
                    </div>
                    <Separator className="mt-4" />
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SSH Tab */}
        <TabsContent value="ssh" className="space-y-4">
          <SSHKeyManager />
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Log de Ações
              </CardTitle>
              <CardDescription>
                Histórico das últimas 50 operações executadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {actionLog.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma ação registrada ainda
                  </p>
                ) : (
                  <div className="space-y-2">
                    {actionLog.map((log, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-lg ${
                          log.status === 'success' ? 'bg-green-500/10' :
                          log.status === 'error' ? 'bg-red-500/10' : 'bg-yellow-500/10'
                        }`}
                      >
                        {log.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />}
                        {log.status === 'error' && <XCircle className="w-4 h-4 text-red-500 mt-0.5" />}
                        {log.status === 'pending' && <Loader2 className="w-4 h-4 text-yellow-500 mt-0.5 animate-spin" />}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{log.action}</span>
                            <span className="text-xs text-muted-foreground">
                              {log.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{log.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
