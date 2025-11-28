import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import AdminUserRoles from "./AdminUserRoles";
import AdminCreateUser from "./AdminCreateUser";
import AdminRoleAudit from "./AdminRoleAudit";
import AdminPermissionTest from "./AdminPermissionTest";

export default function AdminUsersPermissions() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <PageHeader
        title="Usuários & Permissões"
        description="Gerenciamento de usuários, roles e permissões"
      />

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="create">Criar Usuário</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
          <TabsTrigger value="test">Teste</TabsTrigger>
        </TabsList>

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
