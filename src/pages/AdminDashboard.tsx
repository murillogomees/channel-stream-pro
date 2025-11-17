import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/admin/GlobalSearch";
import { QuickShortcuts } from "@/components/admin/QuickShortcuts";
import { RecentActivities } from "@/components/admin/RecentActivities";
import { ContrastToggle } from "@/components/admin/ContrastToggle";
import {
  Users, Bell, Smartphone, Shield, BarChart3, Settings, 
  LogOut, User, Palette, FileText, Variable, MessageSquare,
  Radio, PieChart, Activity, Lock, UserCog, Package, 
  ListChecks, TrendingUp, Clock, Zap, Database, AlertTriangle,
  CheckCircle, XCircle, Timer, Target
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useClientes } from "@/hooks/useClientes";
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
      className="hover:shadow-lg transition-all duration-300 cursor-pointer group animate-scale-in" 
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
  const { getStats } = useClientes();
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
          <Activity className="h-8 w-8 animate-spin mx-auto text-primary" />
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
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard Administrativo</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Bem-vindo de volta, {user?.email?.split('@')[0] || 'Admin'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <GlobalSearch />
              <ContrastToggle />
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
          <div className="lg:col-span-2 space-y-6">
            <section>
              <h2 className="text-lg font-semibold mb-4">Visão Geral</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              </div>
            </section>
            
            <QuickShortcuts />
          </div>

          <div className="lg:col-span-1">
            <RecentActivities />
          </div>
        </div>

        {/* Gestão de Clientes */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Gestão de Clientes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <NavCard
              title="Lista de Clientes"
              description="Visualize e gerencie todos os clientes cadastrados"
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
              title="Listas M3U"
              description="Configure playlists M3U por plano"
              icon={<Package className="h-5 w-5" />}
              path="/admin/m3u-lists"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <NavCard
              title="Configurações"
              description="Configure credenciais e horários de envio"
              icon={<Settings className="h-5 w-5" />}
              path="/admin/notification-settings"
            />
            <NavCard
              title="Templates"
              description="Gerencie templates de mensagens"
              icon={<FileText className="h-5 w-5" />}
              path="/admin/templates"
            />
            <NavCard
              title="Notificações Automáticas"
              description="Configure regras de envio automático"
              icon={<Zap className="h-5 w-5" />}
              path="/admin/auto-notifications"
              badge="Novo"
            />
            <NavCard
              title="Histórico"
              description="Visualize o histórico de envios"
              icon={<MessageSquare className="h-5 w-5" />}
              path="/admin/notificacoes"
            />
            <NavCard
              title="Estatísticas"
              description="Análise de performance de envios"
              icon={<BarChart3 className="h-5 w-5" />}
              path="/admin/notification-stats"
            />
            <NavCard
              title="Fila de Retry"
              description="Mensagens aguardando reenvio"
              icon={<Clock className="h-5 w-5" />}
              path="/admin/notification-retry"
            />
            <NavCard
              title="Monitor ao Vivo"
              description="Acompanhe envios em tempo real"
              icon={<Radio className="h-5 w-5" />}
              path="/admin/notification-live"
            />
            <NavCard
              title="Alertas"
              description="Configure alertas de falhas"
              icon={<AlertTriangle className="h-5 w-5" />}
              path="/admin/notification-alerts"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* SmartOne */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Integração SmartOne</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <NavCard
              title="Configuração"
              description="Configure e teste a API SmartOne"
              icon={<Settings className="h-5 w-5" />}
              path="/admin/smartone-config"
            />
            <NavCard
              title="Sincronização"
              description="Sincronize clientes com SmartOne"
              icon={<Target className="h-5 w-5" />}
              path="/admin/smartone-sync"
            />
            <NavCard
              title="Saúde das Playlists"
              description="Monitore status das URLs M3U"
              icon={<Activity className="h-5 w-5" />}
              path="/admin/playlist-health"
              badge="Novo"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Segurança */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Segurança e Monitoramento</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <NavCard
              title="Monitor de Segurança"
              description="Eventos de segurança em tempo real"
              icon={<Shield className="h-5 w-5" />}
              path="/admin/security-monitor"
            />
            <NavCard
              title="Analytics de Segurança"
              description="Análise de ameaças e padrões"
              icon={<PieChart className="h-5 w-5" />}
              path="/admin/security-analytics"
            />
            <NavCard
              title="Alertas de Segurança"
              description="Configure alertas automáticos"
              icon={<Bell className="h-5 w-5" />}
              path="/admin/security-alerts"
            />
            <NavCard
              title="Escalonamento"
              description="Regras de escalonamento de alertas"
              icon={<TrendingUp className="h-5 w-5" />}
              path="/admin/security-escalation"
            />
            <NavCard
              title="Bloqueio de IPs"
              description="Gerencie IPs bloqueados"
              icon={<Lock className="h-5 w-5" />}
              path="/admin/ip-blocking"
            />
            <NavCard
              title="Estatísticas de Alertas"
              description="Performance do sistema de alertas"
              icon={<BarChart3 className="h-5 w-5" />}
              path="/admin/alert-stats"
            />
            <NavCard
              title="Timeline de Alertas"
              description="Histórico cronológico de alertas"
              icon={<Clock className="h-5 w-5" />}
              path="/admin/alert-timeline"
            />
            <NavCard
              title="Leaderboard"
              description="Ranking de performance dos admins"
              icon={<Target className="h-5 w-5" />}
              path="/admin/leaderboard"
            />
            <NavCard
              title="Status de Autenticação"
              description="Sessões ativas e histórico de logins"
              icon={<Activity className="h-5 w-5" />}
              path="/admin/auth-status"
            />
            <NavCard
              title="Auditoria de Permissões"
              description="Histórico de alterações de roles"
              icon={<Shield className="h-5 w-5" />}
              path="/admin/role-audit"
            />
            <NavCard
              title="Tentativas Suspeitas"
              description="Monitoramento de logins suspeitos"
              icon={<AlertTriangle className="h-5 w-5" />}
              path="/admin/suspicious-logins"
            />
            <NavCard
              title="Whitelist de IPs"
              description="IPs confiáveis que nunca são bloqueados"
              icon={<Shield className="h-5 w-5" />}
              path="/admin/ip-whitelist"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Sistema e Configurações */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Sistema e Configurações</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <NavCard
              title="Analytics"
              description="Métricas e análises do sistema"
              icon={<BarChart3 className="h-5 w-5" />}
              path="/admin/analytics"
            />
            <NavCard
              title="Saúde do Sistema"
              description="Status de serviços e integrações"
              icon={<Activity className="h-5 w-5" />}
              path="/admin/system-health"
            />
            <NavCard
              title="Gestão de Usuários"
              description="Controle de permissões e roles"
              icon={<UserCog className="h-5 w-5" />}
              path="/admin/user-roles"
            />
            <NavCard
              title="Agendamentos"
              description="Configure horários de alertas"
              icon={<Clock className="h-5 w-5" />}
              path="/admin/schedule-config"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Personalização */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Personalização</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <NavCard
              title="Customização"
              description="Personalize cores e aparência"
              icon={<Palette className="h-5 w-5" />}
              path="/admin/customize"
            />
            <NavCard
              title="Variáveis"
              description="Gerencie variáveis do sistema"
              icon={<Variable className="h-5 w-5" />}
              path="/admin/variables"
            />
            <NavCard
              title="Banco de Dados"
              description="Visualize estrutura do banco"
              icon={<Database className="h-5 w-5" />}
              path="/admin/permission-test"
            />
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminDashboard;
