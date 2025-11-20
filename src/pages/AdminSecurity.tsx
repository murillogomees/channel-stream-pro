import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import AdminSecurityAlerts from "./AdminSecurityAlerts";
import AdminSecurityMonitor from "./AdminSecurityMonitor";
import AdminSecurityAnalytics from "./AdminSecurityAnalytics";
import AdminSecurityEscalation from "./AdminSecurityEscalation";
import AdminSuspiciousLogins from "./AdminSuspiciousLogins";
import AdminIPBlocking from "./AdminIPBlocking";
import AdminIPWhitelist from "./AdminIPWhitelist";
import Admin2FASettings from "./Admin2FASettings";

export default function AdminSecurity() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Centro de Segurança</h1>
      </div>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="monitor">Monitor</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="escalation">Escalação</TabsTrigger>
          <TabsTrigger value="logins">Logins</TabsTrigger>
          <TabsTrigger value="ip-block">IP Block</TabsTrigger>
          <TabsTrigger value="whitelist">Whitelist</TabsTrigger>
          <TabsTrigger value="2fa">2FA</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <AdminSecurityAlerts />
        </TabsContent>

        <TabsContent value="monitor" className="space-y-4">
          <AdminSecurityMonitor />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AdminSecurityAnalytics />
        </TabsContent>

        <TabsContent value="escalation" className="space-y-4">
          <AdminSecurityEscalation />
        </TabsContent>

        <TabsContent value="logins" className="space-y-4">
          <AdminSuspiciousLogins />
        </TabsContent>

        <TabsContent value="ip-block" className="space-y-4">
          <AdminIPBlocking />
        </TabsContent>

        <TabsContent value="whitelist" className="space-y-4">
          <AdminIPWhitelist />
        </TabsContent>

        <TabsContent value="2fa" className="space-y-4">
          <Admin2FASettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
