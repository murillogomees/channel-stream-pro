import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminShell } from "@/components/admin/AdminShell";
import { Users, CreditCard, Activity } from "lucide-react";
import AdminUserPayments from "./AdminUserPayments";
import AdminUserList from "@/pages/AdminUserList";
import { RecentActivities } from "@/components/admin/RecentActivities";

export default function AdminUsuariosPage() {
  return (
    <AdminShell>
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
          <RecentActivities />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
