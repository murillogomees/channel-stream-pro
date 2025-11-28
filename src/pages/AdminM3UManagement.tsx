import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminM3ULists from "./AdminM3ULists";
import AdminM3UCustomDashboard from "./AdminM3UCustomDashboard";
import AdminM3UCustomBuilder from "./AdminM3UCustomBuilder";
import AdminM3UImportHistory from "./AdminM3UImportHistory";
import AdminM3UListStats from "./AdminM3UListStats";
import AdminM3UUsageReport from "./AdminM3UUsageReport";
import AdminVODStorage from "./AdminVODStorage";

export default function AdminM3UManagement() {
  return (
    <div className="container mx-auto p-3 sm:p-6 max-w-7xl overflow-x-hidden">
      <PageHeader
        title="Gestão de M3U & Playlists"
        description="Gerencie listas M3U, builder customizado e armazenamento VOD"
      />

      <Tabs defaultValue="lists" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-auto min-w-full p-1">
            <TabsTrigger value="lists" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Listas M3U</TabsTrigger>
            <TabsTrigger value="custom" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Dashboard</TabsTrigger>
            <TabsTrigger value="builder" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Builder</TabsTrigger>
            <TabsTrigger value="import-history" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Importações</TabsTrigger>
            <TabsTrigger value="stats" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Estatísticas</TabsTrigger>
            <TabsTrigger value="usage" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Relatório</TabsTrigger>
            <TabsTrigger value="vod" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">VOD</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

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
