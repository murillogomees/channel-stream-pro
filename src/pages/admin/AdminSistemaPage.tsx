/**
 * AdminSistemaPage - Hub de configurações do sistema
 * Rota: /admin/sistema
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { Heart, Database, Home, CreditCard, Palette, Settings, History, Tag, RefreshCw, Cloud, Shield } from "lucide-react";
import AdminSystemHealth from "../AdminSystemHealth";
import AdminBackupSystem from "../AdminBackupSystem";
import AdminCustomize from "../AdminCustomize";
import AdminVariables from "../AdminVariables";
import AdminStatusHistory from "../AdminStatusHistory";
import AdminCustomStatusBadges from "../AdminCustomStatusBadges";
import AdminHomepageEditor from "../AdminHomepageEditor";
import AdminPlansManager from "../AdminPlansManager";
import { MigrationDashboard } from "@/components/admin/MigrationDashboard";
import { MigrationStats } from "@/components/migrations/MigrationStats";
import { MigrationScanner } from "@/components/admin/MigrationScanner";
import { DriftFindingsTable } from "@/components/migrations/DriftFindingsTable";
import { MigrationHistory } from "@/components/migrations/MigrationHistory";
import { R2MigrationDashboard } from "@/components/admin/migration/R2MigrationDashboard";
import { InteractiveRLSAuditPanel } from "@/components/admin/security/InteractiveRLSAuditPanel";

export default function AdminSistemaPage() {
  const [activeTab, setActiveTab] = useState("health");

  const tabs = [
    {
      value: "health",
      label: "Health",
      icon: <Heart className="h-4 w-4" />,
      content: <AdminSystemHealth />
    },
    {
      value: "migrations",
      label: "Migrações",
      icon: <RefreshCw className="h-4 w-4" />,
      content: (
        <div className="space-y-6">
          <MigrationStats />
          <MigrationDashboard />
          <MigrationScanner />
          <DriftFindingsTable />
          <MigrationHistory />
        </div>
      )
    },
    {
      value: "rls-audit",
      label: "RLS Audit",
      icon: <Shield className="h-4 w-4" />,
      content: <InteractiveRLSAuditPanel />
    },
    {
      value: "r2",
      label: "CDN R2",
      icon: <Cloud className="h-4 w-4" />,
      content: <R2MigrationDashboard />
    },
    {
      value: "backup",
      label: "Backup",
      icon: <Database className="h-4 w-4" />,
      content: <AdminBackupSystem />
    },
    {
      value: "homepage",
      label: "Homepage",
      icon: <Home className="h-4 w-4" />,
      content: <AdminHomepageEditor />
    },
    {
      value: "plans",
      label: "Planos",
      icon: <CreditCard className="h-4 w-4" />,
      content: <AdminPlansManager />
    },
    {
      value: "customize",
      label: "Customize",
      icon: <Palette className="h-4 w-4" />,
      content: <AdminCustomize />
    },
    {
      value: "variables",
      label: "Variáveis",
      icon: <Settings className="h-4 w-4" />,
      content: <AdminVariables />
    },
    {
      value: "history",
      label: "Histórico",
      icon: <History className="h-4 w-4" />,
      content: <AdminStatusHistory />
    },
    {
      value: "badges",
      label: "Badges",
      icon: <Tag className="h-4 w-4" />,
      content: <AdminCustomStatusBadges />
    }
  ];

  return (
    <AdminShell 
      title="Configurações do Sistema"
      description="Saúde, migrações, backup, customização e variáveis"
    >
      <ResponsiveTabs
        defaultValue="health"
        value={activeTab}
        onValueChange={setActiveTab}
        tabs={tabs}
      />
    </AdminShell>
  );
}
