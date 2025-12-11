/**
 * AdminNotificacoesPage - Hub de notificações
 * Rota: /admin/notificacoes
 * Abas: Notificações, Configurações, Automáticas, Registro de Envios, Templates
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { Bell, Settings, Bot, FileText, History } from "lucide-react";
import AdminNotificacoes from "../AdminNotificacoes";
import AdminNotificationSettings from "../AdminNotificationSettings";
import AdminAutoNotifications from "../AdminAutoNotifications";
import AdminNotificationLogs from "../AdminNotificationLogs";
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
      value: "registro",
      label: "Registro de Envios",
      icon: <History className="h-4 w-4" />,
      content: <AdminNotificationLogs />
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
