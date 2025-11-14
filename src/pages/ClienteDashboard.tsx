import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Phone, Mail, Tv, Key, Calendar, LogOut, Edit2, Check, X } from "lucide-react";
import { z } from "zod";

const updateSchema = z.object({
  telefone: z.string().trim().min(10, "Telefone inválido").regex(/^\+?[1-9]\d{1,14}$/, "Formato de telefone inválido"),
  telegram: z.string().trim().max(100).optional(),
});

interface ClienteData {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  telegram: string | null;
  mac_smart_one: string | null;
  usuario_m3u: string | null;
  senha_m3u: string | null;
  situacao: string;
  plano: string;
  data_vencimento: string | null;
  cliente_ativo: boolean;
  smartone_status: string;
  origem_cadastro: string;
}

const ClienteDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [clienteData, setClienteData] = useState<ClienteData | null>(null);
  const [formData, setFormData] = useState({
    telefone: "",
    telegram: "",
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      // Check authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast({
          title: "Acesso negado",
          description: "Faça login para acessar o dashboard",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setUser(session.user);

      // Fetch client data using RLS
      const { data: cliente, error: clienteError } = await (supabase as any)
        .from('clientes')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (clienteError) {
        console.error('[ClienteDashboard] Error fetching cliente:', clienteError);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar suas informações",
          variant: "destructive",
        });
        return;
      }

      if (!cliente) {
        toast({
          title: "Dados não encontrados",
          description: "Nenhum registro de cliente encontrado",
          variant: "destructive",
        });
        return;
      }

      setClienteData(cliente);
      setFormData({
        telefone: cliente.telefone || "",
        telegram: cliente.telegram || "",
      });
    } catch (error: any) {
      console.error('[ClienteDashboard] Error:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      setSaving(true);

      // Validate input
      const validated = updateSchema.parse(formData);

      if (!clienteData) return;

      // Update client data using RLS
      const { error: updateError } = await (supabase as any)
        .from('clientes')
        .update({
          telefone: validated.telefone,
          telegram: validated.telegram || null,
        })
        .eq('id', clienteData.id);

      if (updateError) {
        console.error('[ClienteDashboard] Update error:', updateError);
        throw new Error('Erro ao atualizar dados');
      }

      // Reload data
      await checkAuthAndLoadData();

      toast({
        title: "Dados atualizados",
        description: "Suas informações foram atualizadas com sucesso",
      });

      setEditing(false);
    } catch (error: any) {
      console.error('[ClienteDashboard] Update error:', error);
      
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao atualizar",
          description: error.message || "Tente novamente mais tarde",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso",
      });
      navigate('/');
    } catch (error: any) {
      console.error('[ClienteDashboard] Logout error:', error);
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getSituacaoBadge = (situacao: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      "Ativo": "default",
      "Testando": "secondary",
      "Inativo": "destructive",
      "Lead": "outline",
    };
    return <Badge variant={variants[situacao] || "outline"}>{situacao}</Badge>;
  };

  const getSmartOneBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      "criado": "default",
      "pendente": "secondary",
      "erro": "destructive",
      "nao_enviado": "outline",
    };
    const labels: Record<string, string> = {
      "criado": "Ativo",
      "pendente": "Pendente",
      "erro": "Erro",
      "nao_enviado": "Não Configurado",
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clienteData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Dados não encontrados</CardTitle>
            <CardDescription>Nenhum registro de cliente foi encontrado</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>Voltar ao início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard do Cliente</h1>
            <p className="text-muted-foreground">Bem-vindo, {clienteData.nome}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Status da Conta</CardTitle>
            </CardHeader>
            <CardContent>
              {getSituacaoBadge(clienteData.situacao)}
              {clienteData.cliente_ativo ? (
                <p className="text-xs text-muted-foreground mt-2">Conta ativa</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">Conta inativa</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">SmartOne IPTV</CardTitle>
            </CardHeader>
            <CardContent>
              {getSmartOneBadge(clienteData.smartone_status)}
              {clienteData.mac_smart_one && (
                <p className="text-xs text-muted-foreground mt-2">MAC configurado</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Plano Atual</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge>{clienteData.plano}</Badge>
              {clienteData.data_vencimento && (
                <p className="text-xs text-muted-foreground mt-2">
                  Vence: {new Date(clienteData.data_vencimento).toLocaleDateString('pt-BR')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informações Pessoais
                </CardTitle>
                <CardDescription>Seus dados de contato e identificação</CardDescription>
              </div>
              {!editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    setEditing(false);
                    setFormData({
                      telefone: clienteData.telefone || "",
                      telegram: clienteData.telegram || "",
                    });
                  }}>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleUpdate} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Nome Completo
                </Label>
                <Input value={clienteData.nome} disabled />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input value={clienteData.email} disabled />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  WhatsApp
                </Label>
                <Input
                  value={editing ? formData.telefone : clienteData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  disabled={!editing}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Telegram (opcional)
                </Label>
                <Input
                  value={editing ? formData.telegram : (clienteData.telegram || "")}
                  onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                  placeholder="@seuusuario"
                  disabled={!editing}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SmartOne Credentials */}
        {clienteData.smartone_status === 'criado' && (clienteData.usuario_m3u || clienteData.senha_m3u) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tv className="h-5 w-5" />
                Credenciais SmartOne IPTV
              </CardTitle>
              <CardDescription>Use estas credenciais para acessar o serviço</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {clienteData.mac_smart_one && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Tv className="h-4 w-4" />
                      MAC Address
                    </Label>
                    <Input value={clienteData.mac_smart_one} disabled />
                  </div>
                )}

                {clienteData.usuario_m3u && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Usuário M3U
                    </Label>
                    <Input value={clienteData.usuario_m3u} disabled />
                  </div>
                )}

                {clienteData.senha_m3u && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Senha M3U
                    </Label>
                    <Input type="password" value={clienteData.senha_m3u} disabled />
                  </div>
                )}
              </div>

              <Separator />

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Como usar suas credenciais:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Baixe o aplicativo SmartOne IPTV na sua Smart TV ou dispositivo</li>
                  <li>Configure usando seu MAC Address</li>
                  <li>Use as credenciais M3U para login, se solicitado</li>
                  <li>Aproveite mais de 10.000 canais em Full HD e 4K</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Informações da Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Origem do Cadastro:</span>
              <span className="font-medium">{clienteData.origem_cadastro}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email da Conta:</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ID do Cliente:</span>
              <span className="font-mono text-xs">{clienteData.id.substring(0, 8)}...</span>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle>Precisa de Ajuda?</CardTitle>
            <CardDescription>Entre em contato com nossa equipe de suporte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se você tiver dúvidas sobre sua assinatura, credenciais ou precisar de suporte técnico,
              nossa equipe está pronta para ajudar.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.open(`https://wa.me/${clienteData.telefone}`, '_blank')}>
                <Phone className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              <Button variant="outline" onClick={() => window.location.href = `mailto:suporte@iptvlink.com?subject=Suporte - Cliente ${clienteData.id.substring(0, 8)}`}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClienteDashboard;
