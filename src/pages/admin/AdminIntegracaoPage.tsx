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
  TestTube
} from "lucide-react";
import AdminWhatsAppConfig from "../AdminWhatsAppConfig";
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
      value: "qa",
      label: "QA Dashboard",
      icon: <TestTube className="h-4 w-4" />,
      content: <AdminQADashboard />
    }
  ];

  return (
    <AdminShell 
      title="Integrações & Ferramentas"
      description="Mercado Pago, WhatsApp e ferramentas de debug"
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
