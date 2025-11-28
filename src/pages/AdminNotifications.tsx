import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminNotificacoes from "./AdminNotificacoes";
import AdminNotificationSettings from "./AdminNotificationSettings";
import AdminAutoNotifications from "./AdminAutoNotifications";
import AdminNotificationQueue from "./AdminNotificationQueue";
import AdminTemplates from "./AdminTemplates";

export default function AdminNotifications() {
  return (
    <div className="container mx-auto p-3 sm:p-6 max-w-7xl overflow-x-hidden">
      <PageHeader
        title="Sistema de Notificações"
        description="Gerencie notificações, templates e configurações"
      />

      <Tabs defaultValue="main" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-auto min-w-full p-1">
            <TabsTrigger value="main" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Notificações</TabsTrigger>
            <TabsTrigger value="settings" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Configurações</TabsTrigger>
            <TabsTrigger value="auto" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Automáticas</TabsTrigger>
            <TabsTrigger value="queue" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Fila</TabsTrigger>
            <TabsTrigger value="templates" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Templates</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="main" className="space-y-4">
          <AdminNotificacoes />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <AdminNotificationSettings />
        </TabsContent>

        <TabsContent value="auto" className="space-y-4">
          <AdminAutoNotifications />
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <AdminNotificationQueue />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <AdminTemplates />
        </TabsContent>
      </Tabs>
    </div>
  );
}
