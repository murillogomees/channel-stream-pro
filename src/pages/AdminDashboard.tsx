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
  CreditCard, PanelTop
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
  const { getStats, loading: statsLoading } = useClientesDb();
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

        {/* IPTV Player - DESTACADO */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/70 text-primary-foreground px-3 py-1 rounded-full">
              <Tv className="h-5 w-5" />
              <h2 className="text-lg font-semibold">IPTV Player</h2>
              <Badge className="bg-white/20 text-white hover:bg-white/30">Novo</Badge>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NavCard
              title="Player IPTV"
              description="Assista canais ao vivo, filmes e séries"
              icon={<Play className="h-5 w-5" />}
              path="/app/player"
              isNew
              isHighlighted
            />
            <NavCard
              title="Teste de IPTV"
              description="Teste streams e debug de canais"
              icon={<Tv className="h-5 w-5" />}
              path="/admin/iptv-test"
              isNew
              isHighlighted
            />
            <NavCard
              title="Instalação do App"
              description="Guia de instalação para dispositivos"
              icon={<Download className="h-5 w-5" />}
              path="/install"
              isNew
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Gestão de Clientes */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Gestão de Clientes</h2>
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
              title="Gestão M3U"
              description="Gerencie playlists, canais e VOD"
              icon={<ListVideo className="h-5 w-5" />}
              path="/admin/m3u"
              badge="Consolidado"
            />
            <NavCard
              title="M3U Builder"
              description="Construtor personalizado de listas M3U"
              icon={<Hammer className="h-5 w-5" />}
              path="/admin/m3u-builder"
            />
            <NavCard
              title="Histórico de Importação"
              description="Veja o histórico de importações M3U"
              icon={<History className="h-5 w-5" />}
              path="/admin/m3u-import-history"
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

        <Separator className="my-8" />

        {/* Usuários & Permissões */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <UserCog className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Usuários & Permissões</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <NavCard
              title="Gestão de Usuários"
              description="Roles, auditoria e permissões"
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
