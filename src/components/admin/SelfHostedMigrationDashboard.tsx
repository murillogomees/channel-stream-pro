/**
 * Self-Hosted Migration Dashboard
 * 
 * Admin interface for managing migration from Lovable Cloud to Self-Hosted Supabase
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Server, 
  Database, 
  Shield, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Play,
  Pause,
  ArrowRight,
  Cloud,
  HardDrive,
  Users,
  Key,
  Rocket
} from "lucide-react";
import { toast } from "sonner";
import { migrationService, MigrationProgress, TableMigrationResult } from '@/integrations/selfhosted';
import { useSelfHostedSupabase } from '@/hooks/useSelfHostedSupabase';

interface TableStatus {
  name: string;
  cloudCount: number;
  selfHostedCount: number;
  synced: boolean;
  exists: boolean; // Whether table exists on self-hosted
  lastSync?: Date;
}

const SelfHostedMigrationDashboard = () => {
  const { connectionStatus, isLoading: isConnectionLoading, testConnection } = useSelfHostedSupabase();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress[]>([]);
  const [migrationResults, setMigrationResults] = useState<TableMigrationResult[]>([]);
  const [tableStatuses, setTableStatuses] = useState<TableStatus[]>([]);
  const [activeTab, setActiveTab] = useState('status');

  // Core tables to display
  const coreTables = [
    'profiles',
    'user_roles',
    'notification_templates',
    'auto_notifications',
    'iptv_channels',
    'iptv_playlists',
    'subscription_plans',
    'payments',
  ];

  useEffect(() => {
    handleTestConnection();
  }, []);

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const success = await testConnection();
      if (success) {
        toast.success('Conexão com Self-Hosted estabelecida!');
        await loadTableStatuses();
      } else {
        toast.error('Falha na conexão com Self-Hosted');
      }
    } finally {
      setIsTestingConnection(false);
    }
  };

  const loadTableStatuses = async () => {
    const statuses: TableStatus[] = [];
    
    for (const table of coreTables) {
      const cloudCount = await migrationService.getCloudTableCount(table);
      const selfHostedCount = await migrationService.getSelfHostedTableCount(table);
      const exists = selfHostedCount >= 0; // -1 means table doesn't exist
      
      statuses.push({
        name: table,
        cloudCount,
        selfHostedCount: exists ? selfHostedCount : 0,
        synced: exists && cloudCount === selfHostedCount && cloudCount > 0,
        exists,
      });
    }
    
    setTableStatuses(statuses);
  };

  const handleStartMigration = async () => {
    setIsMigrating(true);
    setMigrationProgress([]);
    setMigrationResults([]);
    
    toast.info('Iniciando migração completa...');
    
    try {
      const results = await migrationService.migrateAllTables((progress) => {
        setMigrationProgress(prev => {
          const existing = prev.findIndex(p => p.table === progress.table);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = progress;
            return updated;
          }
          return [...prev, progress];
        });
      });
      
      setMigrationResults(results);
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      if (failed === 0) {
        toast.success(`Migração concluída! ${successful} tabelas migradas.`);
      } else {
        toast.warning(`Migração parcial: ${successful} sucesso, ${failed} falhas`);
      }
      
      await loadTableStatuses();
    } catch (error) {
      toast.error('Erro durante a migração');
      console.error(error);
    } finally {
      setIsMigrating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Server className="h-6 w-6" />
            Migração Self-Hosted
          </h2>
          <p className="text-muted-foreground">
            Migrar dados do Lovable Cloud para Supabase Self-Hosted
          </p>
        </div>
        <Badge 
          variant={connectionStatus.connected ? "default" : "destructive"}
          className="text-sm"
        >
          {connectionStatus.connected ? 'Conectado' : 'Desconectado'}
        </Badge>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Status da Conexão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Cloud className="h-8 w-8 text-blue-500" />
              <div>
                <p className="font-medium">Lovable Cloud</p>
                <p className="text-sm text-muted-foreground">Origem</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Server className="h-8 w-8 text-green-500" />
              <div>
                <p className="font-medium">Self-Hosted</p>
                <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {connectionStatus.url}
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <Button 
              onClick={handleTestConnection}
              disabled={isTestingConnection || isConnectionLoading}
              variant="outline"
            >
              {isTestingConnection ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="migration">Migração</TabsTrigger>
          <TabsTrigger value="auth">Auth & Roles</TabsTrigger>
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
        </TabsList>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Comparação de Tabelas
              </CardTitle>
              <CardDescription>
                Comparação de registros entre Cloud e Self-Hosted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {tableStatuses.map((table) => (
                    <div 
                      key={table.name}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        !table.exists ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {!table.exists ? (
                          <XCircle className="h-5 w-5 text-destructive" />
                        ) : table.synced ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        )}
                        <div>
                          <span className="font-medium">{table.name}</span>
                          {!table.exists && (
                            <p className="text-xs text-destructive">Tabela não existe - precisa migrar schema</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Cloud: <span className="font-medium text-foreground">{table.cloudCount}</span>
                        </span>
                        <ArrowRight className="h-4 w-4" />
                        <span className="text-muted-foreground">
                          Self-Hosted: <span className={`font-medium ${!table.exists ? 'text-destructive' : 'text-foreground'}`}>
                            {table.exists ? table.selfHostedCount : 'N/A'}
                          </span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              <div className="mt-4">
                <Button onClick={loadTableStatuses} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar Contagens
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Migration Tab */}
        <TabsContent value="migration" className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription>
              A migração irá copiar todos os dados do Lovable Cloud para o Self-Hosted.
              Certifique-se de que o Self-Hosted está acessível e configurado corretamente.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Migração Completa
              </CardTitle>
              <CardDescription>
                Migrar todas as tabelas do Cloud para Self-Hosted
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleStartMigration}
                disabled={isMigrating || !connectionStatus.connected}
                className="w-full"
              >
                {isMigrating ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Migração em Progresso...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar Migração Completa
                  </>
                )}
              </Button>

              {migrationProgress.length > 0 && (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {migrationProgress.map((progress) => (
                      <div key={progress.table} className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(progress.status)}
                            <span className="font-medium">{progress.table}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {progress.migratedRows}/{progress.totalRows}
                          </span>
                        </div>
                        <Progress 
                          value={progress.totalRows > 0 
                            ? (progress.migratedRows / progress.totalRows) * 100 
                            : 0
                          } 
                        />
                        {progress.error && (
                          <p className="text-sm text-red-500 mt-1">{progress.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auth Tab */}
        <TabsContent value="auth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Migração de Autenticação
              </CardTitle>
              <CardDescription>
                Migrar usuários, roles e perfis para Self-Hosted
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <Shield className="h-4 w-4" />
                <AlertTitle>Migração de Auth Requer Acesso Admin</AlertTitle>
                <AlertDescription>
                  A migração de auth.users requer acesso via service_role_key.
                  Esta operação deve ser executada via script no servidor.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Profiles</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Dados de perfil dos usuários
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">User Roles</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Roles (master, admin, client)
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Auth Users</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Contas de autenticação
                  </p>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Script de Migração Auth</h4>
                <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`# Execute no servidor self-hosted:
cd /opt/supabase

# Backup atual
pg_dump -U postgres -d postgres --schema=auth > auth_backup.sql

# Importar do Cloud (requer dump do Cloud primeiro)
psql -U postgres -d postgres < cloud_auth_dump.sql`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deploy Tab */}
        <TabsContent value="deploy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Deploy Edge Functions
              </CardTitle>
              <CardDescription>
                Configurar e fazer deploy das Edge Functions no Self-Hosted
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Server className="h-4 w-4" />
                <AlertTitle>Deploy via Coolify</AlertTitle>
                <AlertDescription>
                  As Edge Functions devem ser deployadas manualmente no Coolify.
                  Use os comandos abaixo para configurar.
                </AlertDescription>
              </Alert>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">1. Copiar Functions para o Servidor</h4>
                <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`# Comprimir functions
tar -czvf functions.tar.gz supabase/functions/

# Upload para o servidor
scp functions.tar.gz user@supabase.iptvlink.com.br:/tmp/

# Extrair no servidor
ssh user@supabase.iptvlink.com.br
cd /opt/supabase/docker/volumes/functions
tar -xzvf /tmp/functions.tar.gz --strip-components=2`}
                </pre>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">2. Configurar Secrets no Coolify</h4>
                <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`# Secrets necessários:
MERCADO_PAGO_ACCESS_TOKEN=xxx
WHATSAPP_APPKEY=xxx
WHATSAPP_AUTHKEY=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=xxx
R2_ACCOUNT_ID=xxx
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_STREAM_API_TOKEN=xxx
JWT_SECRET=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx`}
                </pre>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">3. Reiniciar Serviço de Functions</h4>
                <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`# Via Coolify Dashboard ou:
docker compose restart functions`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SelfHostedMigrationDashboard;
