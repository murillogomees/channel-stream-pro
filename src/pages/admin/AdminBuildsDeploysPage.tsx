/**
 * AdminBuildsDeploysPage - Painel de Deploy Multi-Plataforma
 * Gerencia builds e deploys para todas as plataformas do sistema
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin";
import { ResponsivePageHeader } from "@/components/admin/ResponsivePageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Rocket, 
  Settings, 
  History, 
  Monitor,
  Smartphone,
  Tv,
  Globe,
  Play,
  BarChart3
} from "lucide-react";
import { PlatformBuildsGrid } from "@/components/admin/builds/PlatformBuildsGrid";
import { BuildConfigPanel } from "@/components/admin/builds/BuildConfigPanel";
import { BuildHistoryTable } from "@/components/admin/builds/BuildHistoryTable";
import { BuildMonitoringDashboard } from "@/components/admin/builds/BuildMonitoringDashboard";
import { CiCdPipelinePanel } from "@/components/admin/builds/CiCdPipelinePanel";
import { BuildStatsOverview } from "@/components/admin/builds/BuildStatsOverview";

export default function AdminBuildsDeploysPage() {
  const [activeTab, setActiveTab] = useState("platforms");

  return (
    <AdminShell backTo="/admin/dashboard">
      <ResponsivePageHeader
        title="Builds & Deploys"
        description="Gerenciamento multi-plataforma de builds e deployments"
      />

      <BuildStatsOverview />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 h-auto p-1">
          <TabsTrigger value="platforms" className="flex items-center gap-2 text-xs sm:text-sm">
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">Plataformas</span>
            <span className="sm:hidden">Build</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2 text-xs sm:text-sm">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configurações</span>
            <span className="sm:hidden">Config</span>
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="flex items-center gap-2 text-xs sm:text-sm">
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">CI/CD Pipeline</span>
            <span className="sm:hidden">CI/CD</span>
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-2 text-xs sm:text-sm">
            <Monitor className="h-4 w-4" />
            <span className="hidden sm:inline">Monitoramento</span>
            <span className="sm:hidden">Monitor</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2 text-xs sm:text-sm">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
            <span className="sm:hidden">Logs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="platforms" className="space-y-4">
          <PlatformBuildsGrid />
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <BuildConfigPanel />
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <CiCdPipelinePanel />
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <BuildMonitoringDashboard />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <BuildHistoryTable />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
