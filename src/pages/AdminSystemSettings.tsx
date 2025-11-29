import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, AdminLayout } from "@/components/admin";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminSystemHealth from "./AdminSystemHealth";
import AdminPlaylistHealth from "./AdminPlaylistHealth";
import AdminBackupSystem from "./AdminBackupSystem";
import AdminCustomize from "./AdminCustomize";
import AdminVariables from "./AdminVariables";
import AdminStatusHistory from "./AdminStatusHistory";
import AdminCustomStatusBadges from "./AdminCustomStatusBadges";

export default function AdminSystemSettings() {
  return (
    <AdminLayout>
      <PageHeader
        title="Sistema & Configurações"
        description="Saúde do sistema, backup e configurações avançadas"
        backTo="/admin/dashboard"
      />

      <Tabs defaultValue="health" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="health" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Saúde
            </TabsTrigger>
            <TabsTrigger value="playlist" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Playlists
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Backup
            </TabsTrigger>
            <TabsTrigger value="customize" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Customizar
            </TabsTrigger>
            <TabsTrigger value="variables" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Variáveis
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Histórico
            </TabsTrigger>
            <TabsTrigger value="badges" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Badges
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="health" className="space-y-4 mt-4">
          <AdminSystemHealth />
        </TabsContent>

        <TabsContent value="playlist" className="space-y-4 mt-4">
          <AdminPlaylistHealth />
        </TabsContent>

        <TabsContent value="backup" className="space-y-4 mt-4">
          <AdminBackupSystem />
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
    </AdminLayout>
  );
}
