import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  Server,
  Database,
  RefreshCw,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  HardDrive,
  Activity,
  Shield,
  Loader2,
  FileArchive
} from 'lucide-react';
import { SupabaseInstance, InstanceBackup, AuditLog, useSupabaseInstances } from '@/hooks/useSupabaseInstances';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface InstanceDashboardProps {
  instance: SupabaseInstance;
  onBack: () => void;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '-';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Pendente' },
  active: { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Ativo' },
  error: { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Erro' },
  inactive: { icon: AlertCircle, color: 'text-gray-500', bgColor: 'bg-gray-500/10', label: 'Inativo' },
  running: { icon: Activity, color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'Executando' },
  completed: { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Concluído' },
  failed: { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Falhou' },
};

export function InstanceDashboard({ instance, onBack }: InstanceDashboardProps) {
  const { testConnection, getBackups, getAuditLogs, triggerBackup } = useSupabaseInstances();
  const [backups, setBackups] = useState<InstanceBackup[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    loadData();
  }, [instance.id]);

  const loadData = async () => {
    setLoading(true);
    const [backupsData, logsData] = await Promise.all([
      getBackups(instance.id),
      getAuditLogs(instance.id),
    ]);
    setBackups(backupsData);
    setAuditLogs(logsData);
    setLoading(false);
  };

  const handleTest = async () => {
    setTesting(true);
    const result = await testConnection(instance.id);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    setTesting(false);
    loadData();
  };

  const handleBackup = async () => {
    setBackingUp(true);
    const result = await triggerBackup(instance.id);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    setBackingUp(false);
    loadData();
  };

  const StatusIcon = statusConfig[instance.status]?.icon || AlertCircle;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Server className="h-6 w-6" />
            {instance.name}
          </h2>
          <p className="text-muted-foreground">{instance.supabase_url}</p>
        </div>
        <Badge 
          variant="outline" 
          className={`${statusConfig[instance.status]?.color} ${statusConfig[instance.status]?.bgColor}`}
        >
          <StatusIcon className="h-4 w-4 mr-1" />
          {statusConfig[instance.status]?.label}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tamanho DB</p>
                <p className="text-lg font-semibold">{formatBytes(instance.db_size_bytes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Último Check</p>
                <p className="text-lg font-semibold">
                  {instance.last_health_check 
                    ? formatDistanceToNow(new Date(instance.last_health_check), { addSuffix: true, locale: ptBR })
                    : 'Nunca'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <HardDrive className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">PostgreSQL</p>
                <p className="text-lg font-semibold">{instance.postgres_version || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <FileArchive className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Último Backup</p>
                <p className="text-lg font-semibold">
                  {instance.last_backup 
                    ? formatDistanceToNow(new Date(instance.last_backup), { addSuffix: true, locale: ptBR })
                    : 'Nunca'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleTest} disabled={testing}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Testar Conexão
        </Button>
        <Button variant="outline" onClick={handleBackup} disabled={backingUp || !instance.pg_host}>
          {backingUp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          Iniciar Backup
        </Button>
        {!instance.pg_host && (
          <p className="text-sm text-muted-foreground self-center">
            Configure o host SSH para habilitar backups
          </p>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="backups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="backups" className="flex items-center gap-2">
            <FileArchive className="h-4 w-4" />
            Backups
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backups">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Backups</CardTitle>
              <CardDescription>
                Backups executados para esta instância
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : backups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileArchive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum backup realizado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {backups.map((backup) => {
                    const BackupIcon = statusConfig[backup.status]?.icon || Clock;
                    return (
                      <div key={backup.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <BackupIcon className={`h-5 w-5 ${statusConfig[backup.status]?.color}`} />
                          <div>
                            <p className="font-medium">
                              {format(new Date(backup.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {backup.file_path || 'Arquivo não disponível'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={statusConfig[backup.status]?.color}>
                            {statusConfig[backup.status]?.label}
                          </Badge>
                          {backup.file_size_bytes && (
                            <span className="text-sm text-muted-foreground">
                              {formatBytes(backup.file_size_bytes)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Auditoria</CardTitle>
              <CardDescription>
                Histórico de operações realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum log de auditoria</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Activity className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.action}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        {log.details && (
                          <pre className="text-xs text-muted-foreground mt-1 bg-muted/50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
