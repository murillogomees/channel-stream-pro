import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Plus, Trash2, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { getAlertService, AlertConfig } from "@/services/notificationAlertService";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatToBrazilianInternational } from "@/utils/phoneFormatter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AdminNotificationAlerts = () => {
  const navigate = useNavigate();
  const alertService = getAlertService();
  
  const [config, setConfig] = useState<AlertConfig>(alertService.getConfig());
  const [history, setHistory] = useState(alertService.getHistory());
  const [stats, setStats] = useState(alertService.getStats());
  
  const [addRecipientOpen, setAddRecipientOpen] = useState(false);
  const [newRecipientName, setNewRecipientName] = useState("");
  const [newRecipientPhone, setNewRecipientPhone] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setConfig(alertService.getConfig());
    setHistory(alertService.getHistory());
    setStats(alertService.getStats());
  };

  const handleUpdateConfig = (updates: Partial<AlertConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    alertService.updateConfig(newConfig);
    toast.success("Configuração atualizada!");
  };

  const handleAddRecipient = () => {
    if (!newRecipientName.trim() || !newRecipientPhone.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    const formattedPhone = formatToBrazilianInternational(newRecipientPhone);
    if (!formattedPhone) {
      toast.error("Telefone inválido");
      return;
    }

    const newRecipients = [
      ...config.recipients,
      {
        phone: formattedPhone,
        name: newRecipientName.trim(),
        active: true,
      }
    ];

    handleUpdateConfig({ recipients: newRecipients });
    setNewRecipientName("");
    setNewRecipientPhone("");
    setAddRecipientOpen(false);
    toast.success("Destinatário adicionado!");
  };

  const handleRemoveRecipient = (index: number) => {
    const newRecipients = config.recipients.filter((_, i) => i !== index);
    handleUpdateConfig({ recipients: newRecipients });
    toast.success("Destinatário removido!");
  };

  const handleToggleRecipient = (index: number) => {
    const newRecipients = [...config.recipients];
    newRecipients[index] = { ...newRecipients[index], active: !newRecipients[index].active };
    handleUpdateConfig({ recipients: newRecipients });
  };

  const handleClearHistory = () => {
    if (confirm("Tem certeza que deseja limpar o histórico de alertas?")) {
      alertService.clearHistory();
      loadData();
      toast.success("Histórico limpo!");
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Sistema de Alertas</h1>
            <p className="text-muted-foreground">
              Configure alertas automáticos para taxa de erro
            </p>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Alertas</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Bell className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Enviados</p>
                  <p className="text-2xl font-bold text-green-600">{stats.successful}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Falharam</p>
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                </div>
                <X className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taxa Média</p>
                  <p className="text-2xl font-bold">{stats.avgErrorRate.toFixed(1)}%</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações de Alerta</CardTitle>
            <CardDescription>
              Defina quando e como os alertas devem ser enviados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sistema Ativo */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enabled" className="text-base font-semibold">
                  Sistema de Alertas
                </Label>
                <p className="text-sm text-muted-foreground">
                  Ativar monitoramento e envio de alertas automáticos
                </p>
              </div>
              <Switch
                id="enabled"
                checked={config.enabled}
                onCheckedChange={(checked) => handleUpdateConfig({ enabled: checked })}
              />
            </div>

            {/* Limite de Taxa de Erro */}
            <div className="space-y-2">
              <Label htmlFor="threshold">
                Limite de Taxa de Erro (%)
              </Label>
              <Input
                id="threshold"
                type="number"
                min="1"
                max="100"
                value={config.errorRateThreshold}
                onChange={(e) => handleUpdateConfig({ errorRateThreshold: Number(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground">
                Alerta será enviado quando a taxa de erro ultrapassar este valor
              </p>
            </div>

            {/* Intervalo de Verificação */}
            <div className="space-y-2">
              <Label htmlFor="interval">
                Verificar a Cada X Notificações
              </Label>
              <Input
                id="interval"
                type="number"
                min="1"
                max="100"
                value={config.checkInterval}
                onChange={(e) => handleUpdateConfig({ checkInterval: Number(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground">
                Sistema verifica a taxa de erro após enviar este número de notificações
              </p>
            </div>

            {/* Janela de Tempo */}
            <div className="space-y-2">
              <Label htmlFor="timeWindow">
                Janela de Tempo (minutos)
              </Label>
              <Input
                id="timeWindow"
                type="number"
                min="5"
                max="1440"
                value={config.timeWindow}
                onChange={(e) => handleUpdateConfig({ timeWindow: Number(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground">
                Taxa de erro é calculada com base nas notificações enviadas neste período
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Destinatários */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Destinatários dos Alertas</CardTitle>
                <CardDescription>
                  Gerenciar telefones que receberão os alertas
                </CardDescription>
              </div>
              <Dialog open={addRecipientOpen} onOpenChange={setAddRecipientOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Destinatário</DialogTitle>
                    <DialogDescription>
                      Adicione um telefone para receber os alertas
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        value={newRecipientName}
                        onChange={(e) => setNewRecipientName(e.target.value)}
                        placeholder="Ex: João Silva"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone (com DDD)</Label>
                      <Input
                        id="phone"
                        value={newRecipientPhone}
                        onChange={(e) => setNewRecipientPhone(e.target.value)}
                        placeholder="Ex: 11999999999"
                      />
                    </div>
                    <Button onClick={handleAddRecipient} className="w-full">
                      Adicionar Destinatário
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {config.recipients.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Nenhum destinatário cadastrado
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {config.recipients.map((recipient, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={recipient.active}
                        onCheckedChange={() => handleToggleRecipient(index)}
                      />
                      <div>
                        <p className="font-medium">{recipient.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {recipient.phone}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={recipient.active ? "default" : "secondary"}>
                        {recipient.active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveRecipient(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico de Alertas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Histórico de Alertas</CardTitle>
                <CardDescription>
                  Alertas enviados pelo sistema
                </CardDescription>
              </div>
              {history.length > 0 && (
                <Button variant="outline" onClick={handleClearHistory}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Histórico
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-medium">Nenhum alerta enviado</p>
                <p className="text-sm text-muted-foreground">
                  Os alertas aparecerão aqui quando forem disparados
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Taxa de Erro</TableHead>
                      <TableHead>Estatísticas</TableHead>
                      <TableHead>Mensagens</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell>
                          {format(new Date(alert.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-red-600">
                            {alert.errorRate.toFixed(1)}%
                          </span>
                          <span className="text-sm text-muted-foreground ml-2">
                            (limite: {alert.threshold}%)
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{alert.totalErrors} erros de {alert.totalSent} enviadas</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {alert.messagesSent} de {alert.recipients.length}
                        </TableCell>
                        <TableCell>
                          <Badge variant={alert.success ? "default" : "destructive"}>
                            {alert.success ? "Sucesso" : "Falha"}
                          </Badge>
                          {alert.error && (
                            <p className="text-xs text-red-600 mt-1">{alert.error}</p>
                          )}
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

export default AdminNotificationAlerts;
