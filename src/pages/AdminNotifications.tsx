import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import AdminNotificacoes from "./AdminNotificacoes";
import AdminNotificationSettings from "./AdminNotificationSettings";
import AdminAutoNotifications from "./AdminAutoNotifications";
import AdminTemplates from "./AdminTemplates";

export default function AdminNotifications() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Sistema de Notificações</h1>
      </div>

      <Tabs defaultValue="main" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="main">Notificações</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="auto">Automáticas</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-4">
          <AdminNotificacoes />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <AdminNotificationSettings />
        </TabsContent>

        <TabsContent value="auto" className="space-y-4">
          <AdminAutoNotifications />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <AdminTemplates />
        </TabsContent>
      </Tabs>
    </div>
  );
}
