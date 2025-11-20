import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import AdminM3ULists from "./AdminM3ULists";
import AdminM3UCustomDashboard from "./AdminM3UCustomDashboard";
import AdminM3UListStats from "./AdminM3UListStats";
import AdminM3UUsageReport from "./AdminM3UUsageReport";
import AdminVODStorage from "./AdminVODStorage";

export default function AdminM3UManagement() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Gestão de M3U & Playlists</h1>
      </div>

      <Tabs defaultValue="lists" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="lists">Listas M3U</TabsTrigger>
          <TabsTrigger value="custom">Builder Customizado</TabsTrigger>
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
