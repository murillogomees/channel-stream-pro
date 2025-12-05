/**
 * AdminNotificacoesPage - Hub de notificações
 * Rota: /admin/notificacoes
 * Abas: Notificações, Config, Automáticas, Fila, Templates
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { Bell, Settings, Bot, Send, FileText } from "lucide-react";
import AdminNotificacoes from "../AdminNotificacoes";
import AdminNotificationSettings from "../AdminNotificationSettings";
import AdminAutoNotifications from "../AdminAutoNotifications";
import AdminNotificationQueue from "../AdminNotificationQueue";
import AdminTemplates from "../AdminTemplates";

export default function AdminNotificacoesPage() {
  const [activeTab, setActiveTab] = useState("notificacoes");

  const tabs = [
    {
      value: "notificacoes",
      label: "Notificações",
      icon: <Bell className="h-4 w-4" />,
      content: <AdminNotificacoes />
    },
    {
      value: "config",
      label: "Configurações",
      icon: <Settings className="h-4 w-4" />,
      content: <AdminNotificationSettings />
    },
    {
      value: "automaticas",
      label: "Automáticas",
      icon: <Bot className="h-4 w-4" />,
      content: <AdminAutoNotifications />
    },
    {
      value: "fila",
      label: "Fila",
      icon: <Send className="h-4 w-4" />,
      content: <AdminNotificationQueue />
    },
    {
      value: "templates",
      label: "Templates",
      icon: <FileText className="h-4 w-4" />,
      content: <AdminTemplates />
    }
  ];

  return (
    <AdminShell 
      title="Central de Notificações"
      description="Gestão de notificações, templates e automações"
    >
      <ResponsiveTabs
        defaultValue="notificacoes"
        value={activeTab}
        onValueChange={setActiveTab}
        tabs={tabs}
      />
    </AdminShell>
  );
}
