import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, AdminLayout } from "@/components/admin";
import { Users, CreditCard, Activity, Shield } from "lucide-react";
import AdminUserPayments from "./AdminUserPayments";

export default function AdminUsuariosPage() {
  return (
    <AdminLayout>
      <PageHeader
        title="Usuários & Permissões"
        description="Gerencie usuários, roles e permissões"
        backTo="/admin/dashboard"
      />

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Atividades
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Roles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Lista de Usuários
              </CardTitle>
              <CardDescription>
                Gerencie os usuários do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Listagem de usuários em desenvolvimento.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <AdminUserPayments />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registro de Atividades</CardTitle>
              <CardDescription>
                Histórico de ações dos usuários no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Registro de atividades em desenvolvimento.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Roles</CardTitle>
              <CardDescription>
                Configure permissões e roles dos usuários
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Gerenciamento de roles em desenvolvimento.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
