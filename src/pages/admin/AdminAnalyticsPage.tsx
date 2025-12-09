/**
 * AdminAnalyticsPage - Hub de analytics
 * Rota: /admin/analytics
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { BarChart3, Ticket } from "lucide-react";
import AdminAnalytics from "../AdminAnalytics";
import AdminCoupons from "../AdminCoupons";

export default function AdminAnalyticsPage() {
  const [activeTab, setActiveTab] = useState("analytics");

  const tabs = [
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
      description="Métricas e cupons"
    >
      <ResponsiveTabs
        defaultValue="analytics"
        value={activeTab}
        onValueChange={setActiveTab}
        tabs={tabs}
      />
    </AdminShell>
  );
}
