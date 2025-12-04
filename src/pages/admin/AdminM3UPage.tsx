/**
 * AdminM3UPage - Hub de gestão M3U
 * Rota: /admin/m3u
 * Abas: Listas, Sync, Editor, Import History, Stats, VOD Storage, CF Stream
 */

import { AdminShell } from "@/components/admin/AdminShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminM3ULists from "../AdminM3ULists";
import AdminM3USyncContent from "../AdminM3USyncContent";
import AdminM3UContentEditor from "../AdminM3UContentEditor";
import AdminM3UImportHistory from "../AdminM3UImportHistory";
import AdminM3UListStats from "../AdminM3UListStats";
import AdminM3UUsageReport from "../AdminM3UUsageReport";
import AdminVODStorage from "../AdminVODStorage";
import AdminCFStreamDashboard from "../AdminCFStreamDashboard";
import AdminM3UCustomDashboard from "../AdminM3UCustomDashboard";
import { PlaylistStorageManager } from "@/components/admin/m3u/PlaylistStorageManager";

export default function AdminM3UPage() {
  return (
    <AdminShell 
      title="Gestão M3U & Playlists"
      description="Listas, sincronização, builder e relatórios"
    >
      <Tabs defaultValue="listas" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="listas" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              📋 Listas
            </TabsTrigger>
            <TabsTrigger value="sync" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🔄 Sync
            </TabsTrigger>
            <TabsTrigger value="editor" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              ✏️ Editor
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🎨 Custom
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              📜 Histórico
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              📊 Stats
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              📈 Uso
            </TabsTrigger>
            <TabsTrigger value="vod" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🎬 VOD Storage
            </TabsTrigger>
            <TabsTrigger value="cfstream" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              ☁️ CF Stream
            </TabsTrigger>
            <TabsTrigger value="storage" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              💾 Storage
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="listas" className="space-y-4 mt-4">
          <AdminM3ULists />
        </TabsContent>

        <TabsContent value="sync" className="space-y-4 mt-4">
          <AdminM3USyncContent />
        </TabsContent>

        <TabsContent value="editor" className="space-y-4 mt-4">
          <AdminM3UContentEditor />
        </TabsContent>

        <TabsContent value="custom" className="space-y-4 mt-4">
          <AdminM3UCustomDashboard />
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
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

        <TabsContent value="cfstream" className="space-y-4 mt-4">
          <AdminCFStreamDashboard />
        </TabsContent>

        <TabsContent value="storage" className="space-y-4 mt-4">
          <PlaylistStorageManager />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
