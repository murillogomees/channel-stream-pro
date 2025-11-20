import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/admin/GlobalSearch";
import { QuickShortcuts } from "@/components/admin/QuickShortcuts";
import { RecentActivities } from "@/components/admin/RecentActivities";
import { StatCardSkeleton } from "@/components/admin/CardSkeleton";
import {
  Users, Bell, Shield, BarChart3, Settings, 
  LogOut, User, Package, Clock, AlertTriangle,
  Plug, UserCog, ArrowLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useClientesDb } from "@/hooks/useClientesDb";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface QuickStatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant?: "default" | "success" | "warning" | "danger";
}

const QuickStat = ({ icon, label, value, variant = "default" }: QuickStatProps) => {
  const variantClasses = {
    default: "bg-primary/10 text-primary",
    success: "bg-green-500/10 text-green-600 dark:text-green-500",
    warning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500",
    danger: "bg-red-500/10 text-red-600 dark:text-red-500",
  };

  return (
    <Card className="animate-fade-in">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg transition-transform duration-300 hover:scale-110 ${variantClasses[variant]}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface NavCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  badge?: string;
}

const NavCard = ({ title, description, icon, path, badge }: NavCardProps) => {
  const navigate = useNavigate();

  return (
    <Card 
      className="hover:shadow-lg transition-all duration-300 cursor-pointer group animate-scale-in hover:border-primary/50" 
      onClick={() => navigate(path)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 group-hover:scale-110">
            {icon}
          </div>
          {badge && (
            <Badge variant="secondary" className="animate-fade-in">{badge}</Badge>
          )}
        </div>
        <CardTitle className="text-lg mt-4 group-hover:text-primary transition-colors">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
};

const AdminDashboard = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, loading, signOut: logout, user } = useAuth();
  const { getStats, loading: statsLoading } = useClientesDb();
  const stats = getStats();

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão de administrador.",
        variant: "destructive",
      });
      navigate('/login');
    }
  }, [isAdmin, loading, navigate, toast]);

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-card/95">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="hover:bg-primary/10"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Dashboard Administrativo</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Bem-vindo de volta, {user?.email?.split('@')[0] || 'Admin'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <GlobalSearch />
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/perfil')}>
                <User className="h-4 w-4 mr-2" />
                Perfil
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Quick Stats & Shortcuts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-4">
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Visão Geral
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {statsLoading ? (
                  <>
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                  </>
                ) : (
                  <>
                    <QuickStat
                      icon={<Users className="h-5 w-5" />}
                      label="Total de Clientes"
                      value={stats.total}
                    />
                    <QuickStat
                      icon={<Clock className="h-5 w-5" />}
                      label="Vencendo em 5 dias"
                      value={stats.vencendoProximos5Dias}
                      variant="warning"
                    />
                    <QuickStat
                      icon={<AlertTriangle className="h-5 w-5" />}
                      label="Ativos Vencidos"
                      value={stats.ativosVencidos}
                      variant="danger"
                    />
                  </>
                )}
              </div>
            </section>
            
            <QuickShortcuts />
          </div>

          <div className="lg:col-span-1">
            <RecentActivities />
          </div>
        </div>

        <Separator className="my-8" />

        {/* Gestão de Clientes */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Gestão de Clientes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NavCard
              title="Lista de Clientes"
              description="Visualize e gerencie todos os clientes"
              icon={<Users className="h-5 w-5" />}
              path="/admin/clientes"
            />
            <NavCard
              title="Novo Cliente"
              description="Cadastre um novo cliente no sistema"
              icon={<User className="h-5 w-5" />}
              path="/admin/clientes/novo"
            />
            <NavCard
              title="Gestão M3U"
              description="Gerencie playlists, canais e VOD"
              icon={<Package className="h-5 w-5" />}
              path="/admin/m3u"
              badge="Consolidado"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Sistema de Notificações */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Sistema de Notificações</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <NavCard
              title="Notificações"
              description="Histórico, templates, automáticas e configurações"
              icon={<Bell className="h-5 w-5" />}
              path="/admin/notifications"
              badge="Consolidado"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Segurança & Monitoramento */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Segurança & Monitoramento</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <NavCard
              title="Centro de Segurança"
              description="Alertas, monitoramento, IP blocking e 2FA"
              icon={<Shield className="h-5 w-5" />}
              path="/admin/security"
              badge="Consolidado"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Analytics & Conversão */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Analytics & Conversão</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <NavCard
              title="Analytics Hub"
              description="Métricas gerais, conversão e cupons"
              icon={<BarChart3 className="h-5 w-5" />}
              path="/admin/analytics"
              badge="Consolidado"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Sistema & Configurações */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Sistema & Configurações</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <NavCard
              title="Configurações do Sistema"
              description="Saúde, playlist, backup, customização e variáveis"
              icon={<Settings className="h-5 w-5" />}
              path="/admin/system"
              badge="Consolidado"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Integrações */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Plug className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Integrações Externas</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <NavCard
              title="SmartOne IPTV"
              description="Sincronização e testes de conectividade"
              icon={<Plug className="h-5 w-5" />}
              path="/admin/integrations"
              badge="Consolidado"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Usuários & Permissões */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <UserCog className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Usuários & Permissões</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <NavCard
              title="Gestão de Usuários"
              description="Roles, auditoria, leaderboard e agenda"
              icon={<UserCog className="h-5 w-5" />}
              path="/admin/users"
              badge="Consolidado"
            />
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminDashboard;
