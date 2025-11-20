import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import AdminNotificacoes from "./AdminNotificacoes";
import AdminNotificationSettings from "./AdminNotificationSettings";
import AdminAutoNotifications from "./AdminAutoNotifications";
import AdminTemplates from "./AdminTemplates";

export default function AdminNotifications() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <PageHeader
        title="Sistema de Notificações"
        description="Gerencie notificações, templates e configurações"
      />

      <Tabs defaultValue="main" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="main">Notificações</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="auto">Automáticas</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-4">
          <AdminNotificacoes />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <AdminNotificationSettings />
        </TabsContent>

        <TabsContent value="auto" className="space-y-4">
          <AdminAutoNotifications />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <AdminTemplates />
        </TabsContent>
      </Tabs>
    </div>
  );
}
