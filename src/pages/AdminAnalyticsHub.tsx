import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminAnalytics from "./AdminAnalytics";
import AdminConversionDashboard from "./AdminConversionDashboard";
import AdminCoupons from "./AdminCoupons";
import { StreamingDashboard } from "@/components/admin/streaming";

export default function AdminAnalyticsHub() {
  return (
    <div className="container mx-auto p-3 sm:p-6 max-w-7xl overflow-x-hidden">
      <PageHeader
        title="Analytics & Performance"
        description="Métricas gerais, streaming, conversão e gestão de cupons"
      />

      <Tabs defaultValue="streaming" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-auto min-w-full p-1">
            <TabsTrigger value="streaming" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">
              🎬 Streaming
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">
              📊 Analytics Gerais
            </TabsTrigger>
            <TabsTrigger value="conversion" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">
              🎯 Conversão
            </TabsTrigger>
            <TabsTrigger value="coupons" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">
              🎟️ Cupons
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="streaming" className="space-y-4">
          <StreamingDashboard />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AdminAnalytics />
        </TabsContent>

        <TabsContent value="conversion" className="space-y-4">
          <AdminConversionDashboard />
        </TabsContent>

        <TabsContent value="coupons" className="space-y-4">
          <AdminCoupons />
        </TabsContent>
      </Tabs>
    </div>
  );
}
