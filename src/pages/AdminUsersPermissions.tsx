import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminUserRoles from "./AdminUserRoles";
import AdminCreateUser from "./AdminCreateUser";
import AdminRoleAudit from "./AdminRoleAudit";
import AdminPermissionTest from "./AdminPermissionTest";

export default function AdminUsersPermissions() {
  return (
    <div className="container mx-auto p-3 sm:p-6 max-w-7xl overflow-x-hidden">
      <PageHeader
        title="Usuários & Permissões"
        description="Gerenciamento de usuários, roles e permissões"
      />

      <Tabs defaultValue="roles" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-auto min-w-full p-1">
            <TabsTrigger value="roles" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Roles</TabsTrigger>
            <TabsTrigger value="create" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Criar Usuário</TabsTrigger>
            <TabsTrigger value="audit" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Auditoria</TabsTrigger>
            <TabsTrigger value="test" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Teste</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="roles" className="space-y-4">
          <AdminUserRoles />
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <AdminCreateUser />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AdminRoleAudit />
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <AdminPermissionTest />
        </TabsContent>
      </Tabs>
    </div>
  );
}
