/**
 * AdminM3UPage - Hub de gestão M3U
 * Rota: /admin/m3u
 * Abas: Sync, Editor, Custom, Histórico
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { RefreshCw, Pencil, Palette, History } from "lucide-react";
import AdminM3USyncContent from "../AdminM3USyncContent";
import AdminM3UContentEditor from "../AdminM3UContentEditor";
import AdminM3UImportHistory from "../AdminM3UImportHistory";
import AdminM3UCustomDashboard from "../AdminM3UCustomDashboard";

export default function AdminM3UPage() {
  const [activeTab, setActiveTab] = useState("sync");

  const tabs = [
    {
      value: "sync",
      label: "Sync",
      icon: <RefreshCw className="h-4 w-4" />,
      content: <AdminM3USyncContent />
    },
    {
      value: "editor",
      label: "Editor",
      icon: <Pencil className="h-4 w-4" />,
      content: <AdminM3UContentEditor />
    },
    {
      value: "custom",
      label: "Custom",
      icon: <Palette className="h-4 w-4" />,
      content: <AdminM3UCustomDashboard />
    },
    {
      value: "history",
      label: "Histórico",
      icon: <History className="h-4 w-4" />,
      content: <AdminM3UImportHistory />
    }
  ];

  return (
    <AdminShell 
      title="Gestão M3U"
      description="Sincronização, editor e histórico de importação"
    >
      <ResponsiveTabs
        defaultValue="sync"
        value={activeTab}
        onValueChange={setActiveTab}
        tabs={tabs}
      />
    </AdminShell>
  );
}
