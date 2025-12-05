/**
 * AdminM3UPage - Hub de gestão M3U
 * Rota: /admin/m3u
 * Abas: Listas, Sync, Editor, Import History, Stats, VOD Storage, CF Stream
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { List, RefreshCw, Pencil, Palette, History, BarChart3, TrendingUp, Film, Cloud, HardDrive } from "lucide-react";
import AdminM3ULists from "../AdminM3ULists";
import AdminM3USyncContent from "../AdminM3USyncContent";
import AdminM3UContentEditor from "../AdminM3UContentEditor";
import AdminM3UImportHistory from "../AdminM3UImportHistory";
import AdminM3UListStats from "../AdminM3UListStats";
import AdminM3UUsageReport from "../AdminM3UUsageReport";
import AdminVODStorage from "../AdminVODStorage";
import AdminCFStreamDashboard from "../AdminCFStreamDashboard";
import AdminM3UCustomDashboard from "../AdminM3UCustomDashboard";
import { PlaylistStorageManager } from "@/components/admin/m3u/PlaylistStorageManager";

export default function AdminM3UPage() {
  const [activeTab, setActiveTab] = useState("listas");

  const tabs = [
    {
      value: "listas",
      label: "Listas",
      icon: <List className="h-4 w-4" />,
      content: <AdminM3ULists />
    },
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
    },
    {
      value: "stats",
      label: "Stats",
      icon: <BarChart3 className="h-4 w-4" />,
      content: <AdminM3UListStats />
    },
    {
      value: "usage",
      label: "Uso",
      icon: <TrendingUp className="h-4 w-4" />,
      content: <AdminM3UUsageReport />
    },
    {
      value: "vod",
      label: "VOD Storage",
      icon: <Film className="h-4 w-4" />,
      content: <AdminVODStorage />
    },
    {
      value: "cfstream",
      label: "CF Stream",
      icon: <Cloud className="h-4 w-4" />,
      content: <AdminCFStreamDashboard />
    },
    {
      value: "storage",
      label: "Storage",
      icon: <HardDrive className="h-4 w-4" />,
      content: <PlaylistStorageManager />
    }
  ];

  return (
    <AdminShell 
      title="Gestão M3U & Playlists"
      description="Listas, sincronização, builder e relatórios"
    >
      <ResponsiveTabs
        defaultValue="listas"
        value={activeTab}
        onValueChange={setActiveTab}
        tabs={tabs}
      />
    </AdminShell>
  );
}
