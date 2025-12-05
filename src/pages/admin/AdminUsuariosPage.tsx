/**
 * AdminUsuariosPage - Hub de usuários e permissões
 * Rota: /admin/usuarios
 * Gerenciamento completo de usuários, roles, auditoria, logs, atividades e afiliados
 * Suporta URL param ?tab=roles para navegação direta
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { Users, Shield, History, FlaskConical, Activity, CreditCard, Play, UserCheck } from "lucide-react";
import AdminUserList from "../AdminUserList";
import AdminUserRoles from "../AdminUserRoles";
import AdminRoleAudit from "../AdminRoleAudit";
import AdminPermissionTest from "../AdminPermissionTest";
import AdminActivityLogs from "../AdminActivityLogs";
import AdminUserPayments from "./AdminUserPayments";
import AdminUserStreaming from "./AdminUserStreaming";
import AdminAffiliatesTab from "./AdminAffiliatesTab";

const TAB_MAP: Record<string, string> = {
  list: "list",
  usuarios: "list",
  payments: "payments",
  pagamentos: "payments",
  streaming: "streaming",
  activity: "activity",
  atividades: "activity",
  affiliates: "affiliates",
  afiliados: "affiliates",
  roles: "roles",
  audit: "audit",
  auditoria: "audit",
  test: "test",
  teste: "test",
};

export default function AdminUsuariosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(() => {
    if (tabParam && TAB_MAP[tabParam]) {
      return TAB_MAP[tabParam];
    }
    return "list";
  });

  useEffect(() => {
    if (tabParam && TAB_MAP[tabParam]) {
      setActiveTab(TAB_MAP[tabParam]);
    }
  }, [tabParam]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value !== "list") {
      setSearchParams({ tab: value });
    } else {
      setSearchParams({});
    }
  };

  const tabs = [
    {
      value: "list",
      label: "Usuários",
      icon: <Users className="h-4 w-4" />,
      content: <AdminUserList />
    },
    {
      value: "payments",
      label: "Pagamentos",
      icon: <CreditCard className="h-4 w-4" />,
      content: <AdminUserPayments />
    },
    {
      value: "streaming",
      label: "Streaming",
      icon: <Play className="h-4 w-4" />,
      content: <AdminUserStreaming />
    },
    {
      value: "activity",
      label: "Atividades",
      icon: <Activity className="h-4 w-4" />,
      content: <AdminActivityLogs />
    },
    {
      value: "affiliates",
      label: "Afiliados",
      icon: <UserCheck className="h-4 w-4" />,
      content: <AdminAffiliatesTab />
    },
    {
      value: "roles",
      label: "Roles",
      icon: <Shield className="h-4 w-4" />,
      content: <AdminUserRoles />
    },
    {
      value: "audit",
      label: "Auditoria",
      icon: <History className="h-4 w-4" />,
      content: <AdminRoleAudit />
    },
    {
      value: "test",
      label: "Teste",
      icon: <FlaskConical className="h-4 w-4" />,
      content: <AdminPermissionTest />
    }
  ];

  return (
    <AdminShell>
      <ResponsiveTabs
        defaultValue="list"
        value={activeTab}
        onValueChange={handleTabChange}
        tabs={tabs}
      />
    </AdminShell>
  );
}
