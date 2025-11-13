import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Save, Phone, Mail, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { validateBrazilianPhone } from "@/utils/phoneValidator";

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
  const [notificationEmail, setNotificationEmail] = useState("");

  // Carregar configurações do localStorage
  useEffect(() => {
    const stored = localStorage.getItem('admin_notification_settings');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setPhones(data.phones || []);
        setNotificationEmail(data.email || "");
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
      }
    }
    
    // Adicionar número padrão se não houver nenhum
    if (!stored || JSON.parse(stored).phones?.length === 0) {
      const defaultPhone: NotificationPhone = {
        id: Date.now().toString(),
        phone: "5561996975924",
        name: "Administrador Principal",
        active: true,
        createdAt: new Date().toISOString()
      };
      setPhones([defaultPhone]);
      saveToStorage([defaultPhone], "");
    }
  }, []);

  const saveToStorage = (phonesData: NotificationPhone[], email: string) => {
    localStorage.setItem('admin_notification_settings', JSON.stringify({
      phones: phonesData,
      email: email,
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
    saveToStorage(updatedPhones, notificationEmail);

    setNewPhone("");
    setNewName("");
    toast.success("Número adicionado com sucesso!");
  };

  const handleToggleActive = (id: string) => {
    const updatedPhones = phones.map(p =>
      p.id === id ? { ...p, active: !p.active } : p
    );
    setPhones(updatedPhones);
    saveToStorage(updatedPhones, notificationEmail);
    toast.success("Status atualizado!");
  };

  const handleDelete = (id: string) => {
    const updatedPhones = phones.filter(p => p.id !== id);
    setPhones(updatedPhones);
    saveToStorage(updatedPhones, notificationEmail);
    toast.success("Número removido!");
  };

  const handleSaveEmail = () => {
    if (notificationEmail && !notificationEmail.includes('@')) {
      toast.error("Digite um email válido");
      return;
    }

    saveToStorage(phones, notificationEmail);
    toast.success("Email de notificação salvo!");
  };

  const formatPhoneDisplay = (phone: string) => {
    const cleaned = phone.replace(/^55/, '');
    if (cleaned.length === 11) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
    }
    return phone;
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

        {/* Email de Notificação */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Email de Notificação</CardTitle>
            </div>
            <CardDescription>
              Email que receberá cópia das notificações importantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="admin@iptvlink.com.br"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSaveEmail}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

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
