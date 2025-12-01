/**
 * AdminUsuariosPage - Hub de usuários e permissões
 * Rota: /admin/usuarios
 * Gerenciamento completo de usuários, roles, auditoria, logs e atividades
 */

import { AdminShell } from "@/components/admin/AdminShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Users, Shield, History, UserPlus, FlaskConical, Activity } from "lucide-react";
import AdminUserList from "../AdminUserList";
import AdminUserRoles from "../AdminUserRoles";
import AdminRoleAudit from "../AdminRoleAudit";
import AdminCreateUser from "../AdminCreateUser";
import AdminPermissionTest from "../AdminPermissionTest";
import AdminActivityLogs from "../AdminActivityLogs";

export default function AdminUsuariosPage() {
  return (
    <AdminShell 
      title="Usuários & Permissões"
      description="Gestão completa de usuários, roles, auditoria e controle de acesso"
    >
      <Tabs defaultValue="list" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="list" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="create" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Criar
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm gap-1.5">
              <History className="h-3.5 w-3.5" />
              Auditoria
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Atividades
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

        <TabsContent value="roles" className="space-y-4 mt-4">
          <AdminUserRoles />
        </TabsContent>

        <TabsContent value="create" className="space-y-4 mt-4">
          <AdminCreateUser />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4 mt-4">
          <AdminRoleAudit />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 mt-4">
          <AdminActivityLogs />
        </TabsContent>

        <TabsContent value="test" className="space-y-4 mt-4">
          <AdminPermissionTest />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
