import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminLayout } from "@/components/admin/AdminLayout";
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
    <AdminLayout maxWidth="7xl">
      <PageHeader
        title="Gestão M3U & Playlists"
        description="Gerencie listas M3U, builder customizado e armazenamento VOD"
        backTo="/admin/dashboard"
      />

      <Tabs defaultValue="lists" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="lists" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Listas
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="builder" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Builder
            </TabsTrigger>
            <TabsTrigger value="import-history" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Importações
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Stats
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Relatório
            </TabsTrigger>
            <TabsTrigger value="vod" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              VOD
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="lists" className="space-y-4 mt-4">
          <AdminM3ULists />
        </TabsContent>

        <TabsContent value="custom" className="space-y-4 mt-4">
          <AdminM3UCustomDashboard />
        </TabsContent>

        <TabsContent value="builder" className="space-y-4 mt-4">
          <AdminM3UCustomBuilder />
        </TabsContent>

        <TabsContent value="import-history" className="space-y-4 mt-4">
          <AdminM3UImportHistory />
        </TabsContent>

        <TabsContent value="stats" className="space-y-4 mt-4">
          <AdminM3UListStats />
        </TabsContent>

        <TabsContent value="usage" className="space-y-4 mt-4">
          <AdminM3UUsageReport />
        </TabsContent>

        <TabsContent value="vod" className="space-y-4 mt-4">
          <AdminVODStorage />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
