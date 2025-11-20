import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import AdminUserRoles from "./AdminUserRoles";
import AdminRoleAudit from "./AdminRoleAudit";
import AdminPermissionTest from "./AdminPermissionTest";
import AdminLeaderboard from "./AdminLeaderboard";
import AdminScheduleConfig from "./AdminScheduleConfig";

export default function AdminUsersPermissions() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <PageHeader
        title="Usuários & Permissões"
        description="Gerenciamento de usuários, roles e permissões"
      />

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
          <TabsTrigger value="test">Teste</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="schedule">Agenda</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <AdminUserRoles />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AdminRoleAudit />
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <AdminPermissionTest />
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <AdminLeaderboard />
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <AdminScheduleConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
