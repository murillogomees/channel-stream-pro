/**
 * AdminNotificationLogs - Registro de Envios Consolidado
 * Combina: Histórico de envios, Próximas notificações e Fila de notificações
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Search,
  Download,
  Trash2,
  History,
  ListOrdered,
  Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNotificationLogs } from '@/hooks/useNotificationLogs';
import { useProfiles } from '@/hooks/useProfiles';

interface NotificationQueueItem {
  id: string;
  recipient_phone: string;
  recipient_name?: string;
  message_content: string;
  status: string;
  attempts: number;
  scheduled_at?: string;
  sent_at?: string;
  last_attempt_at?: string;
  error_message?: string;
  metadata?: any;
  created_at: string;
}

export default function AdminNotificationLogs() {
  const { toast } = useToast();
  const { logs, stats, loading: logsLoading, refresh } = useNotificationLogs();
  const { profiles } = useProfiles();
  
  const [queueItems, setQueueItems] = useState<NotificationQueueItem[]>([]);
  const [queueStats, setQueueStats] = useState({ pending: 0, sent: 0, failed: 0, total: 0 });
  const [queueLoading, setQueueLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('historico');

  // Carregar fila de notificações
  const loadQueue = async () => {
    setQueueLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setQueueItems(data || []);
      setQueueStats({
        pending: data?.filter(n => n.status === 'pending').length || 0,
        sent: data?.filter(n => n.status === 'sent').length || 0,
        failed: data?.filter(n => n.status === 'failed').length || 0,
        total: data?.length || 0
      });
    } catch (error) {
      console.error('Erro ao carregar fila:', error);
    } finally {
      setQueueLoading(false);
    }
  };

  // Próximas notificações - clientes com vencimento próximo
  const upcomingNotifications = profiles
    .filter(p => p.data_vencimento)
    .map(p => {
      const dueDate = new Date(p.data_vencimento!);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...p, daysUntil };
    })
    .filter(p => p.daysUntil >= -7 && p.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const retryFailed = async () => {
    try {
      const { error } = await supabase
        .from('notification_queue')
        .update({ status: 'pending', attempts: 0 })
        .eq('status', 'failed');

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Notificações falhadas reenviadas para a fila',
      });

      loadQueue();
    } catch (error) {
      console.error('Erro ao reprocessar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível reprocessar as notificações',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: 'secondary', icon: Clock, text: 'Pendente', color: 'text-yellow-500' },
      sent: { variant: 'default', icon: CheckCircle, text: 'Enviado', color: 'text-green-500' },
      success: { variant: 'default', icon: CheckCircle, text: 'Sucesso', color: 'text-green-500' },
      failed: { variant: 'destructive', icon: XCircle, text: 'Falhou', color: 'text-red-500' },
      error: { variant: 'destructive', icon: XCircle, text: 'Erro', color: 'text-red-500' }
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant as any} className="gap-1">
        <Icon className={`h-3 w-3 ${config.color}`} />
        {config.text}
      </Badge>
    );
  };

  const filteredLogs = logs.filter(log =>
    log.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.telefone.includes(searchTerm)
  );

  const filteredQueue = queueItems.filter(item =>
    (item.recipient_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.recipient_phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Enviados</p>
                <h3 className="text-2xl font-bold">{stats.total24h || 0}</h3>
                <p className="text-xs text-muted-foreground">Últimas 24h</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <History className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sucesso</p>
                <h3 className="text-2xl font-bold text-green-500">{stats.success24h || 0}</h3>
                <p className="text-xs text-muted-foreground">Últimas 24h</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Na Fila</p>
                <h3 className="text-2xl font-bold text-yellow-500">{queueStats.pending}</h3>
                <p className="text-xs text-muted-foreground">Aguardando</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Erros</p>
                <h3 className="text-2xl font-bold text-red-500">{stats.errors24h || 0}</h3>
                <p className="text-xs text-muted-foreground">Últimas 24h</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadQueue(); refresh(); }} disabled={queueLoading || logsLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${queueLoading || logsLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Retry Failed Alert */}
      {queueStats.failed > 0 && (
        <Card className="p-4 bg-destructive/10 border-destructive">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              <p className="text-sm font-medium">
                {queueStats.failed} notificação(ões) falharam. Deseja tentar reenviar?
              </p>
            </div>
            <Button onClick={retryFailed} variant="destructive" size="sm">
              Reprocessar Falhas
            </Button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
            <Badge variant="secondary" className="ml-1">{filteredLogs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="proximas" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Próximas</span>
            <Badge variant="secondary" className="ml-1">{upcomingNotifications.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="fila" className="gap-2">
            <ListOrdered className="h-4 w-4" />
            <span className="hidden sm:inline">Fila</span>
            <Badge variant="secondary" className="ml-1">{filteredQueue.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Histórico */}
        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Histórico de Envios</CardTitle>
              <CardDescription>Registro de todas as notificações enviadas</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {logsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum registro encontrado</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data/Hora</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{log.clienteNome}</p>
                              <p className="text-xs text-muted-foreground">{log.telefone}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.template}</Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(log.dataEnvio), "dd/MM HH:mm", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Próximas Notificações */}
        <TabsContent value="proximas" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Próximas Notificações</CardTitle>
              <CardDescription>Clientes com vencimento nos próximos 7 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {upcomingNotifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma notificação programada</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingNotifications.map((cliente) => (
                        <TableRow key={cliente.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{cliente.nome}</p>
                              <p className="text-xs text-muted-foreground">{cliente.telefone || cliente.telefone_whatsapp}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{cliente.plano || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell>
                            {cliente.data_vencimento && format(new Date(cliente.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {cliente.daysUntil < 0 ? (
                              <Badge variant="destructive">Vencido há {Math.abs(cliente.daysUntil)} dias</Badge>
                            ) : cliente.daysUntil === 0 ? (
                              <Badge variant="destructive">Vence HOJE</Badge>
                            ) : cliente.daysUntil <= 3 ? (
                              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">
                                Vence em {cliente.daysUntil} dias
                              </Badge>
                            ) : (
                              <Badge variant="outline">Vence em {cliente.daysUntil} dias</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fila */}
        <TabsContent value="fila" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Fila de Notificações</CardTitle>
              <CardDescription>Notificações aguardando processamento</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {queueLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : filteredQueue.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListOrdered className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma notificação na fila</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredQueue.map((notif) => (
                      <div
                        key={notif.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{notif.recipient_name || 'Cliente'}</p>
                            {getStatusBadge(notif.status)}
                            {(notif.attempts || 0) > 1 && (
                              <Badge variant="outline">{notif.attempts} tentativas</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{notif.recipient_phone}</p>
                          {notif.error_message && (
                            <p className="text-sm text-destructive">Erro: {notif.error_message}</p>
                          )}
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {notif.sent_at ? (
                            <span>Enviado {format(new Date(notif.sent_at), 'HH:mm', { locale: ptBR })}</span>
                          ) : notif.scheduled_at ? (
                            <span>Agendado {format(new Date(notif.scheduled_at), 'HH:mm', { locale: ptBR })}</span>
                          ) : (
                            <span>Criado {format(new Date(notif.created_at), 'HH:mm', { locale: ptBR })}</span>
                          )}
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
