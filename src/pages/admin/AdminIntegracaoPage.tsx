/**
 * AdminIntegracaoPage - Hub de integrações
 * Rota: /admin/integracao
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { 
  CreditCard, 
  MessageCircle, 
  TestTube,
  Flame,
  Users
} from "lucide-react";
import AdminWhatsAppConfig from "../AdminWhatsAppConfig";
import AdminQADashboard from "../AdminQADashboard";
import { MercadoPagoUnifiedIntegration } from "@/components/admin/mercadopago/MercadoPagoUnifiedIntegration";
import { SigmaBlazeIntegration } from "@/components/admin/sigma/SigmaBlazeIntegration";
import { SigmaClientsPage } from "@/components/admin/sigma/SigmaClientsPage";

export default function AdminIntegracaoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "mercadopago";
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && t !== activeTab) setActiveTab(t);
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value }, { replace: true });
  };

  const tabs = [
    {
      value: "mercadopago",
      label: "Mercado Pago",
      icon: <CreditCard className="h-4 w-4" />,
      content: <MercadoPagoUnifiedIntegration />
    },
    {
      value: "sigma",
      label: "Sigma Blaze",
      icon: <Flame className="h-4 w-4" />,
      content: <SigmaBlazeIntegration />
    },
    {
      value: "sigma-clients",
      label: "Clientes Sigma",
      icon: <Users className="h-4 w-4" />,
      content: <SigmaClientsPage />
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
      description="Mercado Pago, Sigma Blaze, WhatsApp e ferramentas de debug"
    >
      <ResponsiveTabs
        defaultValue="mercadopago"
        value={activeTab}
        onValueChange={handleTabChange}
        tabs={tabs}
      />
    </AdminShell>
  );
}
