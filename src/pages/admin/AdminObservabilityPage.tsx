/**
 * AdminObservabilityPage - Real-time system monitoring dashboard
 * Rota: /admin/observability
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { Activity, Heart, Database, TrendingUp } from "lucide-react";
import ObservabilityMetrics from "@/components/admin/observability/ObservabilityMetrics";
import ObservabilityHealth from "@/components/admin/observability/ObservabilityHealth";
import ObservabilityCharts from "@/components/admin/observability/ObservabilityCharts";
import ObservabilityHotChannels from "@/components/admin/observability/ObservabilityHotChannels";

export default function AdminObservabilityPage() {
  const [activeTab, setActiveTab] = useState("metrics");

  const tabs = [
    {
      value: "metrics",
      label: "Métricas",
      icon: <Activity className="h-4 w-4" />,
      content: <ObservabilityMetrics />
    },
    {
      value: "health",
      label: "Health Status",
      icon: <Heart className="h-4 w-4" />,
      content: <ObservabilityHealth />
    },
    {
      value: "charts",
      label: "Gráficos",
      icon: <TrendingUp className="h-4 w-4" />,
      content: <ObservabilityCharts />
    },
    {
      value: "hot-channels",
      label: "Hot Channels",
      icon: <Database className="h-4 w-4" />,
      content: <ObservabilityHotChannels />
    }
  ];

  return (
    <AdminShell 
      title="Observabilidade"
      description="Monitoramento em tempo real do sistema"
    >
      <ResponsiveTabs
        defaultValue="metrics"
        value={activeTab}
        onValueChange={setActiveTab}
        tabs={tabs}
      />
    </AdminShell>
  );
}
