/**
 * AdminAnalyticsPage - Hub de analytics
 * Rota: /admin/analytics
 * Abas: Streaming, Analytics, Cupons
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { Video, BarChart3, Ticket } from "lucide-react";
import { StreamingDashboard } from "@/components/admin/streaming";
import AdminAnalytics from "../AdminAnalytics";
import AdminCoupons from "../AdminCoupons";

export default function AdminAnalyticsPage() {
  const [activeTab, setActiveTab] = useState("streaming");

  const tabs = [
    {
      value: "streaming",
      label: "Streaming",
      icon: <Video className="h-4 w-4" />,
      content: <StreamingDashboard />
    },
    {
      value: "analytics",
      label: "Analytics",
      icon: <BarChart3 className="h-4 w-4" />,
      content: <AdminAnalytics />
    },
    {
      value: "coupons",
      label: "Cupons",
      icon: <Ticket className="h-4 w-4" />,
      content: <AdminCoupons />
    }
  ];

  return (
    <AdminShell 
      title="Analytics & Performance"
      description="Métricas, streaming e cupons"
    >
      <ResponsiveTabs
        defaultValue="streaming"
        value={activeTab}
        onValueChange={setActiveTab}
        tabs={tabs}
      />
    </AdminShell>
  );
}
