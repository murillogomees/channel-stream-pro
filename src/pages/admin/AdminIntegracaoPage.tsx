/**
 * AdminIntegracaoPage - Hub de integrações
 * Rota: /admin/integracao
 * Abas: WhatsApp, CDN, Transcode, Smart Cache
 */

import { AdminShell } from "@/components/admin/AdminShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminWhatsAppConfig from "../AdminWhatsAppConfig";
import AdminCdn from "../AdminCdn";
import AdminTranscodeQueue from "../AdminTranscodeQueue";
import AdminSmartCache from "../AdminSmartCache";
import AdminRLSCoverage from "../AdminRLSCoverage";
import AdminQADashboard from "../AdminQADashboard";
import { MigrationDashboard } from "@/components/admin/MigrationDashboard";

export default function AdminIntegracaoPage() {
  return (
    <AdminShell 
      title="Integrações & Ferramentas"
      description="WhatsApp, CDN, Transcode e ferramentas de debug"
    >
      <Tabs defaultValue="whatsapp" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="whatsapp" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              💬 WhatsApp
            </TabsTrigger>
            <TabsTrigger value="cdn" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🌐 CDN
            </TabsTrigger>
            <TabsTrigger value="transcode" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🔄 Transcode
            </TabsTrigger>
            <TabsTrigger value="cache" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              ⚡ Smart Cache
            </TabsTrigger>
            <TabsTrigger value="rls" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🔒 RLS Coverage
            </TabsTrigger>
            <TabsTrigger value="qa" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🧪 QA Dashboard
            </TabsTrigger>
            <TabsTrigger value="migration" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🚀 Migration
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="whatsapp" className="space-y-4 mt-4">
          <AdminWhatsAppConfig />
        </TabsContent>

        <TabsContent value="cdn" className="space-y-4 mt-4">
          <AdminCdn />
        </TabsContent>

        <TabsContent value="transcode" className="space-y-4 mt-4">
          <AdminTranscodeQueue />
        </TabsContent>

        <TabsContent value="cache" className="space-y-4 mt-4">
          <AdminSmartCache />
        </TabsContent>

        <TabsContent value="rls" className="space-y-4 mt-4">
          <AdminRLSCoverage />
        </TabsContent>

        <TabsContent value="qa" className="space-y-4 mt-4">
          <AdminQADashboard />
        </TabsContent>

        <TabsContent value="migration" className="space-y-4 mt-4">
          <MigrationDashboard />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
