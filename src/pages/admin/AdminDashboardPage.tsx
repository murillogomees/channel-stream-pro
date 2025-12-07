/**
 * AdminDashboardPage - Dashboard principal do admin
 * Rota: /admin/dashboard
 * Redesign com hierarquia visual clara, tokens semânticos e cards componentizados
 */

import { memo } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { QuickShortcuts } from "@/components/admin/QuickShortcuts";
import { RecentActivities } from "@/components/admin/RecentActivities";
import { StatCardSkeleton } from "@/components/admin/CardSkeleton";
import { StatCard, NavCard, SectionHeader } from "@/components/admin/dashboard";
import { Separator } from "@/components/ui/separator";
import {
  Users, Bell, Shield, BarChart3, Clock, AlertTriangle,
  UserCog, Tv, Play, Download, Settings2, ListVideo,
  LayoutDashboard, GitBranch, Zap, TrendingUp, Rocket
} from "lucide-react";
import { useProfiles } from "@/hooks/useProfiles";

export default function AdminDashboardPage() {
  const { getStats, loading: statsLoading } = useProfiles();
  const stats = getStats();

  return (
    <AdminShell 
      title="Dashboard Administrativo"
      description="Visão geral do sistema e métricas principais"
      backTo="/"
    >
      {/* Stats Overview Section */}
      <section className="mb-8">
        <SectionHeader
          icon={<TrendingUp />}
          title="Métricas Principais"
          variant="primary"
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                icon={<Users className="h-5 w-5" />}
                label="Total de Usuários"
                value={stats.total}
                variant="default"
                subtitle={`${stats.emTeste} em teste`}
              />
              <StatCard
                icon={<Zap className="h-5 w-5" />}
                label="Usuários Ativos"
                value={stats.ativos}
                variant="success"
                subtitle="Com assinatura em dia"
              />
              <StatCard
                icon={<Clock className="h-5 w-5" />}
                label="Vencendo em 5 dias"
                value={stats.vencendoProximos5Dias}
                variant="warning"
                subtitle="Requer atenção"
              />
              <StatCard
                icon={<AlertTriangle className="h-5 w-5" />}
                label="Vencidos"
                value={stats.vencidos}
                variant="danger"
                subtitle={`${stats.inativos} inativos`}
              />
            </>
          )}
        </div>
      </section>

      {/* Quick Shortcuts & Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <QuickShortcuts />
        </div>
        <div className="lg:col-span-1">
          <RecentActivities />
        </div>
      </div>

      <Separator className="my-8" />

      {/* Player & User Section */}
      <section className="mb-8">
        <SectionHeader
          icon={<Tv />}
          title="Player e Usuário"
          variant="gradient"
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            variant="accent"
          />
          <NavCard
            title="Usuários & Permissões"
            description="CRUD, roles, auditoria, afiliados e logs"
            icon={<UserCog className="h-5 w-5" />}
            path="/admin/usuarios"
            badge={`${stats.total} usuários`}
            variant="info"
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

      {/* Main Modules Section */}
      <section className="mb-8">
        <SectionHeader
          icon={<LayoutDashboard />}
          title="Módulos Principais"
          variant="default"
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <NavCard
            title="Notificações"
            description="Templates e automações WhatsApp"
            icon={<Bell className="h-5 w-5" />}
            path="/admin/notificacoes"
            badge="Hub"
            variant="success"
          />
          <NavCard
            title="Integrações"
            description="WhatsApp, CDN, Mercado Pago"
            icon={<GitBranch className="h-5 w-5" />}
            path="/admin/integracao"
            badge="Hub"
            variant="accent"
          />
          <NavCard
            title="Analytics"
            description="Métricas, conversão e receita"
            icon={<BarChart3 className="h-5 w-5" />}
            path="/admin/analytics"
            badge="Hub"
            variant="info"
          />
          <NavCard
            title="Segurança"
            description="Alertas, logs e monitoramento"
            icon={<Shield className="h-5 w-5" />}
            path="/admin/seguranca"
            badge="Hub"
            variant="warning"
          />
          <NavCard
            title="Sistema"
            description="Configurações, migrações e RLS"
            icon={<Settings2 className="h-5 w-5" />}
            path="/admin/sistema"
            badge="Hub"
          />
          <NavCard
            title="Builds & Deploys"
            description="Deploy multi-plataforma"
            icon={<Rocket className="h-5 w-5" />}
            path="/admin/builds"
            badge="Novo"
            isNew
            variant="accent"
          />
        </div>
      </section>
    </AdminShell>
  );
}
