/**
 * AdminIntegracaoPage - Hub de integrações
 * Rota: /admin/integracao
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { 
  CreditCard, 
  FileText, 
  MessageCircle, 
  Globe, 
  Zap, 
  TestTube
} from "lucide-react";
import AdminWhatsAppConfig from "../AdminWhatsAppConfig";
import AdminCdn from "../AdminCdn";
import AdminSmartCache from "../AdminSmartCache";
import AdminQADashboard from "../AdminQADashboard";
import MercadoPagoIntegration from "@/components/admin/mercadopago/MercadoPagoIntegration";
import PaymentVariablesAdmin from "@/components/admin/payment/PaymentVariablesAdmin";

export default function AdminIntegracaoPage() {
  const [activeTab, setActiveTab] = useState("mercadopago");

  const tabs = [
    {
      value: "mercadopago",
      label: "Mercado Pago",
      icon: <CreditCard className="h-4 w-4" />,
      content: <MercadoPagoIntegration />
    },
    {
      value: "payment-vars",
      label: "Variáveis API",
      icon: <FileText className="h-4 w-4" />,
      content: <PaymentVariablesAdmin />
    },
    {
      value: "whatsapp",
      label: "WhatsApp",
      icon: <MessageCircle className="h-4 w-4" />,
      content: <AdminWhatsAppConfig />
    },
    {
      value: "cdn",
      label: "CDN",
      icon: <Globe className="h-4 w-4" />,
      content: <AdminCdn />
    },
    {
      value: "cache",
      label: "Smart Cache",
      icon: <Zap className="h-4 w-4" />,
      content: <AdminSmartCache />
    },
    {
      value: "qa",
      label: "QA Dashboard",
      icon: <TestTube className="h-4 w-4" />,
      content: <AdminQADashboard />
    }
  ];

  return (
    <AdminShell 
      title="Integrações & Ferramentas"
      description="Mercado Pago, WhatsApp, CDN e ferramentas de debug"
    >
      <ResponsiveTabs
        defaultValue="mercadopago"
        value={activeTab}
        onValueChange={setActiveTab}
        tabs={tabs}
      />
    </AdminShell>
  );
}
