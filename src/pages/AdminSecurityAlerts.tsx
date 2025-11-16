import { useState, useEffect } from "react";
import { Bell, Phone, Save, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AdminPhone {
  id: string;
  name: string;
  phone: string;
  active: boolean;
}

interface AlertConfig {
  id: string;
  alert_name: string;
  event_type: string;
  threshold: number;
  time_window_minutes: number;
  severity_level: string;
  enabled: boolean;
  notification_channels: string[];
}

export default function AdminSecurityAlerts() {
  const [admins, setAdmins] = useState<AdminPhone[]>([]);
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAdmin, setNewAdmin] = useState({ name: '', phone: '' });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchAdmins(), fetchConfigs()]);
    setLoading(false);
  };

  const fetchAdmins = async () => {
    const { data, error } = await supabase
      .from('admin_phones')
      .select('*')
      .order('name');

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar admins",
        variant: "destructive",
      });
      return;
    }

    setAdmins(data || []);
  };

  const fetchConfigs = async () => {
    const { data, error } = await supabase
      .from('security_alert_config')
      .select('*')
      .order('event_type');

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar configurações",
        variant: "destructive",
      });
      return;
    }

    // Cast notification_channels from Json to string[]
    const typedData = (data || []).map(config => ({
      ...config,
      notification_channels: Array.isArray(config.notification_channels) 
        ? config.notification_channels 
        : []
    })) as AlertConfig[];

    setConfigs(typedData);
  };

  const addAdmin = async () => {
    if (!newAdmin.name || !newAdmin.phone) {
      toast({
        title: "Erro",
        description: "Preencha nome e telefone",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('admin_phones')
      .insert([{ ...newAdmin, active: true }]);

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao adicionar admin",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sucesso",
      description: "Admin adicionado com sucesso",
    });

    setNewAdmin({ name: '', phone: '' });
    fetchAdmins();
  };

  const toggleAdmin = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('admin_phones')
      .update({ active: !currentActive })
      .eq('id', id);

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar admin",
        variant: "destructive",
      });
      return;
    }

    fetchAdmins();
  };

  const deleteAdmin = async (id: string) => {
    const { error } = await supabase
      .from('admin_phones')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao remover admin",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sucesso",
      description: "Admin removido",
    });

    fetchAdmins();
  };

  const updateConfig = async (id: string, updates: Partial<AlertConfig>) => {
    const { error } = await supabase
      .from('security_alert_config')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar configuração",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sucesso",
      description: "Configuração atualizada",
    });

    fetchConfigs();
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      failed_login: 'Login Falhou',
      permission_change: 'Mudança de Permissão',
      suspicious_activity: 'Atividade Suspeita',
      rate_limit_exceeded: 'Limite Excedido',
      unauthorized_access: 'Acesso Não Autorizado'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bell className="h-8 w-8" />
          Alertas de Segurança WhatsApp
        </h1>
        <p className="text-muted-foreground">
          Configure notificações automáticas para eventos críticos de segurança
        </p>
      </div>

      {/* Admins para Notificação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Administradores
          </CardTitle>
          <CardDescription>
            Números de WhatsApp que receberão alertas de segurança
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new admin */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Nome do admin"
                value={newAdmin.name}
                onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
              />
            </div>
            <div className="flex-1">
              <Input
                placeholder="Telefone (5561999999999)"
                value={newAdmin.phone}
                onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
              />
            </div>
            <Button onClick={addAdmin}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* Admin list */}
          <div className="space-y-2">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={admin.active}
                    onCheckedChange={() => toggleAdmin(admin.id, admin.active)}
                  />
                  <div>
                    <p className="font-medium">{admin.name}</p>
                    <p className="text-sm text-muted-foreground">{admin.phone}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteAdmin(admin.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {admins.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Nenhum admin cadastrado
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alert Configurations */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Alertas</CardTitle>
          <CardDescription>
            Configure quando e como os alertas devem ser disparados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {configs.map((config) => (
            <div
              key={config.id}
              className="p-4 border rounded-lg space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{config.alert_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {getEventTypeLabel(config.event_type)}
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) =>
                    updateConfig(config.id, { enabled: checked })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Limite de Eventos</Label>
                  <Input
                    type="number"
                    value={config.threshold}
                    onChange={(e) =>
                      updateConfig(config.id, { threshold: parseInt(e.target.value) })
                    }
                    disabled={!config.enabled}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Número de eventos para disparar alerta
                  </p>
                </div>

                <div>
                  <Label>Janela de Tempo (minutos)</Label>
                  <Input
                    type="number"
                    value={config.time_window_minutes}
                    onChange={(e) =>
                      updateConfig(config.id, {
                        time_window_minutes: parseInt(e.target.value)
                      })
                    }
                    disabled={!config.enabled}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Período para contar eventos
                  </p>
                </div>
              </div>

              <div>
                <Label>Severidade</Label>
                <Select
                  value={config.severity_level}
                  onValueChange={(value) =>
                    updateConfig(config.id, { severity_level: value })
                  }
                  disabled={!config.enabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}

          {configs.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Nenhuma configuração encontrada
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
