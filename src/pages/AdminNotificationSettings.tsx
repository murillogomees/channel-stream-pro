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
      </div>
    </div>
  );
};

export default AdminNotificationSettings;
