/**
 * AdminIntegracaoPage - Hub de integrações
 * Rota: /admin/integracao
 * Abas: Mercado Pago, Variáveis de Pagamento, WhatsApp, CDN, Transcode, Smart Cache
 */

import { AdminShell } from "@/components/admin/AdminShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminWhatsAppConfig from "../AdminWhatsAppConfig";
import AdminCdn from "../AdminCdn";
import AdminTranscodeQueue from "../AdminTranscodeQueue";
import AdminSmartCache from "../AdminSmartCache";
import AdminRLSCoverage from "../AdminRLSCoverage";
import AdminQADashboard from "../AdminQADashboard";
import MercadoPagoIntegration from "@/components/admin/mercadopago/MercadoPagoIntegration";
import PaymentVariablesAdmin from "@/components/admin/payment/PaymentVariablesAdmin";

export default function AdminIntegracaoPage() {
  return (
    <AdminShell 
      title="Integrações & Ferramentas"
      description="Mercado Pago, WhatsApp, CDN e ferramentas de debug"
    >
      <Tabs defaultValue="mercadopago" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="mercadopago" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              💳 Mercado Pago
            </TabsTrigger>
            <TabsTrigger value="payment-vars" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              📋 Variáveis API
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              💬 WhatsApp
            </TabsTrigger>
            <TabsTrigger value="cdn" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🌐 CDN
            </TabsTrigger>
            <TabsTrigger value="transcode" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🔄 Transcode
            </TabsTrigger>
            <TabsTrigger value="cache" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              ⚡ Smart Cache
            </TabsTrigger>
            <TabsTrigger value="rls" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🔒 RLS Coverage
            </TabsTrigger>
            <TabsTrigger value="qa" className="flex-shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              🧪 QA Dashboard
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="mercadopago" className="space-y-4 mt-4">
          <MercadoPagoIntegration />
        </TabsContent>

        <TabsContent value="payment-vars" className="space-y-4 mt-4">
          <PaymentVariablesAdmin />
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4 mt-4">
          <AdminWhatsAppConfig />
        </TabsContent>

        <TabsContent value="cdn" className="space-y-4 mt-4">
          <AdminCdn />
        </TabsContent>

        <TabsContent value="transcode" className="space-y-4 mt-4">
          <AdminTranscodeQueue />
        </TabsContent>

        <TabsContent value="cache" className="space-y-4 mt-4">
          <AdminSmartCache />
        </TabsContent>

        <TabsContent value="rls" className="space-y-4 mt-4">
          <AdminRLSCoverage />
        </TabsContent>

        <TabsContent value="qa" className="space-y-4 mt-4">
          <AdminQADashboard />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
