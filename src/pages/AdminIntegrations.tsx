import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import AdminWhatsAppConfig from "./AdminWhatsAppConfig";
import { CDNConfigPanel, CdnDashboard, BulkDownloadPanel, ContentRoutingDashboard } from "@/components/admin/cdn";
import { MessageSquare, HardDrive, Download, GitBranch, Settings } from "lucide-react";

export default function AdminIntegrations() {
  const [activeTab, setActiveTab] = useState("whatsapp");

  return (
    <div className="container mx-auto p-3 sm:p-6 max-w-7xl overflow-x-hidden">
      <PageHeader
        title="Integrações Externas"
        description="Gerenciamento de integrações com serviços externos"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="cdn-config" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">R2 Config</span>
          </TabsTrigger>
          <TabsTrigger value="cdn-download" className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </TabsTrigger>
          <TabsTrigger value="cdn-routing" className="gap-2">
            <GitBranch className="h-4 w-4" />
            <span className="hidden sm:inline">Routing</span>
          </TabsTrigger>
          <TabsTrigger value="cdn-dashboard" className="gap-2">
            <HardDrive className="h-4 w-4" />
            <span className="hidden sm:inline">CDN</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp">
          <AdminWhatsAppConfig />
        </TabsContent>

        <TabsContent value="cdn-config">
          <CDNConfigPanel />
        </TabsContent>

        <TabsContent value="cdn-download">
          <BulkDownloadPanel />
        </TabsContent>

        <TabsContent value="cdn-routing">
          <ContentRoutingDashboard />
        </TabsContent>

        <TabsContent value="cdn-dashboard">
          <CdnDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
