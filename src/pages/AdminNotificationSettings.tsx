import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Phone, Bell, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { validateBrazilianPhone } from "@/utils/phoneValidator";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppConfig } from "@/hooks/useWhatsAppConfig";
import { activityLogService } from "@/services/activityLogService";

interface NotificationPhone {
  id: string;
  phone: string;
  name: string;
  active: boolean;
  createdAt: string;
}

const AdminNotificationSettings = () => {
  const navigate = useNavigate();
  const [phones, setPhones] = useState<NotificationPhone[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(true);
  
  // WhatsApp config para alertas de vencimento
  const { config, saveConfig } = useWhatsAppConfig();
  const [newAdminPhone, setNewAdminPhone] = useState("");

  // Carregar configurações e setup realtime
  useEffect(() => {
    loadPhones();
    
    // Supabase Realtime subscription
    const channel = supabase
      .channel('admin_phones_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_phones'
        },
        () => {
          loadPhones();
          setLastUpdate(new Date());
        }
      )
      .subscribe();

    // Refresh periódico a cada 30 segundos
    const interval = setInterval(() => {
      loadPhones();
      setLastUpdate(new Date());
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const loadPhones = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_phones')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setPhones(data.map(p => ({
          id: p.id,
          phone: p.phone,
          name: p.name,
          active: p.active || false,
          createdAt: p.created_at || new Date().toISOString()
        })));
      }
    } catch (error) {
      console.error('Erro ao carregar telefones:', error);
      toast.error('Erro ao carregar telefones de notificação');
    }
  };

  const saveToStorage = (phonesData: NotificationPhone[]) => {
    localStorage.setItem('admin_notification_settings', JSON.stringify({
      phones: phonesData,
      updatedAt: new Date().toISOString()
    }));
  };

  const handleAddPhone = () => {
    if (!newPhone.trim()) {
      toast.error("Digite um número de telefone");
      return;
    }

    if (!newName.trim()) {
      toast.error("Digite um nome para identificar este contato");
      return;
    }

    const validation = validateBrazilianPhone(newPhone);
    if (!validation.isValid) {
      toast.error(`Número inválido: ${validation.error}`);
      return;
    }

    const phoneExists = phones.some(p => p.phone === validation.formatted);
    if (phoneExists) {
      toast.error("Este número já está cadastrado");
      return;
    }

    const newPhoneData: NotificationPhone = {
      id: Date.now().toString(),
      phone: validation.formatted || newPhone,
      name: newName,
      active: true,
      createdAt: new Date().toISOString()
    };

    const updatedPhones = [...phones, newPhoneData];
    setPhones(updatedPhones);
    saveToStorage(updatedPhones);

    setNewPhone("");
    setNewName("");
    toast.success("Número adicionado com sucesso!");
  };

  const handleToggleActive = (id: string) => {
    const updatedPhones = phones.map(p =>
      p.id === id ? { ...p, active: !p.active } : p
    );
    setPhones(updatedPhones);
    saveToStorage(updatedPhones);
    toast.success("Status atualizado!");
  };

  const handleDelete = (id: string) => {
    const updatedPhones = phones.filter(p => p.id !== id);
    setPhones(updatedPhones);
    saveToStorage(updatedPhones);
    toast.success("Número removido!");
  };

  const formatPhoneDisplay = (phone: string) => {
    const cleaned = phone.replace(/^55/, '');
    if (cleaned.length === 11) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
    }
    return phone;
  };

  const handleAddAdminPhone = async () => {
    if (!newAdminPhone.trim()) {
      toast.error("Digite um número de telefone");
      return;
    }

    const validation = validateBrazilianPhone(newAdminPhone);
    if (!validation.isValid) {
      toast.error(`Número inválido: ${validation.error}`);
      return;
    }

    const formatted = validation.formatted || newAdminPhone;
    const adminPhones = config.adminPhones || [];

    if (adminPhones.includes(formatted)) {
      toast.error("Este número já está cadastrado");
      return;
    }

    saveConfig({
      adminPhones: [...adminPhones, formatted]
    });

    // Registrar atividade
    await activityLogService.logActivity(
      'config_updated',
      `Telefone de administrador adicionado: ${formatted}`,
      'configuracao',
      undefined,
      { tipo: 'admin_phone_added', telefone: formatted }
    );

    setNewAdminPhone("");
    toast.success("Telefone de administrador adicionado!");
  };

  const handleRemoveAdminPhone = async (phone: string) => {
    const adminPhones = config.adminPhones || [];
    saveConfig({
      adminPhones: adminPhones.filter(p => p !== phone)
    });
    
    // Registrar atividade
    await activityLogService.logActivity(
      'config_updated',
      `Telefone de administrador removido: ${phone}`,
      'configuracao',
      undefined,
      { tipo: 'admin_phone_removed', telefone: phone }
    );
    
    toast.success("Telefone removido!");
  };

  const activeCount = phones.filter(p => p.active).length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Configurações de Notificações</h1>
            <p className="text-muted-foreground">
              Gerencie quem receberá alertas sobre novos cadastros
            </p>
          </div>
        </div>

        {/* Notificações Desktop */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Notificações de Desktop
            </CardTitle>
            <CardDescription>
              Receba alertas no desktop quando erros críticos ocorrerem, mesmo com o dashboard fechado
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Alertas de Vencimento para Administradores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alertas de Vencimento - Administradores
            </CardTitle>
            <CardDescription>
              Configure telefones de administradores que receberão alertas via WhatsApp quando clientes tiverem assinaturas vencidas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Formulário para adicionar novo telefone */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="admin-phone">Telefone do Administrador</Label>
                <Input
                  id="admin-phone"
                  type="tel"
                  placeholder="(61) 99999-9999"
                  value={newAdminPhone}
                  onChange={(e) => setNewAdminPhone(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddAdminPhone();
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleAddAdminPhone}
                className="mt-6"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>

            {/* Lista de telefones cadastrados */}
            {config.adminPhones && config.adminPhones.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {config.adminPhones.map((phone) => (
                      <TableRow key={phone}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono">{formatPhoneDisplay(phone)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAdminPhone(phone)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum telefone de administrador cadastrado</p>
                <p className="text-sm mt-1">Adicione telefones para receber alertas de vencimento</p>
              </div>
            )}

            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Como funciona:</strong> Quando a assinatura de um cliente vencer (dia 0 ou após), 
                todos os administradores cadastrados acima receberão automaticamente uma mensagem via WhatsApp 
                com os detalhes do cliente e alerta de vencimento.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Configuração de Notificações Automáticas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações Automáticas de Vencimento
            </CardTitle>
            <CardDescription>
              Configure o envio automático de lembretes de vencimento para clientes via WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label className="text-base font-medium">Ativar Envio Automático</Label>
                <p className="text-sm text-muted-foreground">
                  Envia automaticamente mensagens para clientes nos dias configurados antes do vencimento
                </p>
              </div>
              <Switch
                checked={config.autoSendEnabled}
                onCheckedChange={async (checked) => {
                  try {
                    await saveConfig({ autoSendEnabled: checked });
                    
                    // Registrar atividade
                    await activityLogService.logActivity(
                      'notification_config_updated',
                      `Envio automático ${checked ? 'ativado' : 'desativado'}`,
                      'config',
                      'auto_notifications'
                    );
                    
                    toast.success(
                      checked 
                        ? 'Envio automático ativado com sucesso!' 
                        : 'Envio automático desativado'
                    );
                  } catch (error) {
                    toast.error('Erro ao atualizar configuração');
                  }
                }}
              />
            </div>

            {config.autoSendEnabled && (
              <>
                <div className="space-y-2">
                  <Label>Horário de Envio</Label>
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={config.sendHour}
                    onChange={async (e) => {
                      const hour = parseInt(e.target.value);
                      if (hour >= 0 && hour <= 23) {
                        try {
                          await saveConfig({ sendHour: hour });
                          await activityLogService.logActivity(
                            'notification_config_updated',
                            `Horário de envio alterado para ${hour}:00`,
                            'config',
                            'auto_notifications'
                          );
                          toast.success('Horário atualizado com sucesso!');
                        } catch (error) {
                          toast.error('Erro ao atualizar horário');
                        }
                      }
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    Mensagens serão enviadas diariamente às {config.sendHour}:00
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Dias Antes do Vencimento</Label>
                  <div className="flex flex-wrap gap-2">
                    {[0, 1, 2, 3, 5, 7, 10, 15].map((day) => (
                      <button
                        key={day}
                        onClick={async () => {
                          const currentDays = config.daysToNotify || [];
                          const newDays = currentDays.includes(day)
                            ? currentDays.filter(d => d !== day)
                            : [...currentDays, day].sort((a, b) => a - b);
                          
                          try {
                            await saveConfig({ daysToNotify: newDays });
                            await activityLogService.logActivity(
                              'notification_config_updated',
                              `Dias de notificação atualizados: ${newDays.join(', ')}`,
                              'config',
                              'auto_notifications'
                            );
                            toast.success('Dias de notificação atualizados!');
                          } catch (error) {
                            toast.error('Erro ao atualizar dias');
                          }
                        }}
                        className={`px-4 py-2 rounded-md border transition-colors ${
                          (config.daysToNotify || []).includes(day)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-accent'
                        }`}
                      >
                        {day === 0 ? 'Hoje' : `${day} dia${day > 1 ? 's' : ''}`}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {config.daysToNotify && config.daysToNotify.length > 0 
                      ? `Lembretes serão enviados ${config.daysToNotify.map(d => 
                          d === 0 ? 'no dia do vencimento' : `${d} dia${d > 1 ? 's' : ''} antes`
                        ).join(', ')}`
                      : 'Selecione ao menos um dia para enviar lembretes'}
                  </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex gap-2">
                    <Bell className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Sistema Ativo</p>
                      <p className="text-sm text-muted-foreground">
                        O sistema está configurado e enviará automaticamente lembretes de vencimento 
                        para seus clientes nos dias selecionados, sempre às {config.sendHour}:00.
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Certifique-se de que os <strong>templates de WhatsApp</strong> estão configurados 
                        corretamente na aba "Templates" para cada dia de notificação.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!config.autoSendEnabled && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Ative o envio automático para que o sistema envie lembretes de vencimento 
                  para seus clientes nos dias que você configurar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminNotificationSettings;
