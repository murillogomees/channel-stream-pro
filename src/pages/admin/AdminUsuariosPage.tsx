/**
 * AdminUsuariosPage - Hub de usuários e permissões
 * Rota: /admin/usuarios
 * Gerenciamento completo de usuários, roles, auditoria, logs e atividades
 * Suporta URL param ?tab=roles para navegação direta
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Users, Shield, History, FlaskConical, Activity, CreditCard, Play } from "lucide-react";
import AdminUserList from "../AdminUserList";
import AdminUserRoles from "../AdminUserRoles";
import AdminRoleAudit from "../AdminRoleAudit";
import AdminPermissionTest from "../AdminPermissionTest";
import AdminActivityLogs from "../AdminActivityLogs";
import AdminUserPayments from "./AdminUserPayments";
import AdminUserStreaming from "./AdminUserStreaming";

const TAB_MAP: Record<string, string> = {
  list: "list",
  usuarios: "list",
  payments: "payments",
  pagamentos: "payments",
  streaming: "streaming",
  activity: "activity",
  atividades: "activity",
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
    // Update URL without full page reload
    if (value !== "list") {
      setSearchParams({ tab: value });
    } else {
      setSearchParams({});
    }
  };

  return (
    <AdminShell 
      title="Usuários & Permissões"
      description="Gestão completa de usuários, roles, auditoria e controle de acesso"
    >
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="list" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Pagamentos
            </TabsTrigger>
            <TabsTrigger value="streaming" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm gap-1.5">
              <Play className="h-3.5 w-3.5" />
              Streaming
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Atividades
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm gap-1.5">
              <History className="h-3.5 w-3.5" />
              Auditoria
            </TabsTrigger>
            <TabsTrigger value="test" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              Teste
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="list" className="space-y-4 mt-4">
          <AdminUserList />
        </TabsContent>

        <TabsContent value="payments" className="space-y-4 mt-4">
          <AdminUserPayments />
        </TabsContent>

        <TabsContent value="streaming" className="space-y-4 mt-4">
          <AdminUserStreaming />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 mt-4">
          <AdminActivityLogs />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4 mt-4">
          <AdminUserRoles />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4 mt-4">
          <AdminRoleAudit />
        </TabsContent>

        <TabsContent value="test" className="space-y-4 mt-4">
          <AdminPermissionTest />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
