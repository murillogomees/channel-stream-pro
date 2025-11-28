import { useState, useEffect } from "react";
import { Bell, Phone, Save, Plus, Trash2, FileText, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecurityAlertTemplate, TEMPLATE_VARIABLES, EventType } from "@/types/securityAlert";
import { Badge } from "@/components/ui/badge";

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
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<AdminPhone[]>([]);
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [templates, setTemplates] = useState<SecurityAlertTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAdmin, setNewAdmin] = useState({ name: '', phone: '' });
  const [editingTemplate, setEditingTemplate] = useState<SecurityAlertTemplate | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    
    // Real-time updates para templates e configurações
    const templatesChannel = supabase
      .channel('security-alerts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'security_alert_templates'
        },
        () => {
          console.log('[SecurityAlerts] Templates alterados');
          fetchTemplates();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'security_alert_config'
        },
        () => {
          console.log('[SecurityAlerts] Configurações alteradas');
          fetchConfigs();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_phones'
        },
        () => {
          console.log('[SecurityAlerts] Admin phones alterados');
          fetchAdmins();
        }
      )
      .subscribe();
    
    // Atualização periódica a cada 60 segundos
    const interval = setInterval(() => {
      fetchData();
    }, 60000);
    
    return () => {
      supabase.removeChannel(templatesChannel);
      clearInterval(interval);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchAdmins(), fetchConfigs(), fetchTemplates()]);
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

    const typedData = (data || []).map(config => ({
      ...config,
      notification_channels: Array.isArray(config.notification_channels) 
        ? config.notification_channels 
        : []
    })) as AlertConfig[];

    setConfigs(typedData);
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('security_alert_templates')
      .select('*')
      .order('event_type');

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar templates",
        variant: "destructive",
      });
      return;
    }

    setTemplates(data || []);
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

  const toggleConfig = async (id: string, currentEnabled: boolean) => {
    const { error } = await supabase
      .from('security_alert_config')
      .update({ enabled: !currentEnabled })
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

  const saveTemplate = async () => {
    if (!editingTemplate) return;

    const { error } = await supabase
      .from('security_alert_templates')
      .update({
        template_name: editingTemplate.template_name,
        message_template: editingTemplate.message_template,
        enabled: editingTemplate.enabled,
      })
      .eq('id', editingTemplate.id);

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao salvar template",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sucesso",
      description: "Template atualizado com sucesso",
    });

    setEditingTemplate(null);
    fetchTemplates();
  };

  const toggleTemplate = async (id: string, currentEnabled: boolean) => {
    const { error } = await supabase
      .from('security_alert_templates')
      .update({ enabled: !currentEnabled })
      .eq('id', id);

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar template",
        variant: "destructive",
      });
      return;
    }

    fetchTemplates();
  };

  const insertVariable = (variable: string) => {
    if (!editingTemplate) return;
    
    setEditingTemplate({
      ...editingTemplate,
      message_template: editingTemplate.message_template + variable
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl overflow-x-hidden">
      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/dashboard')} className="flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold flex items-center gap-2 flex-wrap">
            <Bell className="h-5 w-5 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
            <span className="truncate">Alertas de Segurança</span>
          </h1>
        </div>
      </div>

      <Tabs defaultValue="admins" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="admins" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            <Phone className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Admins</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            <Bell className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            <FileText className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admins" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Administradores</CardTitle>
              <CardDescription>
                Números de WhatsApp que receberão alertas de segurança
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              {admins.map((admin) => (
                <div key={admin.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{admin.name}</p>
                    <p className="text-sm text-muted-foreground">{admin.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={admin.active}
                      onCheckedChange={() => toggleAdmin(admin.id, admin.active)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAdmin(admin.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Alertas</CardTitle>
              <CardDescription>
                Configure quando os alertas devem ser disparados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {configs.map((config) => (
                <div key={config.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{config.alert_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Tipo: {config.event_type}
                      </p>
                    </div>
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={() => toggleConfig(config.id, config.enabled)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <Label className="text-xs">Threshold</Label>
                      <p className="font-medium">{config.threshold} eventos</p>
                    </div>
                    <div>
                      <Label className="text-xs">Janela de Tempo</Label>
                      <p className="font-medium">{config.time_window_minutes} min</p>
                    </div>
                    <div>
                      <Label className="text-xs">Severidade</Label>
                      <p className="font-medium capitalize">{config.severity_level}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Templates de Mensagens</CardTitle>
              <CardDescription>
                Personalize as mensagens de alerta por tipo de evento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {templates.map((template) => (
                <div key={template.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{template.template_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{template.event_type}</Badge>
                        <Badge variant={template.enabled ? "default" : "secondary"}>
                          {template.enabled ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Switch
                        checked={template.enabled}
                        onCheckedChange={() => toggleTemplate(template.id, template.enabled)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingTemplate(template)}
                      >
                        Editar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {editingTemplate && (
            <Card>
              <CardHeader>
                <CardTitle>Editar Template: {editingTemplate.template_name}</CardTitle>
                <CardDescription>
                  Personalize a mensagem usando as variáveis disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Template</Label>
                  <Input
                    value={editingTemplate.template_name}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        template_name: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Variáveis Disponíveis</Label>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_VARIABLES.common.map((v) => (
                      <Button
                        key={v.var}
                        variant="outline"
                        size="sm"
                        onClick={() => insertVariable(v.var)}
                        title={v.description}
                      >
                        {v.var}
                      </Button>
                    ))}
                    {TEMPLATE_VARIABLES[editingTemplate.event_type as EventType]?.map((v) => (
                      <Button
                        key={v.var}
                        variant="outline"
                        size="sm"
                        onClick={() => insertVariable(v.var)}
                        title={v.description}
                      >
                        {v.var}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Mensagem do Template</Label>
                  <Textarea
                    value={editingTemplate.message_template}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        message_template: e.target.value,
                      })
                    }
                    rows={12}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use as variáveis acima clicando nelas para inseri-las no template
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={saveTemplate}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Template
                  </Button>
                  <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
