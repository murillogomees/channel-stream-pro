import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Trash2, Play, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RetryQueueItem {
  id: string;
  type: string;
  recipient_phone: string;
  recipient_name: string | null;
  message_content: string;
  template_name: string | null;
  client_id: string | null;
  attempts: number;
  max_attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string;
  error_message: string | null;
  status: string;
  created_at: string;
}

export default function AdminNotificationRetry() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RetryQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [filter, setFilter] = useState<'all' | 'pending' | 'retrying' | 'exhausted'>('all');

  const loadItems = async () => {
    try {
      let query = supabase
        .from('notification_retry_queue')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao carregar itens:', error);
        toast.error('Erro ao carregar fila de retry');
        return;
      }

      setItems(data || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();

    // Realtime subscription
    const channel = supabase
      .channel('retry-queue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_retry_queue',
        },
        () => {
          loadItems();
        }
      )
      .subscribe();

    // Refresh periódico a cada 30 segundos
    const interval = setInterval(loadItems, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [filter]);

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-notification-retry-queue', {
        method: 'POST',
      });

      if (error) {
        throw error;
      }

      toast.success('Fila processada com sucesso', {
        description: data.message,
      });

      loadItems();
    } catch (error: any) {
      console.error('Erro ao processar fila:', error);
      toast.error('Erro ao processar fila', {
        description: error.message,
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryNow = async (itemId: string) => {
    try {
      // Atualizar next_retry_at para agora
      const { error } = await supabase
        .from('notification_retry_queue')
        .update({
          next_retry_at: new Date().toISOString(),
          status: 'pending',
        })
        .eq('id', itemId);

      if (error) throw error;

      toast.success('Item marcado para retry imediato');
      
      // Processar a fila
      await handleProcessQueue();
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error('Erro ao agendar retry');
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Tem certeza que deseja remover este item da fila?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('notification_retry_queue')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast.success('Item removido da fila');
      loadItems();
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error('Erro ao remover item');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pendente</Badge>;
      case 'retrying':
        return <Badge variant="secondary">Retrying</Badge>;
      case 'succeeded':
        return <Badge variant="default">Sucesso</Badge>;
      case 'exhausted':
        return <Badge variant="destructive">Esgotado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const activeItems = items.filter(i => i.status === 'pending' || i.status === 'retrying');
  const succeededItems = items.filter(i => i.status === 'succeeded');
  const exhaustedItems = items.filter(i => i.status === 'exhausted');

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
                <h1 className="text-xl font-bold">Retry Notificações</h1>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground">
                Atualizado {lastUpdate.toLocaleTimeString('pt-BR')}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={handleProcessQueue} disabled={processing || activeItems.length === 0}>
            {processing ? (
              <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Processando</>
            ) : (
              <><Play className="h-3 w-3 mr-1" />Processar</>
            )}
          </Button>
        </div>

        {/* Stats Compactas */}
        <div className="flex gap-3 flex-wrap">
          <Card className="flex-1 min-w-[140px]">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Aguardando</p>
                  <p className="text-lg font-bold">{activeItems.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1 min-w-[140px]">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Sucesso</p>
                  <p className="text-2xl font-bold text-green-600">{succeededItems.length}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Esgotados</p>
                  <p className="text-2xl font-bold text-destructive">{exhaustedItems.length}</p>
                </div>
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{items.length}</p>
                </div>
                <RefreshCw className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Todos ({items.length})
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            Pendentes
          </Button>
          <Button
            variant={filter === 'retrying' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('retrying')}
          >
            Retrying
          </Button>
          <Button
            variant={filter === 'exhausted' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('exhausted')}
          >
            Esgotados
          </Button>
        </div>

        {/* Tabela Compacta */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Cliente</TableHead>
                    <TableHead className="w-[120px]">Telefone</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[80px]">Tentativas</TableHead>
                    <TableHead className="w-[150px]">Próximo Retry</TableHead>
                    <TableHead className="text-right w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                        <p className="text-muted-foreground">Carregando...</p>
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum item na fila
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">
                          <div className="truncate">{item.recipient_name || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.template_name || item.type}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.recipient_phone}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell className="text-sm">
                          {item.attempts}/{item.max_attempts}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.next_retry_at
                            ? format(new Date(item.next_retry_at), 'dd/MM HH:mm', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRetryNow(item.id)}
                              disabled={item.status === 'succeeded' || item.status === 'exhausted'}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
