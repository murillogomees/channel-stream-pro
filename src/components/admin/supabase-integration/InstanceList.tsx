import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Server, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Database,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { SupabaseInstance } from '@/hooks/useSupabaseInstances';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface InstanceListProps {
  instances: SupabaseInstance[];
  loading: boolean;
  onTest: (id: string) => Promise<{ success: boolean; message: string }>;
  onDelete: (id: string) => Promise<boolean>;
  onRefresh: () => void;
  onSelect: (instance: SupabaseInstance) => void;
}

const statusConfig = {
  pending: { icon: Clock, color: 'bg-yellow-500', label: 'Pendente' },
  active: { icon: CheckCircle, color: 'bg-green-500', label: 'Ativo' },
  error: { icon: XCircle, color: 'bg-red-500', label: 'Erro' },
  inactive: { icon: AlertCircle, color: 'bg-gray-500', label: 'Inativo' },
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '-';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

export function InstanceList({ 
  instances, 
  loading, 
  onTest, 
  onDelete, 
  onRefresh,
  onSelect 
}: InstanceListProps) {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleTest = async (id: string) => {
    setTestingId(id);
    await onTest(id);
    setTestingId(null);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Instâncias Cadastradas
          </CardTitle>
          <CardDescription>
            {instances.length} instância(s) configurada(s)
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {loading && instances.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : instances.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma instância cadastrada</p>
            <p className="text-sm">Adicione uma instância Supabase self-hosted acima</p>
          </div>
        ) : (
          <div className="space-y-4">
            {instances.map((instance) => {
              const StatusIcon = statusConfig[instance.status]?.icon || AlertCircle;
              const statusColor = statusConfig[instance.status]?.color || 'bg-gray-500';
              const statusLabel = statusConfig[instance.status]?.label || instance.status;

              return (
                <div
                  key={instance.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${statusColor} text-white`}>
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {instance.name}
                        <Badge variant="outline" className="text-xs">
                          {statusLabel}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <a 
                          href={instance.supabase_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1"
                        >
                          {instance.supabase_url}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                        {instance.postgres_version && (
                          <span>PostgreSQL {instance.postgres_version}</span>
                        )}
                        {instance.db_size_bytes && (
                          <span>DB: {formatBytes(instance.db_size_bytes)}</span>
                        )}
                        {instance.last_health_check && (
                          <span>
                            Último check: {formatDistanceToNow(new Date(instance.last_health_check), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </span>
                        )}
                        {instance.last_backup && (
                          <span>
                            Último backup: {formatDistanceToNow(new Date(instance.last_backup), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(instance.id)}
                      disabled={testingId === instance.id}
                    >
                      {testingId === instance.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-2 hidden sm:inline">Testar</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelect(instance)}
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">Abrir</span>
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          disabled={deletingId === instance.id}
                        >
                          {deletingId === instance.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover Instância?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover a instância "{instance.name}"?
                            Esta ação não pode ser desfeita e todos os logs de auditoria serão excluídos.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(instance.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
