import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import AdminSmartOneSync from "./AdminSmartOneSync";
import AdminSmartOneTest from "./AdminSmartOneTest";

export default function AdminIntegrations() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <PageHeader
        title="Integrações Externas"
        description="Gerenciamento de integrações com SmartOne IPTV"
      />

      <Tabs defaultValue="sync" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sync">SmartOne Sync</TabsTrigger>
          <TabsTrigger value="test">SmartOne Test</TabsTrigger>
        </TabsList>

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
