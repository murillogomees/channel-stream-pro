import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminSecurityAlerts from "./AdminSecurityAlerts";
import AdminSecurityMonitor from "./AdminSecurityMonitor";
import AdminSecurityAnalytics from "./AdminSecurityAnalytics";
import AdminSecurityEscalation from "./AdminSecurityEscalation";
import AdminSuspiciousLogins from "./AdminSuspiciousLogins";
import AdminIPBlocking from "./AdminIPBlocking";
import AdminIPWhitelist from "./AdminIPWhitelist";
import Admin2FASettings from "./Admin2FASettings";

export default function AdminSecurity() {
  return (
    <div className="container mx-auto p-3 sm:p-6 max-w-7xl overflow-x-hidden">
      <PageHeader
        title="Centro de Segurança"
        description="Monitoramento, alertas e configurações de segurança"
      />

      <Tabs defaultValue="alerts" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-auto min-w-full p-1">
            <TabsTrigger value="alerts" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Alertas</TabsTrigger>
            <TabsTrigger value="monitor" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Monitor</TabsTrigger>
            <TabsTrigger value="analytics" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Analytics</TabsTrigger>
            <TabsTrigger value="escalation" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Escalação</TabsTrigger>
            <TabsTrigger value="logins" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Logins</TabsTrigger>
            <TabsTrigger value="ip-block" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">IP Block</TabsTrigger>
            <TabsTrigger value="whitelist" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Whitelist</TabsTrigger>
            <TabsTrigger value="2fa" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">2FA</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

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
