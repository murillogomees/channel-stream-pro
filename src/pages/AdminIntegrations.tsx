import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import AdminSmartOneSync from "./AdminSmartOneSync";
import AdminSmartOneTest from "./AdminSmartOneTest";

export default function AdminIntegrations() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Integrações Externas</h1>
      </div>

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
