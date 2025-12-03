import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/admin/GlobalSearch";
import { QuickShortcuts } from "@/components/admin/QuickShortcuts";
import { RecentActivities } from "@/components/admin/RecentActivities";
import { StatCardSkeleton } from "@/components/admin/CardSkeleton";
import {
  Users, Bell, Shield, BarChart3, 
  LogOut, User, Clock, AlertTriangle,
  UserCog, ArrowLeft, Tv, Play, Download,
  History, MessageSquare, Send, Cog,
  ListVideo, Hammer, Sparkles, LayoutDashboard, 
  CreditCard, PanelTop, RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/hooks/useProfiles";
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
  isNew?: boolean;
  isHighlighted?: boolean;
}

const NavCard = ({ title, description, icon, path, badge, isNew, isHighlighted }: NavCardProps) => {
  const navigate = useNavigate();

  return (
    <Card 
      className={`hover:shadow-lg transition-all duration-300 cursor-pointer group animate-scale-in hover:border-primary/50 relative overflow-hidden ${
        isHighlighted ? 'ring-2 ring-primary/50 bg-primary/5' : ''
      }`}
      onClick={() => navigate(path)}
    >
      {isNew && (
        <div className="absolute top-0 right-0">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            NOVO
          </div>
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg transition-all duration-300 group-hover:scale-110 ${
            isHighlighted 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
          }`}>
            {icon}
          </div>
          {badge && !isNew && (
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
  const { signOut: logout, user } = useAuth();
  const { getStats, loading: statsLoading } = useProfiles();
  const stats = getStats();

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-card/95">
        <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="hover:bg-primary/10 flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold truncate">Dashboard Administrativo</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">
                  Bem-vindo, {user?.email?.split('@')[0]?.charAt(0).toUpperCase() + (user?.email?.split('@')[0]?.slice(1) || '') || 'Admin'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 pl-11 sm:pl-0 overflow-x-auto">
              <GlobalSearch />
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/perfil')} className="flex-shrink-0">
                <User className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Perfil</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="flex-shrink-0">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Quick Stats & Shortcuts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
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

        {/* IPTV Player - DESTACADO */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/70 text-primary-foreground px-3 py-1 rounded-full">
              <Tv className="h-5 w-5" />
              <h2 className="text-lg font-semibold">IPTV Player</h2>
              <Badge className="bg-white/20 text-white hover:bg-white/30">Novo</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <NavCard
              title="Player IPTV"
              description="Canais ao vivo, filmes e séries"
              icon={<Play className="h-4 w-4" />}
              path="/app/player"
              isNew
              isHighlighted
            />
            <NavCard
              title="Instalação"
              description="Guia para dispositivos"
              icon={<Download className="h-4 w-4" />}
              path="/app/install"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Gestão de Clientes & Usuários */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Gestão de Clientes & Usuários</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              title="Usuários & Permissões"
              description="Gestão completa de usuários, roles, auditoria e acessos"
              icon={<Users className="h-5 w-5" />}
              path="/admin/usuarios"
              badge="Consolidado"
            />
            <NavCard
              title="Gestão M3U & Playlists"
              description="Listas, sincronização, builder, VOD e relatórios"
              icon={<ListVideo className="h-5 w-5" />}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <NavCard
              title="Centro de Notificações"
              description="Histórico, templates e automáticas"
              icon={<Bell className="h-5 w-5" />}
              path="/admin/notifications"
              badge="Consolidado"
            />
            <NavCard
              title="Fila de Notificações"
              description="Gerencie a fila de envios pendentes"
              icon={<Send className="h-5 w-5" />}
              path="/admin/notification-queue"
            />
            <NavCard
              title="Config WhatsApp"
              description="Configure a integração com WhatsApp"
              icon={<MessageSquare className="h-5 w-5" />}
              path="/admin/whatsapp-config"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Gestão do Site & Sistema */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <PanelTop className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Gestão do Site & Sistema</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <NavCard
              title="Editor da Homepage"
              description="Edite textos e elementos da página inicial"
              icon={<LayoutDashboard className="h-5 w-5" />}
              path="/dashboard/homepage"
              isNew
            />
            <NavCard
              title="Gestão de Planos"
              description="Crie e gerencie os planos de assinatura"
              icon={<CreditCard className="h-5 w-5" />}
              path="/dashboard/plans"
              isNew
            />
            <NavCard
              title="Configurações do Sistema"
              description="Saúde, playlist, backup e customização"
              icon={<Cog className="h-5 w-5" />}
              path="/admin/system"
              badge="Consolidado"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Analytics & Segurança */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Analytics & Segurança</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <NavCard
              title="Analytics Hub"
              description="Métricas gerais, conversão e cupons"
              icon={<BarChart3 className="h-5 w-5" />}
              path="/admin/analytics"
              badge="Consolidado"
            />
            <NavCard
              title="Centro de Segurança"
              description="Alertas, monitoramento, IP blocking e 2FA"
              icon={<Shield className="h-5 w-5" />}
              path="/admin/security"
              badge="Consolidado"
            />
          </div>
        </section>

      </main>
    </div>
  );
};

export default AdminDashboard;
