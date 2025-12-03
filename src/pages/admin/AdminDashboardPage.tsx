/**
 * AdminDashboardPage - Dashboard principal do admin
 * Rota: /admin/dashboard
 */

import { memo, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminShell } from "@/components/admin/AdminShell";
import { QuickShortcuts } from "@/components/admin/QuickShortcuts";
import { RecentActivities } from "@/components/admin/RecentActivities";
import { StatCardSkeleton } from "@/components/admin/CardSkeleton";
import {
  Users, Bell, Shield, BarChart3, Clock, AlertTriangle,
  UserCog, Tv, Play, Download, Settings2, ListVideo,
  Sparkles, LayoutDashboard, GitBranch
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfiles } from "@/hooks/useProfiles";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface QuickStatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant?: "default" | "success" | "warning" | "danger";
}

// Memoized QuickStat to prevent unnecessary re-renders
const QuickStat = memo(({ icon, label, value, variant = "default" }: QuickStatProps) => {
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
});
QuickStat.displayName = 'QuickStat';

interface NavCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  badge?: string;
  isNew?: boolean;
  isHighlighted?: boolean;
}

// Memoized NavCard to prevent unnecessary re-renders
const NavCard = memo(({ title, description, icon, path, badge, isNew, isHighlighted }: NavCardProps) => {
  const navigate = useNavigate();
  
  const handleClick = useCallback(() => {
    navigate(path);
  }, [navigate, path]);

  return (
    <Card 
      className={`hover:shadow-lg transition-all duration-300 cursor-pointer group animate-scale-in hover:border-primary/50 relative overflow-hidden ${
        isHighlighted ? 'ring-2 ring-primary/50 bg-primary/5' : ''
      }`}
      onClick={handleClick}
    >
      {isNew && (
        <div className="absolute top-0 right-0">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            NOVO
          </div>
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={`p-3 rounded-lg transition-all duration-300 group-hover:scale-110 ${
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
});
NavCard.displayName = 'NavCard';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { getStats, loading: statsLoading } = useProfiles();
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
                    label="Total de Usuários"
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

      {/* LINHA 1: Player e Usuário */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/70 text-primary-foreground px-3 py-1 rounded-full">
            <Tv className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Player e Usuário</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <NavCard
            title="Player IPTV"
            description="Canais ao vivo, filmes e séries"
            icon={<Play className="h-5 w-5" />}
            path="/app/player"
            isNew
            isHighlighted
          />
          <NavCard
            title="M3U"
            description="Playlists e conteúdo VOD"
            icon={<ListVideo className="h-5 w-5" />}
            path="/admin/m3u"
            badge="Hub"
          />
          <NavCard
            title="Usuários & Permissões"
            description="CRUD, roles, auditoria e logs"
            icon={<UserCog className="h-5 w-5" />}
            path="/admin/usuarios"
            badge={`${stats.total} usuários`}
          />
          <NavCard
            title="Tutorial de Instalação"
            description="Guia para dispositivos"
            icon={<Download className="h-5 w-5" />}
            path="/app/install"
          />
        </div>
      </section>

      <Separator className="my-8" />

      {/* LINHA 2: Módulos Principais */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Módulos Principais</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <NavCard
            title="Notificações"
            description="Templates e automações"
            icon={<Bell className="h-5 w-5" />}
            path="/admin/notificacoes"
            badge="Hub"
          />
          <NavCard
            title="Integrações"
            description="WhatsApp, CDN, Mercado Pago"
            icon={<GitBranch className="h-5 w-5" />}
            path="/admin/integracao"
            badge="Hub"
          />
          <NavCard
            title="Analytics"
            description="Métricas e conversão"
            icon={<BarChart3 className="h-5 w-5" />}
            path="/admin/analytics"
            badge="Hub"
          />
          <NavCard
            title="Segurança"
            description="Alertas e monitor"
            icon={<Shield className="h-5 w-5" />}
            path="/admin/seguranca"
            badge="Hub"
          />
          <NavCard
            title="Sistema"
            description="Config e backup"
            icon={<Settings2 className="h-5 w-5" />}
            path="/admin/sistema"
            badge="Hub"
          />
        </div>
      </section>
    </AdminShell>
  );
}
