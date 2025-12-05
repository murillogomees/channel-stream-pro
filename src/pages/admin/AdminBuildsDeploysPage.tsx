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
  Play,
  Key
} from "lucide-react";
import { PlatformBuildsGrid } from "@/components/admin/builds/PlatformBuildsGrid";
import { BuildConfigPanel } from "@/components/admin/builds/BuildConfigPanel";
import { BuildHistoryTable } from "@/components/admin/builds/BuildHistoryTable";
import { BuildMonitoringDashboard } from "@/components/admin/builds/BuildMonitoringDashboard";
import { CiCdPipelinePanel } from "@/components/admin/builds/CiCdPipelinePanel";
import { BuildStatsOverview } from "@/components/admin/builds/BuildStatsOverview";
import { AndroidDeployInstructions } from "@/components/admin/builds/AndroidDeployInstructions";
import { DeveloperAccountsModal } from "@/components/admin/builds/DeveloperAccountsModal";
import { Button } from "@/components/ui/button";

export default function AdminBuildsDeploysPage() {
  const [activeTab, setActiveTab] = useState("platforms");

  return (
    <AdminShell backTo="/admin/dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <ResponsivePageHeader
          title="Builds & Deploys"
          description="Gerenciamento multi-plataforma de builds e deployments"
        />
        <DeveloperAccountsModal
          trigger={
            <Button variant="outline" className="gap-2">
              <Key className="h-4 w-4" />
              Credenciais
            </Button>
          }
        />
      </div>

      <BuildStatsOverview />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 gap-1 h-auto p-1">
          <TabsTrigger value="platforms" className="flex items-center gap-2 text-xs sm:text-sm">
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">Plataformas</span>
            <span className="sm:hidden">Build</span>
          </TabsTrigger>
          <TabsTrigger value="android" className="flex items-center gap-2 text-xs sm:text-sm">
            <Smartphone className="h-4 w-4 text-green-500" />
            <span className="hidden sm:inline">Android</span>
            <span className="sm:hidden">Android</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2 text-xs sm:text-sm">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configurações</span>
            <span className="sm:hidden">Config</span>
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="flex items-center gap-2 text-xs sm:text-sm">
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">CI/CD</span>
            <span className="sm:hidden">CI/CD</span>
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-2 text-xs sm:text-sm">
            <Monitor className="h-4 w-4" />
            <span className="hidden sm:inline">Monitor</span>
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

        <TabsContent value="android" className="space-y-4">
          <AndroidDeployInstructions />
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
