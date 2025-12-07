import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import AdminWhatsAppConfig from "./AdminWhatsAppConfig";
import { CDNConfigPanel } from "@/components/admin/cdn";
import { MessageSquare, Settings } from "lucide-react";

export default function AdminIntegrations() {
  const [activeTab, setActiveTab] = useState("whatsapp");

  return (
    <div className="container mx-auto p-3 sm:p-6 max-w-7xl overflow-x-hidden">
      <PageHeader
        title="Integrações Externas"
        description="Gerenciamento de integrações com serviços externos"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="cdn-config" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">R2 Config</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp">
          <AdminWhatsAppConfig />
        </TabsContent>

        <TabsContent value="cdn-config">
          <CDNConfigPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
