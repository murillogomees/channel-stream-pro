import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, AdminLayout } from "@/components/admin";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminNotificacoes from "./AdminNotificacoes";
import AdminNotificationSettings from "./AdminNotificationSettings";
import AdminAutoNotifications from "./AdminAutoNotifications";
import AdminNotificationQueue from "./AdminNotificationQueue";
import AdminTemplates from "./AdminTemplates";

export default function AdminNotifications() {
  return (
    <AdminLayout>
      <PageHeader
        title="Sistema de Notificações"
        description="Gerencie notificações, templates e configurações"
        backTo="/admin/dashboard"
      />

      <Tabs defaultValue="main" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="main" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Notificações
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Config
            </TabsTrigger>
            <TabsTrigger value="auto" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Automáticas
            </TabsTrigger>
            <TabsTrigger value="queue" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Fila
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Templates
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="main" className="space-y-4 mt-4">
          <AdminNotificacoes />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <AdminNotificationSettings />
        </TabsContent>

        <TabsContent value="auto" className="space-y-4 mt-4">
          <AdminAutoNotifications />
        </TabsContent>

        <TabsContent value="queue" className="space-y-4 mt-4">
          <AdminNotificationQueue />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4 mt-4">
          <AdminTemplates />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
