import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import AdminM3ULists from "./AdminM3ULists";
import AdminM3UCustomDashboard from "./AdminM3UCustomDashboard";
import AdminM3UCustomBuilder from "./AdminM3UCustomBuilder";
import AdminM3UImportHistory from "./AdminM3UImportHistory";
import AdminM3UListStats from "./AdminM3UListStats";
import AdminM3UUsageReport from "./AdminM3UUsageReport";
import AdminVODStorage from "./AdminVODStorage";

export default function AdminM3UManagement() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <PageHeader
        title="Gestão de M3U & Playlists"
        description="Gerencie listas M3U, builder customizado e armazenamento VOD"
      />

      <Tabs defaultValue="lists" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="lists">Listas M3U</TabsTrigger>
          <TabsTrigger value="custom">Dashboard</TabsTrigger>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="import-history">Importações</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
          <TabsTrigger value="usage">Relatório de Uso</TabsTrigger>
          <TabsTrigger value="vod">Armazenamento VOD</TabsTrigger>
        </TabsList>

        <TabsContent value="lists" className="space-y-4">
          <AdminM3ULists />
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <AdminM3UCustomDashboard />
        </TabsContent>

        <TabsContent value="builder" className="space-y-4">
          <AdminM3UCustomBuilder />
        </TabsContent>

        <TabsContent value="import-history" className="space-y-4">
          <AdminM3UImportHistory />
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <AdminM3UListStats />
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <AdminM3UUsageReport />
        </TabsContent>

        <TabsContent value="vod" className="space-y-4">
          <AdminVODStorage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
