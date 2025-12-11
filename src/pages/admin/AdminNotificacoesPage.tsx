/**
 * AdminNotificacoesPage - Hub de notificações
 * Rota: /admin/notificacoes
 * Abas: Envios Manuais, Automáticas, Registro de Envios, Templates, Contatos de Teste, Configurações
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { Bell, Settings, Bot, FileText, History, Users } from "lucide-react";
import AdminNotificacoes from "../AdminNotificacoes";
import AdminNotificationSettings from "../AdminNotificationSettings";
import AdminAutoNotifications from "../AdminAutoNotifications";
import AdminNotificationLogs from "../AdminNotificationLogs";
import AdminTemplates from "../AdminTemplates";
import { TestContactsManager } from "@/components/admin/TestContactsManager";

export default function AdminNotificacoesPage() {
  const [activeTab, setActiveTab] = useState("notificacoes");

  const tabs = [
    {
      value: "notificacoes",
      label: "Envios Manuais",
      icon: <Bell className="h-4 w-4" />,
      content: <AdminNotificacoes />
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
    },
    {
      value: "contatos",
      label: "Contatos de Teste",
      icon: <Users className="h-4 w-4" />,
      content: (
        <div className="space-y-6">
          <TestContactsManager />
        </div>
      )
    },
    {
      value: "config",
      label: "Configurações",
      icon: <Settings className="h-4 w-4" />,
      content: <AdminNotificationSettings />
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
