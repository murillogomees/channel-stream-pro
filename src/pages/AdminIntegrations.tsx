import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import AdminSmartOneSync from "./AdminSmartOneSync";
import AdminSmartOneTest from "./AdminSmartOneTest";
import AdminSmartOneCredentials from "./AdminSmartOneCredentials";
import AdminWhatsAppConfig from "./AdminWhatsAppConfig";

export default function AdminIntegrations() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <PageHeader
        title="Integrações Externas"
        description="Gerenciamento de integrações com SmartOne IPTV"
      />

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="whatsapp">WhatsApp BotBot</TabsTrigger>
          <TabsTrigger value="credentials">SmartOne Credenciais</TabsTrigger>
          <TabsTrigger value="sync">SmartOne Sync</TabsTrigger>
          <TabsTrigger value="test">SmartOne Test</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          <AdminWhatsAppConfig />
        </TabsContent>

        <TabsContent value="credentials" className="space-y-4">
          <AdminSmartOneCredentials />
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <AdminSmartOneSync />
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <AdminSmartOneTest />
        </TabsContent>
      </Tabs>
    </div>
  );
}
