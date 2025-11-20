import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import AdminSystemHealth from "./AdminSystemHealth";
import AdminPlaylistHealth from "./AdminPlaylistHealth";
import AdminBackupSystem from "./AdminBackupSystem";
import AdminCustomize from "./AdminCustomize";
import AdminVariables from "./AdminVariables";
import AdminStatusHistory from "./AdminStatusHistory";
import AdminCustomStatusBadges from "./AdminCustomStatusBadges";

export default function AdminSystemSettings() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Sistema & Configurações</h1>
      </div>

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
