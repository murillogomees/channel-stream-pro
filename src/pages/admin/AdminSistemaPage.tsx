/**
 * AdminSistemaPage - Hub de configurações do sistema
 * Rota: /admin/sistema
 * Abas: Health, Playlists, Backup, Customize, Variables, Status History, Badges
 */

import { AdminShell } from "@/components/admin/AdminShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminSystemHealth from "../AdminSystemHealth";
import AdminPlaylistHealth from "../AdminPlaylistHealth";
import AdminBackupSystem from "../AdminBackupSystem";
import AdminCustomize from "../AdminCustomize";
import AdminVariables from "../AdminVariables";
import AdminStatusHistory from "../AdminStatusHistory";
import AdminCustomStatusBadges from "../AdminCustomStatusBadges";
import AdminHomepageEditor from "../AdminHomepageEditor";
import AdminPlansManager from "../AdminPlansManager";

export default function AdminSistemaPage() {
  return (
    <AdminShell 
      title="Configurações do Sistema"
      description="Saúde, backup, customização e variáveis"
    >
      <Tabs defaultValue="health" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="health" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              💚 Health
            </TabsTrigger>
            <TabsTrigger value="playlists" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              📋 Playlists
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              💾 Backup
            </TabsTrigger>
            <TabsTrigger value="homepage" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🏠 Homepage
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              💳 Planos
            </TabsTrigger>
            <TabsTrigger value="customize" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🎨 Customize
            </TabsTrigger>
            <TabsTrigger value="variables" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🔧 Variáveis
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              📜 Histórico
            </TabsTrigger>
            <TabsTrigger value="badges" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🏷️ Badges
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="health" className="space-y-4 mt-4">
          <AdminSystemHealth />
        </TabsContent>

        <TabsContent value="playlists" className="space-y-4 mt-4">
          <AdminPlaylistHealth />
        </TabsContent>

        <TabsContent value="backup" className="space-y-4 mt-4">
          <AdminBackupSystem />
        </TabsContent>

        <TabsContent value="homepage" className="space-y-4 mt-4">
          <AdminHomepageEditor />
        </TabsContent>

        <TabsContent value="plans" className="space-y-4 mt-4">
          <AdminPlansManager />
        </TabsContent>

        <TabsContent value="customize" className="space-y-4 mt-4">
          <AdminCustomize />
        </TabsContent>

        <TabsContent value="variables" className="space-y-4 mt-4">
          <AdminVariables />
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <AdminStatusHistory />
        </TabsContent>

        <TabsContent value="badges" className="space-y-4 mt-4">
          <AdminCustomStatusBadges />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
