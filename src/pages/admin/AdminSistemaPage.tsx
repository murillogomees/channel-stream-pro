/**
 * AdminSistemaPage - Hub de configurações do sistema
 * Rota: /admin/sistema
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { Heart, Database, Home, CreditCard, Palette, Tag, Shield, Cloud } from "lucide-react";
import AdminSystemHealth from "../AdminSystemHealth";
import AdminBackupSystem from "../AdminBackupSystem";
import AdminCustomize from "../AdminCustomize";
import AdminCustomStatusBadges from "../AdminCustomStatusBadges";
import AdminHomepageEditor from "../AdminHomepageEditor";
import AdminPlansManager from "../AdminPlansManager";
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
      value: "rls-audit",
      label: "RLS Audit",
      icon: <Shield className="h-4 w-4" />,
      content: <InteractiveRLSAuditPanel />
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
      value: "badges",
      label: "Badges",
      icon: <Tag className="h-4 w-4" />,
      content: <AdminCustomStatusBadges />
    }
  ];

  return (
    <AdminShell 
      title="Configurações do Sistema"
      description="Saúde, backup, customização e configurações"
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
