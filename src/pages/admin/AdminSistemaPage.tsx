/**
 * AdminSistemaPage - Hub de configurações do sistema
 * Rota: /admin/sistema
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { Heart, Database, Home, CreditCard, Palette, Tag, FileText, Activity } from "lucide-react";
import AdminBackupSystem from "../AdminBackupSystem";
import AdminCustomize from "../AdminCustomize";
import AdminCustomStatusBadges from "../AdminCustomStatusBadges";
import AdminHomepageEditor from "../AdminHomepageEditor";
import AdminPlansManager from "../AdminPlansManager";
import AdminLegalDocuments from "@/components/admin/legal/AdminLegalDocuments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function SystemHealthPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Saúde do Sistema
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Sistema operacional. Todas as integrações ativas.</p>
      </CardContent>
    </Card>
  );
}

export default function AdminSistemaPage() {
  const [activeTab, setActiveTab] = useState("health");

  const tabs = [
    {
      value: "health",
      label: "Health",
      icon: <Heart className="h-4 w-4" />,
      content: <SystemHealthPlaceholder />
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
    },
    {
      value: "legal",
      label: "Documentos Legais",
      icon: <FileText className="h-4 w-4" />,
      content: <AdminLegalDocuments />
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
