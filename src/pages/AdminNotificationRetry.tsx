import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Trash2, AlertCircle, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getRetryQueue } from "@/services/notificationRetryQueue";

const AdminNotificationRetry = () => {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, byType: {}, highAttempts: 0 });
  const retryQueue = getRetryQueue();

  const loadQueue = () => {
    const currentQueue = retryQueue.getQueue();
    const currentStats = retryQueue.getStats();
    setQueue(currentQueue);
    setStats(currentStats);
  };

  useEffect(() => {
    loadQueue();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadQueue, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleRetryNow = async (id: string) => {
    try {
      toast.loading("Tentando reenviar...");
      await retryQueue.processQueue();
      loadQueue();
      toast.success("Fila processada!");
    } catch (error) {
      toast.error("Erro ao processar fila");
    }
  };

  const handleRemove = (id: string) => {
    retryQueue.remove(id);
    loadQueue();
    toast.success("Notificação removida da fila");
  };

  const handleClearAll = () => {
    if (confirm("Tem certeza que deseja limpar toda a fila de retry?")) {
      retryQueue.clearQueue();
      loadQueue();
      toast.success("Fila limpa com sucesso");
    }
  };

  const formatNextAttempt = (nextAttempt: string) => {
    const next = new Date(nextAttempt);
    const now = new Date();
    const diff = next.getTime() - now.getTime();
    
    if (diff <= 0) {
      return "Pronto para enviar";
    }
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `Em ${hours}h ${minutes % 60}min`;
    }
    return `Em ${minutes} minutos`;
  };

  const getAttemptColor = (attempts: number, maxAttempts: number) => {
    const ratio = attempts / maxAttempts;
    if (ratio < 0.5) return "text-green-600";
    if (ratio < 0.8) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Fila de Retry de Notificações</h1>
            <p className="text-muted-foreground">
              Gerenciamento automático de notificações falhadas
            </p>
          </div>
          <Button onClick={() => retryQueue.processQueue()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Processar Agora
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total na Fila</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Clock className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Boas-vindas</p>
                  <p className="text-2xl font-bold">{stats.byType.prospect_welcome || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Notif. Admin</p>
                  <p className="text-2xl font-bold">{stats.byType.admin_notification || 0}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Informação sobre o sistema */}
        <Card>
          <CardHeader>
            <CardTitle>Como Funciona o Sistema de Retry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• As notificações são automaticamente adicionadas à fila quando falham</p>
            <p>• O sistema tenta reenviar a cada 2 minutos com backoff exponencial</p>
            <p>• Máximo de 5 tentativas por notificação</p>
            <p>• Após 5 tentativas sem sucesso, a notificação é removida automaticamente</p>
          </CardContent>
        </Card>

        {/* Lista de Notificações */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Notificações Pendentes ({queue.length})</CardTitle>
                <CardDescription>
                  Notificações aguardando reenvio automático
                </CardDescription>
              </div>
              {queue.length > 0 && (
                <Button variant="destructive" onClick={handleClearAll} size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Tudo
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-medium">Nenhuma notificação na fila</p>
                <p className="text-sm text-muted-foreground">
                  Todas as notificações foram enviadas com sucesso!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Próxima Tentativa</TableHead>
                      <TableHead>Último Erro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant={item.type === 'prospect_welcome' ? 'default' : 'secondary'}>
                            {item.type === 'prospect_welcome' ? 'Boas-vindas' : 'Admin'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.recipient.name || 'Sem nome'}</p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {item.recipient.phone}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={getAttemptColor(item.attempts, item.maxAttempts)}>
                            {item.attempts}/{item.maxAttempts}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {formatNextAttempt(item.nextAttempt)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm">
                          {item.error || 'Nenhum erro registrado'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemove(item.id)}
                            title="Remover da fila"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminNotificationRetry;
