import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import AdminAnalytics from "./AdminAnalytics";
import AdminConversionDashboard from "./AdminConversionDashboard";
import AdminCoupons from "./AdminCoupons";

export default function AdminAnalyticsHub() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Analytics & Conversão</h1>
      </div>

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
