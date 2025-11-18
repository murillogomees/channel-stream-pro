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
import { getDesktopNotificationService } from "@/services/desktopNotificationService";
import { supabase } from "@/integrations/supabase/client";

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
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(true);
  
  const desktopService = getDesktopNotificationService();

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

  const handleToggleDesktopNotifications = async () => {
    try {
      const success = await desktopService.setEnabled(!desktopNotificationsEnabled);
      if (success) {
        setDesktopNotificationsEnabled(!desktopNotificationsEnabled);
        setNotificationPermission(desktopService.getPermission());
        toast.success(
          !desktopNotificationsEnabled 
            ? "Notificações de desktop ativadas!" 
            : "Notificações de desktop desativadas"
        );
      } else {
        toast.error("Permissão de notificações negada pelo navegador");
      }
    } catch (error) {
      console.error("Erro ao alternar notificações:", error);
      toast.error("Erro ao configurar notificações");
    }
  };

  const handleTestDesktopNotification = async () => {
    try {
      await desktopService.testNotification();
      toast.success("Notificação de teste enviada!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar notificação de teste");
    }
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
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="desktop-notifications">Ativar Notificações Desktop</Label>
                <p className="text-sm text-muted-foreground">
                  {notificationPermission === 'granted' && 'Permissão concedida'}
                  {notificationPermission === 'denied' && 'Permissão negada - verifique as configurações do navegador'}
                  {notificationPermission === 'default' && 'Clique para solicitar permissão'}
                </p>
              </div>
              <Switch
                id="desktop-notifications"
                checked={desktopNotificationsEnabled}
                onCheckedChange={handleToggleDesktopNotifications}
              />
            </div>

            {desktopNotificationsEnabled && (
              <div className="pt-4 border-t">
                <Button 
                  onClick={handleTestDesktopNotification}
                  variant="outline"
                  className="w-full"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Enviar Notificação de Teste
                </Button>
              </div>
            )}

            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium mb-2">Como funcionam:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Alertas aparecem mesmo com o dashboard fechado</li>
                <li>• Notificações para erros individuais e lotes com falhas</li>
                <li>• Clique na notificação para ir direto ao dashboard ao vivo</li>
                <li>• Funciona em segundo plano enquanto o navegador estiver aberto</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Contatos</p>
                  <p className="text-2xl font-bold">{phones.length}</p>
                </div>
                <Phone className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Contatos Ativos</p>
                  <p className="text-2xl font-bold text-green-600">{activeCount}</p>
                </div>
                <Bell className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Contatos Inativos</p>
                  <p className="text-2xl font-bold text-muted-foreground">
                    {phones.length - activeCount}
                  </p>
                </div>
                <Phone className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Adicionar Novo Número */}
        <Card>
          <CardHeader>
            <CardTitle>Adicionar Número WhatsApp</CardTitle>
            <CardDescription>
              Cadastre números que receberão alertas quando alguém preencher o formulário do tutorial
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Contato</Label>
                <Input
                  id="name"
                  placeholder="Ex: João - Atendimento"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Número WhatsApp (com DDD)</Label>
                <Input
                  id="phone"
                  placeholder="61996975924 ou 5561996975924"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleAddPhone} className="mt-4 w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Número
            </Button>
          </CardContent>
        </Card>

        {/* Lista de Números */}
        <Card>
          <CardHeader>
            <CardTitle>Números Cadastrados ({phones.length})</CardTitle>
            <CardDescription>
              Gerencie os contatos que receberão notificações
            </CardDescription>
          </CardHeader>
          <CardContent>
            {phones.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum número cadastrado ainda
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadastrado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phones.map((phone) => (
                    <TableRow key={phone.id}>
                      <TableCell className="font-medium">{phone.name}</TableCell>
                      <TableCell className="font-mono">
                        {formatPhoneDisplay(phone.phone)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={phone.active}
                            onCheckedChange={() => handleToggleActive(phone.id)}
                          />
                          <span className={phone.active ? "text-green-600" : "text-muted-foreground"}>
                            {phone.active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(phone.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(phone.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminNotificationSettings;
