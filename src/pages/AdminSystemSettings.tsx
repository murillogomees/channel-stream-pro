import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, AdminLayout } from "@/components/admin";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminBackupSystem from "./AdminBackupSystem";
import AdminCustomize from "./AdminCustomize";
import AdminStatusHistory from "./AdminStatusHistory";
import AdminCustomStatusBadges from "./AdminCustomStatusBadges";
import { MigrationDashboard } from "@/components/admin/MigrationDashboard";
import { MigrationStats } from "@/components/migrations/MigrationStats";
import { MigrationScanner } from "@/components/admin/MigrationScanner";
import { DriftFindingsTable } from "@/components/migrations/DriftFindingsTable";
import { RLSAuditPanel } from "@/components/admin/RLSAuditPanel";
import { MigrationHistory } from "@/components/migrations/MigrationHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

function SystemHealthPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Saúde do Sistema
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Sistema operacional. Todas as integrações ativas.</p>
      </CardContent>
    </Card>
  );
}

export default function AdminSystemSettings() {
  return (
    <AdminLayout>
      <PageHeader
        title="Sistema & Configurações"
        description="Migrações, RLS e configurações avançadas"
        backTo="/admin/dashboard"
      />

      <Tabs defaultValue="health" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="health" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Saúde
            </TabsTrigger>
            <TabsTrigger value="migrations" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Migrações
            </TabsTrigger>
            <TabsTrigger value="rls" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              RLS
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Backup
            </TabsTrigger>
            <TabsTrigger value="customize" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Customizar
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Histórico
            </TabsTrigger>
            <TabsTrigger value="badges" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              Badges
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="health" className="space-y-4 mt-4">
          <SystemHealthPlaceholder />
        </TabsContent>

        <TabsContent value="migrations" className="space-y-4 mt-4">
          <div className="space-y-6">
            <MigrationStats />
            <MigrationDashboard />
            <MigrationScanner />
            <DriftFindingsTable />
            <MigrationHistory />
          </div>
        </TabsContent>

        <TabsContent value="rls" className="space-y-4 mt-4">
          <RLSAuditPanel />
        </TabsContent>

        <TabsContent value="backup" className="space-y-4 mt-4">
          <AdminBackupSystem />
        </TabsContent>

        <TabsContent value="customize" className="space-y-4 mt-4">
          <AdminCustomize />
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <AdminStatusHistory />
        </TabsContent>

        <TabsContent value="badges" className="space-y-4 mt-4">
          <AdminCustomStatusBadges />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
