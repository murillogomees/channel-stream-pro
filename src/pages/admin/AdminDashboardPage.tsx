/**
 * AdminDashboardPage - Dashboard principal do admin
 * Rota: /admin/dashboard
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminShell } from "@/components/admin/AdminShell";
import { QuickShortcuts } from "@/components/admin/QuickShortcuts";
import { RecentActivities } from "@/components/admin/RecentActivities";
import { StatCardSkeleton } from "@/components/admin/CardSkeleton";
import {
  Users, Bell, Shield, BarChart3, Clock, AlertTriangle,
  UserCog, Tv, Play, Download, MessageSquare, Cog,
  ListVideo, Sparkles, LayoutDashboard, CreditCard, 
  PanelTop, GitBranch, HardDrive, Zap, Settings2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { getStats, loading: statsLoading } = useClientesDb();
  const stats = getStats();

  return (
    <AdminShell 
      title="Dashboard Administrativo"
      description="Visão geral do sistema"
      backTo="/"
    >
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
            path="/admin/integracao"
            isNew
            isHighlighted
          />
          <NavCard
            title="Instalação do App"
            description="Guia de instalação para dispositivos"
            icon={<Download className="h-5 w-5" />}
            path="/app/install"
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
            title="Clientes"
            description="Lista, cadastro e gestão de clientes"
            icon={<Users className="h-5 w-5" />}
            path="/admin/clientes"
            badge="Hub"
          />
          <NavCard
            title="Gestão M3U"
            description="Listas, sync, builder, VOD e relatórios"
            icon={<ListVideo className="h-5 w-5" />}
            path="/admin/m3u"
            badge="Hub"
          />
          <NavCard
            title="Usuários & Permissões"
            description="Roles, auditoria e controle de acesso"
            icon={<UserCog className="h-5 w-5" />}
            path="/admin/usuarios"
            badge="Hub"
          />
        </div>
      </section>

      <Separator className="my-8" />

      {/* Notificações & Comunicação */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Notificações & Comunicação</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <NavCard
            title="Notificações"
            description="Central de notificações, templates e automáticas"
            icon={<Bell className="h-5 w-5" />}
            path="/admin/notificacoes"
            badge="Hub"
          />
        </div>
      </section>

      <Separator className="my-8" />

      {/* Segurança */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Segurança</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <NavCard
            title="Centro de Segurança"
            description="Alertas, monitor, IP blocking e 2FA"
            icon={<Shield className="h-5 w-5" />}
            path="/admin/seguranca"
            badge="Hub"
          />
        </div>
      </section>

      <Separator className="my-8" />

      {/* Sistema */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Cog className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Sistema</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <NavCard
            title="Configurações do Sistema"
            description="Saúde, backup, customização e variáveis"
            icon={<Settings2 className="h-5 w-5" />}
            path="/admin/sistema"
            badge="Hub"
          />
        </div>
      </section>

      <Separator className="my-8" />

      {/* Analytics */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Analytics & Performance</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <NavCard
            title="Analytics Hub"
            description="Streaming, métricas, conversão e cupons"
            icon={<BarChart3 className="h-5 w-5" />}
            path="/admin/analytics"
            badge="Hub"
          />
        </div>
      </section>

      <Separator className="my-8" />

      {/* Integrações */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Integrações</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <NavCard
            title="Integrações"
            description="WhatsApp, SmartOne, CDN, Transcode"
            icon={<GitBranch className="h-5 w-5" />}
            path="/admin/integracao"
            badge="Hub"
          />
        </div>
      </section>
    </AdminShell>
  );
}
