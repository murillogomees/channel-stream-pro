/**
 * AdminSegurancaPage - Hub de segurança
 * Rota: /admin/seguranca
 * Abas: Alerts, Monitor, Analytics, Escalation, Logins, IP Block, Whitelist, 2FA
 */

import { AdminShell } from "@/components/admin/AdminShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminSecurityAlerts from "../AdminSecurityAlerts";
import AdminSecurityMonitor from "../AdminSecurityMonitor";
import AdminSecurityAnalytics from "../AdminSecurityAnalytics";
import AdminSecurityEscalation from "../AdminSecurityEscalation";
import AdminSuspiciousLogins from "../AdminSuspiciousLogins";
import AdminIPBlocking from "../AdminIPBlocking";
import AdminIPWhitelist from "../AdminIPWhitelist";
import Admin2FASettings from "../Admin2FASettings";

export default function AdminSegurancaPage() {
  return (
    <AdminShell 
      title="Centro de Segurança"
      description="Monitoramento, alertas e controle de acesso"
    >
      <Tabs defaultValue="alerts" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="alerts" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🚨 Alertas
            </TabsTrigger>
            <TabsTrigger value="monitor" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              👁️ Monitor
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              📊 Analytics
            </TabsTrigger>
            <TabsTrigger value="escalation" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              ⬆️ Escalation
            </TabsTrigger>
            <TabsTrigger value="logins" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🔐 Logins
            </TabsTrigger>
            <TabsTrigger value="ipblock" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🚫 IP Block
            </TabsTrigger>
            <TabsTrigger value="whitelist" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              ✅ Whitelist
            </TabsTrigger>
            <TabsTrigger value="2fa" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🔑 2FA
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="alerts" className="space-y-4 mt-4">
          <AdminSecurityAlerts />
        </TabsContent>

        <TabsContent value="monitor" className="space-y-4 mt-4">
          <AdminSecurityMonitor />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 mt-4">
          <AdminSecurityAnalytics />
        </TabsContent>

        <TabsContent value="escalation" className="space-y-4 mt-4">
          <AdminSecurityEscalation />
        </TabsContent>

        <TabsContent value="logins" className="space-y-4 mt-4">
          <AdminSuspiciousLogins />
        </TabsContent>

        <TabsContent value="ipblock" className="space-y-4 mt-4">
          <AdminIPBlocking />
        </TabsContent>

        <TabsContent value="whitelist" className="space-y-4 mt-4">
          <AdminIPWhitelist />
        </TabsContent>

        <TabsContent value="2fa" className="space-y-4 mt-4">
          <Admin2FASettings />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
