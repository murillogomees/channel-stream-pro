import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, AdminLayout } from "@/components/admin";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminAnalytics from "./AdminAnalytics";
import AdminCoupons from "./AdminCoupons";
import { StreamingDashboard } from "@/components/admin/streaming";

export default function AdminAnalyticsHub() {
  return (
    <AdminLayout>
      <PageHeader
        title="Analytics & Performance"
        description="Métricas gerais, streaming e gestão de cupons"
        backTo="/admin/dashboard"
      />

      <Tabs defaultValue="streaming" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="streaming" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🎬 Streaming
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              📊 Analytics
            </TabsTrigger>
            <TabsTrigger value="coupons" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🎟️ Cupons
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="streaming" className="space-y-4 mt-4">
          <StreamingDashboard />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 mt-4">
          <AdminAnalytics />
        </TabsContent>

        <TabsContent value="coupons" className="space-y-4 mt-4">
          <AdminCoupons />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
