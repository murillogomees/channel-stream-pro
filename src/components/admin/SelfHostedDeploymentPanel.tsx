import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Server, 
  Cloud, 
  Database, 
  Shield, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Play,
  Settings,
  Key,
  Rocket,
  Activity,
  Box
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  selfHostedDeploymentService,
  ServiceStatus,
  SecretsStatus,
  MigrationTableCounts
} from '@/services/selfHostedDeploymentService';

export function SelfHostedDeploymentPanel() {
  const [loading, setLoading] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [secretsStatus, setSecretsStatus] = useState<SecretsStatus | null>(null);
  const [functions, setFunctions] = useState<string[]>([]);
  const [migrationTables, setMigrationTables] = useState<MigrationTableCounts>({});
  const [coolifyServices, setCoolifyServices] = useState<any[]>([]);
  const [deploying, setDeploying] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const [status, secrets, funcs, migration, services] = await Promise.all([
        selfHostedDeploymentService.getServiceStatus(),
        selfHostedDeploymentService.checkSecretsStatus(),
        selfHostedDeploymentService.getEdgeFunctionsList(),
        selfHostedDeploymentService.getMigrationStatus(),
        selfHostedDeploymentService.getCoolifyServices(),
      ]);

      setServiceStatus(status);
      setSecretsStatus(secrets);
      setFunctions(funcs);
      setMigrationTables(migration.tables);
      setCoolifyServices(services.services);
    } catch (error) {
      console.error('Error loading status:', error);
      toast.error('Erro ao carregar status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const result = await selfHostedDeploymentService.deployFunctions();
      if (result.success) {
        toast.success('Deploy iniciado com sucesso!');
        setTimeout(loadStatus, 5000); // Reload after 5s
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Erro ao iniciar deploy');
    } finally {
      setDeploying(false);
    }
  };

  const handleRestartService = async (uuid: string, name: string) => {
    try {
      const result = await selfHostedDeploymentService.restartService(uuid);
      if (result.success) {
        toast.success(`Serviço ${name} reiniciado`);
        setTimeout(loadStatus, 3000);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Erro ao reiniciar serviço');
    }
  };

  const StatusIcon = ({ ok }: { ok: boolean }) => (
    ok ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Self-Hosted Deployment</h2>
          <p className="text-muted-foreground">
            Gerenciamento de Edge Functions no Supabase Self-Hosted via Coolify
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadStatus} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={handleDeploy} disabled={deploying}>
            <Rocket className={`h-4 w-4 mr-2 ${deploying ? 'animate-pulse' : ''}`} />
            {deploying ? 'Deploying...' : 'Deploy Functions'}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Database</span>
              </div>
              <StatusIcon ok={serviceStatus?.database ?? false} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                <span className="font-medium">Auth</span>
              </div>
              <StatusIcon ok={serviceStatus?.auth ?? false} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-purple-500" />
                <span className="font-medium">Storage</span>
              </div>
              <StatusIcon ok={serviceStatus?.storage ?? false} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="h-5 w-5 text-orange-500" />
                <span className="font-medium">Functions</span>
              </div>
              <StatusIcon ok={serviceStatus?.functions ?? false} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="functions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="functions">Edge Functions ({functions.length})</TabsTrigger>
          <TabsTrigger value="secrets">Secrets</TabsTrigger>
          <TabsTrigger value="services">Coolify Services</TabsTrigger>
          <TabsTrigger value="migration">Migration Status</TabsTrigger>
        </TabsList>

        {/* Edge Functions Tab */}
        <TabsContent value="functions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5" />
                Edge Functions
              </CardTitle>
              <CardDescription>
                {functions.length} funções disponíveis para deploy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {functions.map((fn) => (
                    <Badge 
                      key={fn} 
                      variant="outline" 
                      className="justify-start py-2 px-3 text-xs"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      {fn}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Secrets Tab */}
        <TabsContent value="secrets">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Secrets Configuration
              </CardTitle>
              <CardDescription>
                {secretsStatus?.configured ?? 0} de {secretsStatus?.total ?? 0} secrets configurados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress 
                value={secretsStatus ? (secretsStatus.configured / secretsStatus.total) * 100 : 0} 
              />

              {secretsStatus?.missing && secretsStatus.missing.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Secrets faltando:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {secretsStatus.missing.map((secret) => (
                      <Badge key={secret} variant="destructive">
                        {secret}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {secretsStatus?.all_configured && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Todos os secrets estão configurados!</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coolify Services Tab */}
        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Coolify Services
              </CardTitle>
              <CardDescription>
                Serviços gerenciados pelo Coolify
              </CardDescription>
            </CardHeader>
            <CardContent>
              {coolifyServices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum serviço encontrado ou Coolify não está acessível
                </div>
              ) : (
                <div className="space-y-3">
                  {coolifyServices.map((service: any) => (
                    <div 
                      key={service.uuid} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Activity className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium">{service.name}</p>
                          <p className="text-xs text-muted-foreground">{service.uuid}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={service.status === 'running' ? 'default' : 'secondary'}>
                          {service.status || 'unknown'}
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleRestartService(service.uuid, service.name)}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Migration Status Tab */}
        <TabsContent value="migration">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Migration Status
              </CardTitle>
              <CardDescription>
                Contagem de registros nas tabelas do self-hosted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(migrationTables).map(([table, count]) => (
                  <div key={table} className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">{table}</p>
                    <p className="text-2xl font-bold">
                      {count === -1 ? (
                        <span className="text-red-500">Erro</span>
                      ) : (
                        count.toLocaleString()
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Configuration Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Self-Hosted URL:</span>
            <code className="text-xs bg-muted px-2 py-1 rounded">
              https://supabase.iptvlink.com.br
            </code>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Coolify Dashboard:</span>
            <code className="text-xs bg-muted px-2 py-1 rounded">
              https://dashboard.iptvlink.com.br
            </code>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Edge Functions:</span>
            <span>{functions.length} disponíveis</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
