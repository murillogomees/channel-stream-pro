import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, LogOut, Palette, Edit3, Users, AlertCircle, Clock, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { useClientes } from "@/hooks/useClientes";

const AdminDashboard = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAuthenticated, loading, logout } = useLocalAuth();
  const { getStats } = useClientes();
  const stats = getStats();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/admin/login');
    }
  }, [isAuthenticated, loading, navigate]);

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
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gradient-primary">Painel Administrativo</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClearCache} title="Limpar todo o cache do navegador">
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar Cache
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        <div className="mb-8">
          {/* Site Customization */}
          <Card className="bg-gradient-card border-border cursor-pointer hover:shadow-lg transition-smooth w-full"
                onClick={() => navigate('/admin/customize')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
              <div className="md:col-span-1">
                <div className="flex items-center gap-3 mb-3">
                  <Palette className="h-6 w-6 text-primary" />
                  <h3 className="text-xl font-bold">Personalizar Site</h3>
                </div>
                <p className="text-muted-foreground">
                  Edite cores, fontes, logotipos, textos e todos os elementos visuais da página inicial
                </p>
              </div>
              
              <div className="md:col-span-1 flex items-center justify-center">
                <div className="flex items-center gap-4">
                  <Edit3 className="h-12 w-12 text-primary/60" />
                  <div>
                    <p className="font-semibold text-lg">Customização Completa</p>
                    <p className="text-sm text-muted-foreground">
                      Interface intuitiva e fácil
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="md:col-span-1 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
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
        </div>

        {/* Client Stats */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
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
        <div className="mt-8">
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle>Resumo do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-card rounded-lg border">
                  <p className="text-2xl font-bold text-primary">100%</p>
                  <p className="text-sm text-muted-foreground">Sistema Online</p>
                </div>
                <div className="text-center p-4 bg-card rounded-lg border">
                  <p className="text-2xl font-bold text-primary">24h</p>
                  <p className="text-sm text-muted-foreground">Uptime</p>
                </div>
                <div className="text-center p-4 bg-card rounded-lg border">
                  <p className="text-2xl font-bold text-primary">Ativo</p>
                  <p className="text-sm text-muted-foreground">Status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cache Management Info */}
        <div className="mt-8">
          <Card className="bg-gradient-card border-border border-yellow-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-yellow-500" />
                Gerenciamento de Cache
              </CardTitle>
              <CardDescription>
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