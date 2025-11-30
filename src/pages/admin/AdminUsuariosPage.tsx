/**
 * AdminUsuariosPage - Hub de usuários e permissões
 * Rota: /admin/usuarios
 * Abas: Roles, Criar Usuário, Auditoria, Teste Permissões
 */

import { AdminShell } from "@/components/admin/AdminShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminUserRoles from "../AdminUserRoles";
import AdminCreateUser from "../AdminCreateUser";
import AdminRoleAudit from "../AdminRoleAudit";
import AdminPermissionTest from "../AdminPermissionTest";

export default function AdminUsuariosPage() {
  return (
    <AdminShell 
      title="Usuários & Permissões"
      description="Gestão de roles, auditoria e controle de acesso"
    >
      <Tabs defaultValue="roles" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="roles" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              👥 Roles
            </TabsTrigger>
            <TabsTrigger value="create" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              ➕ Criar Usuário
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              📜 Auditoria
            </TabsTrigger>
            <TabsTrigger value="test" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🧪 Teste
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="roles" className="space-y-4 mt-4">
          <AdminUserRoles />
        </TabsContent>

        <TabsContent value="create" className="space-y-4 mt-4">
          <AdminCreateUser />
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
