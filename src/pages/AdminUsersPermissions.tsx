import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, AdminLayout } from "@/components/admin";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminUserRoles from "./AdminUserRoles";
import AdminCreateUser from "./AdminCreateUser";
import AdminRoleAudit from "./AdminRoleAudit";
import AdminPermissionTest from "./AdminPermissionTest";
import { Users, Shield, UserPlus, History, TestTube } from "lucide-react";

export default function AdminUsersPermissions() {
  return (
    <AdminLayout>
      <PageHeader
        title="Usuários & Permissões"
        description="Gerenciamento de usuários, roles e permissões"
        backTo="/admin/dashboard"
      />

      <Tabs defaultValue="roles" className="space-y-6">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-12 min-w-full sm:min-w-0 p-1.5 bg-surface-1 border border-border/50 rounded-xl gap-1">
            <TabsTrigger 
              value="roles" 
              className="flex-shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
            >
              <Shield className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Gerenciar Roles</span>
              <span className="sm:hidden">Roles</span>
            </TabsTrigger>
            <TabsTrigger 
              value="create" 
              className="flex-shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Criar Usuário</span>
              <span className="sm:hidden">Criar</span>
            </TabsTrigger>
            <TabsTrigger 
              value="audit" 
              className="flex-shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
            >
              <History className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Auditoria</span>
              <span className="sm:hidden">Audit</span>
            </TabsTrigger>
            <TabsTrigger 
              value="test" 
              className="flex-shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
            >
              <TestTube className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Diagnóstico</span>
              <span className="sm:hidden">Teste</span>
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="roles" className="space-y-4 mt-0">
          <AdminUserRoles />
        </TabsContent>

        <TabsContent value="create" className="space-y-4 mt-0">
          <AdminCreateUser />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4 mt-0">
          <AdminRoleAudit />
        </TabsContent>

        <TabsContent value="test" className="space-y-4 mt-0">
          <AdminPermissionTest />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
