import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, AdminLayout } from "@/components/admin";
import { Users, CreditCard, Activity } from "lucide-react";
import AdminUserPayments from "./AdminUserPayments";
import AdminUserList from "@/pages/AdminUserList";

export default function AdminUsuariosPage() {
  return (
    <AdminLayout>
      <PageHeader
        title="Usuários & Permissões"
        description="Gerencie usuários e permissões"
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
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <AdminUserList />
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
      </Tabs>
    </AdminLayout>
  );
}
