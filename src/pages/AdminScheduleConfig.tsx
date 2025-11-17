import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Clock, User, Save, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminPhone {
  id: string;
  name: string;
  phone: string;
  telegram_id?: string;
  phone_sms?: string;
  notification_channels?: string[];
  schedule_enabled?: boolean;
  schedule_config?: {
    [day: string]: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
}

const DAYS_PT = {
  monday: 'Segunda-feira',
  tuesday: 'Terça-feira',
  wednesday: 'Quarta-feira',
  thursday: 'Quinta-feira',
  friday: 'Sexta-feira',
  saturday: 'Sábado',
  sunday: 'Domingo'
};

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'sms', label: 'SMS' }
];

export default function AdminScheduleConfig() {
  const [admins, setAdmins] = useState<AdminPhone[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminPhone | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_phones')
        .select('*')
        .order('name');

      if (error) throw error;
      setAdmins((data || []).map(admin => ({
        ...admin,
        notification_channels: (admin.notification_channels as string[]) || ['whatsapp'],
        schedule_config: admin.schedule_config as AdminPhone['schedule_config']
      })));
    } catch (error) {
      console.error('Erro ao buscar admins:', error);
      toast.error('Erro ao carregar admins');
    } finally {
      setLoading(false);
    }
  };

  const updateAdmin = async (admin: AdminPhone) => {
    try {
      const { error } = await supabase
        .from('admin_phones')
        .update({
          telegram_id: admin.telegram_id,
          phone_sms: admin.phone_sms,
          notification_channels: admin.notification_channels,
          schedule_enabled: admin.schedule_enabled,
          schedule_config: admin.schedule_config
        })
        .eq('id', admin.id);

      if (error) throw error;

      toast.success('Admin atualizado com sucesso');
      await fetchAdmins();
    } catch (error) {
      console.error('Erro ao atualizar admin:', error);
      toast.error('Erro ao atualizar admin');
    }
  };

  const toggleDaySchedule = (day: string, enabled: boolean) => {
    if (!selectedAdmin?.schedule_config) return;

    const updated = {
      ...selectedAdmin,
      schedule_config: {
        ...selectedAdmin.schedule_config,
        [day]: {
          ...selectedAdmin.schedule_config[day],
          enabled
        }
      }
    };

    setSelectedAdmin(updated);
  };

  const updateDayTime = (day: string, field: 'start' | 'end', value: string) => {
    if (!selectedAdmin?.schedule_config) return;

    const updated = {
      ...selectedAdmin,
      schedule_config: {
        ...selectedAdmin.schedule_config,
        [day]: {
          ...selectedAdmin.schedule_config[day],
          [field]: value
        }
      }
    };

    setSelectedAdmin(updated);
  };

  const toggleChannel = (channel: string) => {
    if (!selectedAdmin) return;

    const channels = selectedAdmin.notification_channels || [];
    const updated = {
      ...selectedAdmin,
      notification_channels: channels.includes(channel)
        ? channels.filter(c => c !== channel)
        : [...channels, channel]
    };

    setSelectedAdmin(updated);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Sistema de Plantão</h1>
          <p className="text-muted-foreground">
            Configure horários e canais de notificação para cada administrador
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lista de Admins */}
        <Card>
          <CardHeader>
            <CardTitle>Administradores</CardTitle>
            <CardDescription>Selecione um admin para configurar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {admins.map(admin => (
              <Button
                key={admin.id}
                variant={selectedAdmin?.id === admin.id ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => setSelectedAdmin(admin)}
              >
                <User className="mr-2 h-4 w-4" />
                {admin.name}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Configuração */}
        {selectedAdmin && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Configurar {selectedAdmin.name}</CardTitle>
              <CardDescription>Horários e canais de notificação</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="channels">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="channels">Canais</TabsTrigger>
                  <TabsTrigger value="schedule">Horários</TabsTrigger>
                </TabsList>

                <TabsContent value="channels" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label>Canais de Notificação</Label>
                      <div className="space-y-2 mt-2">
                        {CHANNELS.map(channel => (
                          <div key={channel.value} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={selectedAdmin.notification_channels?.includes(channel.value)}
                                onCheckedChange={() => toggleChannel(channel.value)}
                              />
                              <Label>{channel.label}</Label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedAdmin.notification_channels?.includes('telegram') && (
                      <div>
                        <Label htmlFor="telegram_id">ID do Telegram</Label>
                        <Input
                          id="telegram_id"
                          value={selectedAdmin.telegram_id || ''}
                          onChange={(e) => setSelectedAdmin({...selectedAdmin, telegram_id: e.target.value})}
                          placeholder="@username ou ID numérico"
                        />
                      </div>
                    )}

                    {selectedAdmin.notification_channels?.includes('sms') && (
                      <div>
                        <Label htmlFor="phone_sms">Telefone SMS (E.164)</Label>
                        <Input
                          id="phone_sms"
                          value={selectedAdmin.phone_sms || ''}
                          onChange={(e) => setSelectedAdmin({...selectedAdmin, phone_sms: e.target.value})}
                          placeholder="+5511999999999"
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="schedule" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Ativar Sistema de Plantão</Label>
                    <Switch
                      checked={selectedAdmin.schedule_enabled}
                      onCheckedChange={(checked) => setSelectedAdmin({...selectedAdmin, schedule_enabled: checked})}
                    />
                  </div>

                  {selectedAdmin.schedule_enabled && selectedAdmin.schedule_config && (
                    <div className="space-y-3">
                      {Object.entries(DAYS_PT).map(([dayKey, dayLabel]) => {
                        const daySchedule = selectedAdmin.schedule_config![dayKey];
                        return (
                          <div key={dayKey} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="font-medium">{dayLabel}</Label>
                              <Switch
                                checked={daySchedule.enabled}
                                onCheckedChange={(checked) => toggleDaySchedule(dayKey, checked)}
                              />
                            </div>

                            {daySchedule.enabled && (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">Início</Label>
                                  <Input
                                    type="time"
                                    value={daySchedule.start}
                                    onChange={(e) => updateDayTime(dayKey, 'start', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Fim</Label>
                                  <Input
                                    type="time"
                                    value={daySchedule.end}
                                    onChange={(e) => updateDayTime(dayKey, 'end', e.target.value)}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="mt-6 flex justify-end">
                <Button onClick={() => updateAdmin(selectedAdmin)}>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}