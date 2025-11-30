/**
 * AdminNotificacoesPage - Hub de notificações
 * Rota: /admin/notificacoes
 * Abas: Notificações, Config, Automáticas, Fila, Templates
 */

import { AdminShell } from "@/components/admin/AdminShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminNotificacoes from "../AdminNotificacoes";
import AdminNotificationSettings from "../AdminNotificationSettings";
import AdminAutoNotifications from "../AdminAutoNotifications";
import AdminNotificationQueue from "../AdminNotificationQueue";
import AdminTemplates from "../AdminTemplates";

export default function AdminNotificacoesPage() {
  return (
    <AdminShell 
      title="Central de Notificações"
      description="Gestão de notificações, templates e automações"
    >
      <Tabs defaultValue="notificacoes" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="notificacoes" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🔔 Notificações
            </TabsTrigger>
            <TabsTrigger value="config" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              ⚙️ Config
            </TabsTrigger>
            <TabsTrigger value="automaticas" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🤖 Automáticas
            </TabsTrigger>
            <TabsTrigger value="fila" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              📤 Fila
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              📝 Templates
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="notificacoes" className="space-y-4 mt-4">
          <AdminNotificacoes />
        </TabsContent>

        <TabsContent value="config" className="space-y-4 mt-4">
          <AdminNotificationSettings />
        </TabsContent>

        <TabsContent value="automaticas" className="space-y-4 mt-4">
          <AdminAutoNotifications />
        </TabsContent>

        <TabsContent value="fila" className="space-y-4 mt-4">
          <AdminNotificationQueue />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4 mt-4">
          <AdminTemplates />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
