import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import AdminAnalytics from "./AdminAnalytics";
import AdminConversionDashboard from "./AdminConversionDashboard";
import AdminCoupons from "./AdminCoupons";

export default function AdminAnalyticsHub() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <PageHeader
        title="Analytics & Conversão"
        description="Métricas, análise de conversão e gestão de cupons"
      />

      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analytics">Analytics Gerais</TabsTrigger>
          <TabsTrigger value="conversion">Conversão</TabsTrigger>
          <TabsTrigger value="coupons">Cupons</TabsTrigger>
        </TabsList>

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
