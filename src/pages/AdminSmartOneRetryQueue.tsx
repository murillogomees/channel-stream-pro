import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { smartoneRetryQueueService, SmartOneRetryQueueItem } from '@/services/smartoneRetryQueueService';
import { 
  ArrowLeft, 
  RefreshCw, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Play,
  Wifi
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminSmartOneRetryQueue() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  
  const [queue, setQueue] = useState<SmartOneRetryQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; itemId: string | null }>({
    open: false,
    itemId: null
  });
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/auth');
      return;
    }

    loadQueue();

    // Real-time subscription
    const channel = supabase
      .channel('retry-queue-page')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'smartone_sync_retry_queue'
        },
        () => {
          console.log('🔄 Retry queue updated');
          loadQueue();
        }
      )
      .subscribe();

    // Periodic refresh every 30 seconds
    const interval = setInterval(loadQueue, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [authLoading, isAdmin, navigate]);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const data = await smartoneRetryQueueService.getRetryQueue();
      setQueue(data);
      setLastUpdate(new Date());
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar fila',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      const result = await smartoneRetryQueueService.processQueue();
      
      toast({
        title: 'Fila processada',
        description: `${result.processed} itens processados: ${result.succeeded} sucesso, ${result.failed} falhas`,
      });
      
      await loadQueue();
    } catch (error: any) {
      toast({
        title: 'Erro ao processar fila',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryNow = async (id: string) => {
    try {
      await smartoneRetryQueueService.retryNow(id);
      
      toast({
        title: 'Retry iniciado',
        description: 'O item será processado em breve',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao iniciar retry',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.itemId) return;

    try {
      await smartoneRetryQueueService.removeFromQueue(deleteDialog.itemId);
      
      toast({
        title: 'Item removido',
        description: 'O item foi removido da fila de retry',
      });
      
      setDeleteDialog({ open: false, itemId: null });
      await loadQueue();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover item',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Sucesso
          </Badge>
        );
      case 'exhausted':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Esgotado
          </Badge>
        );
      case 'retrying':
        return (
          <Badge variant="secondary">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Processando
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            Desconhecido
          </Badge>
        );
    }
  };

  const getNextRetryTime = (item: SmartOneRetryQueueItem) => {
    if (!item.next_retry_at) return '-';
    
    try {
      const nextRetry = new Date(item.next_retry_at);
      const now = new Date();
      
      if (nextRetry <= now) {
        return 'Pronto';
      }
      
      return format(nextRetry, "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch (error) {
      return '-';
    }
  };

  if (loading && queue.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header Compacto */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">Retry SmartOne</h1>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground">
                Atualizado {lastUpdate.toLocaleTimeString('pt-BR')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={loadQueue} variant="outline">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              size="sm"
              onClick={handleProcessQueue}
              disabled={processing || queue.filter(q => q.status === 'pending' || q.status === 'retrying').length === 0}
            >
              <Play className={`h-4 w-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
              {processing ? 'Processando...' : 'Processar Fila'}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pendentes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-8 w-8 text-yellow-500" />
                <span className="text-3xl font-bold">
                  {queue.filter(q => q.status === 'pending').length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Processando</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <RefreshCw className="h-8 w-8 text-blue-500" />
                <span className="text-3xl font-bold">
                  {queue.filter(q => q.status === 'retrying').length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Sucesso</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <span className="text-3xl font-bold">
                  {queue.filter(q => q.status === 'succeeded').length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Esgotados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <XCircle className="h-8 w-8 text-red-500" />
                <span className="text-3xl font-bold">
                  {queue.filter(q => q.status === 'exhausted').length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Queue Table */}
        <Card>
          <CardHeader>
            <CardTitle>Itens na Fila</CardTitle>
            <CardDescription>
              Lista completa de todos os itens na fila de retry
            </CardDescription>
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum item na fila</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Cliente ID</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead>Próximo Retry</TableHead>
                    <TableHead>Último Erro</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.cliente_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.attempt_count}/{item.max_attempts}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {getNextRetryTime(item)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {item.last_error || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(item.status === 'pending' || item.status === 'exhausted') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetryNow(item.id)}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteDialog({ open: true, itemId: item.id })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover item da fila?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação removerá permanentemente este item da fila de retry. O item não será mais processado automaticamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
