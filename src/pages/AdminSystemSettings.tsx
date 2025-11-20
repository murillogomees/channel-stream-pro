import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import AdminSystemHealth from "./AdminSystemHealth";
import AdminPlaylistHealth from "./AdminPlaylistHealth";
import AdminBackupSystem from "./AdminBackupSystem";
import AdminCustomize from "./AdminCustomize";
import AdminVariables from "./AdminVariables";
import AdminStatusHistory from "./AdminStatusHistory";
import AdminCustomStatusBadges from "./AdminCustomStatusBadges";

export default function AdminSystemSettings() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <PageHeader
        title="Sistema & Configurações"
        description="Saúde do sistema, backup e configurações avançadas"
      />

      <Tabs defaultValue="health" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="health">Saúde</TabsTrigger>
          <TabsTrigger value="playlist">Playlists</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="customize">Customizar</TabsTrigger>
          <TabsTrigger value="variables">Variáveis</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="badges">Badges</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-4">
          <AdminSystemHealth />
        </TabsContent>

        <TabsContent value="playlist" className="space-y-4">
          <AdminPlaylistHealth />
        </TabsContent>

        <TabsContent value="backup" className="space-y-4">
          <AdminBackupSystem />
        </TabsContent>

        <TabsContent value="customize" className="space-y-4">
          <AdminCustomize />
        </TabsContent>

        <TabsContent value="variables" className="space-y-4">
          <AdminVariables />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <AdminStatusHistory />
        </TabsContent>

        <TabsContent value="badges" className="space-y-4">
          <AdminCustomStatusBadges />
        </TabsContent>
      </Tabs>
    </div>
  );
}
