/**
 * AdminSistemaPage - Hub de configurações do sistema
 * Rota: /admin/sistema
 * Abas: Health, Playlists, Backup, Customize, Variables, Status History, Badges
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { Heart, ListMusic, Database, Home, CreditCard, Palette, Settings, History, Tag } from "lucide-react";
import AdminSystemHealth from "../AdminSystemHealth";
import AdminPlaylistHealth from "../AdminPlaylistHealth";
import AdminBackupSystem from "../AdminBackupSystem";
import AdminCustomize from "../AdminCustomize";
import AdminVariables from "../AdminVariables";
import AdminStatusHistory from "../AdminStatusHistory";
import AdminCustomStatusBadges from "../AdminCustomStatusBadges";
import AdminHomepageEditor from "../AdminHomepageEditor";
import AdminPlansManager from "../AdminPlansManager";

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
      value: "playlists",
      label: "Playlists",
      icon: <ListMusic className="h-4 w-4" />,
      content: <AdminPlaylistHealth />
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
      description="Saúde, backup, customização e variáveis"
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
