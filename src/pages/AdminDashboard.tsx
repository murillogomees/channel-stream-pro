import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, LogOut, Palette, Edit3, Users, AlertCircle, Clock, Trash2, MessageSquare, CheckCircle, XCircle, User, Key, Smartphone, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { useClientes } from "@/hooks/useClientes";
import { useWhatsAppConfig } from "@/hooks/useWhatsAppConfig";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AdminDashboard = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAuthenticated, loading, logout } = useLocalAuth();
  const { getStats } = useClientes();
  const stats = getStats();
  const { config, saveConfig, isConfigured } = useWhatsAppConfig();
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [appkey, setAppkey] = useState('');
  const [authkey, setAuthkey] = useState('');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/admin/login');
    }
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    setAppkey(config.appkey);
    setAuthkey(config.authkey);
  }, [config]);

  const handleSaveWhatsAppConfig = () => {
    saveConfig({ appkey, authkey, enabled: true });
    setWhatsappDialogOpen(false);
    toast({
      title: "Configuração salva",
      description: "Credenciais BotBot.chat configuradas com sucesso!",
    });
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
    navigate('/admin/login');
  };

  const handleClearCache = () => {
    try {
      // Limpar localStorage (exceto autenticação)
      const authData = localStorage.getItem('adminAuth');
      localStorage.clear();
      if (authData) {
        localStorage.setItem('adminAuth', authData);
      }

      // Limpar sessionStorage
      sessionStorage.clear();

      // Limpar cache do service worker se existir
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach(name => {
            caches.delete(name);
          });
        });
      }

      toast({
        title: "Cache limpo com sucesso",
        description: "Todos os dados em cache foram removidos. A página será recarregada.",
      });

      // Recarregar sem cache após 1 segundo
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: "Erro ao limpar cache",
        description: "Ocorreu um erro ao tentar limpar o cache.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient-primary">Painel Administrativo</h1>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => navigate('/admin/perfil')} size="sm" className="flex-1 sm:flex-none">
              <User className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Meu Perfil</span>
            </Button>
            <Button variant="outline" onClick={handleClearCache} title="Limpar todo o cache do navegador" size="sm" className="flex-1 sm:flex-none">
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Limpar Cache</span>
            </Button>
            <Button variant="outline" onClick={handleLogout} size="sm" className="flex-1 sm:flex-none">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>

        <div className="mb-6 sm:mb-8 space-y-4">
          {/* Site Customization */}
          <Card className="bg-gradient-card border-border cursor-pointer hover:shadow-lg transition-smooth w-full"
                onClick={() => navigate('/admin/customize')}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 p-4 sm:p-6">
              <div className="lg:col-span-1">
                <div className="flex items-center gap-3 mb-3">
                  <Palette className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  <h3 className="text-lg sm:text-xl font-bold">Personalizar Site</h3>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Edite cores, fontes, logotipos, textos e todos os elementos visuais da página inicial
                </p>
              </div>
              
              <div className="lg:col-span-1 flex items-center justify-center">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Edit3 className="h-10 w-10 sm:h-12 sm:w-12 text-primary/60" />
                  <div>
                    <p className="font-semibold text-base sm:text-lg">Customização Completa</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Interface intuitiva e fácil
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="lg:col-span-1 flex items-center justify-center">
                <div className="text-center space-y-2 w-full">
                  <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div className="bg-primary/10 p-2 rounded">Header</div>
                    <div className="bg-accent/10 p-2 rounded">Hero</div>
                    <div className="bg-secondary/30 p-2 rounded">Planos</div>
                    <div className="bg-muted/30 p-2 rounded">Contatos</div>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    Configure todas as seções
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* App Activation System */}
          <Card className="bg-gradient-card border-border hover:shadow-lg transition-smooth w-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 p-4 sm:p-6">
              <div className="lg:col-span-1">
                <div className="flex items-center gap-3 mb-3">
                  <Key className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                  <h3 className="text-lg sm:text-xl font-bold">Sistema de Ativação</h3>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Gerencie planos, chaves de ativação e dispositivos dos usuários
                </p>
              </div>
              
              <div className="lg:col-span-1 flex items-center justify-center">
                <div className="grid grid-cols-3 gap-3 w-full">
                  <div className="text-center">
                    <Package className="h-8 w-8 sm:h-10 sm:w-10 text-blue-500 mx-auto mb-2" />
                    <p className="text-xs font-semibold">Planos</p>
                  </div>
                  <div className="text-center">
                    <Key className="h-8 w-8 sm:h-10 sm:w-10 text-green-500 mx-auto mb-2" />
                    <p className="text-xs font-semibold">Chaves</p>
                  </div>
                  <div className="text-center">
                    <Smartphone className="h-8 w-8 sm:h-10 sm:w-10 text-purple-500 mx-auto mb-2" />
                    <p className="text-xs font-semibold">Usuários</p>
                  </div>
                </div>
              </div>
              
              <div className="lg:col-span-1 flex items-center justify-center lg:justify-end">
                <div className="flex flex-col w-full lg:w-auto gap-2">
                  <Button 
                    onClick={() => navigate('/admin/plans')} 
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Planos de Assinatura
                  </Button>
                  
                  <Button 
                    onClick={() => navigate('/admin/activation-keys')}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Chaves de Ativação
                  </Button>

                  <Button 
                    onClick={() => navigate('/admin/app-users')}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    Usuários do App
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* WhatsApp Configuration */}
          <Card className="bg-gradient-card border-border hover:shadow-lg transition-smooth w-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 p-4 sm:p-6">
              <div className="lg:col-span-1">
                <div className="flex items-center gap-3 mb-3">
                  <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                  <h3 className="text-lg sm:text-xl font-bold">WhatsApp BotBot.chat</h3>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Configure credenciais e envie notificações automáticas de pagamento
                </p>
              </div>
              
              <div className="lg:col-span-1 flex items-center justify-center">
                <div className="flex items-center gap-3 sm:gap-4">
                  {isConfigured ? (
                    <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-green-500" />
                  ) : (
                    <XCircle className="h-10 w-10 sm:h-12 sm:w-12 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-semibold text-base sm:text-lg">
                      {isConfigured ? 'Configurado' : 'Não Configurado'}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {isConfigured ? 'Sistema pronto' : 'Configure as credenciais'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="lg:col-span-1 flex items-center justify-center lg:justify-end">
                <div className="flex flex-col w-full lg:w-auto gap-2">
                  <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Settings className="h-4 w-4 mr-2" />
                        Configurar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Configurar BotBot.chat</DialogTitle>
                        <DialogDescription>
                          Insira suas credenciais da plataforma BotBot.chat
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="appkey">App Key</Label>
                          <Input
                            id="appkey"
                            value={appkey}
                            onChange={(e) => setAppkey(e.target.value)}
                            placeholder="b4153549-be4e-494d-8561-ee1912c55ee9"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="authkey">Auth Key</Label>
                          <Input
                            id="authkey"
                            value={authkey}
                            onChange={(e) => setAuthkey(e.target.value)}
                            placeholder="jFXdat4Uaq19lVnt107Yn77lRjScoV9gzcRVzw17h0RIOXK4Xl"
                          />
                        </div>
                        <Button onClick={handleSaveWhatsAppConfig} className="w-full">
                          Salvar Configuração
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    onClick={() => navigate('/admin/templates')} 
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Templates
                  </Button>
                  
                  <Button 
                    onClick={() => navigate('/admin/notificacoes')}
                    className="w-full justify-start"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Notificações
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Client Stats */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-6 sm:mb-8">
          <Card 
            className="bg-gradient-card border-border cursor-pointer hover:shadow-lg transition-smooth"
            onClick={() => navigate('/admin/clientes')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Clientes
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Clientes cadastrados no sistema
              </p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-card border-border cursor-pointer hover:shadow-lg transition-smooth"
            onClick={() => navigate('/admin/clientes')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Vencem em 5 Dias
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.vencendoProximos5Dias}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Clientes com vencimento próximo
              </p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-card border-border cursor-pointer hover:shadow-lg transition-smooth"
            onClick={() => navigate('/admin/clientes')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ativos Vencidos
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.ativosVencidos}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Clientes ativos com pagamento atrasado
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 sm:mt-8">
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Resumo do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="text-center p-3 sm:p-4 bg-card rounded-lg border">
                  <p className="text-xl sm:text-2xl font-bold text-primary">100%</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Sistema Online</p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-card rounded-lg border">
                  <p className="text-xl sm:text-2xl font-bold text-primary">24h</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Uptime</p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-card rounded-lg border">
                  <p className="text-xl sm:text-2xl font-bold text-primary">Ativo</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cache Management Info */}
        <div className="mt-6 sm:mt-8">
          <Card className="bg-gradient-card border-border border-yellow-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                Gerenciamento de Cache
              </CardTitle>
              <CardDescription className="text-sm">
                Otimize o desempenho do site gerenciando o cache do navegador
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  O botão "Limpar Cache" remove todos os dados armazenados em cache, incluindo:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                  <li>Configurações do site (localStorage)</li>
                  <li>Dados de sessão temporários (sessionStorage)</li>
                  <li>Cache do Service Worker</li>
                  <li>Imagens e recursos armazenados</li>
                </ul>
                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-3 rounded-lg">
                  <p className="text-sm font-medium">
                    ⚠️ Nota: Seus dados de autenticação serão preservados após limpar o cache.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;