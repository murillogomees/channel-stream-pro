/**
 * AdminIntegracaoPage - Hub de integrações redesenhado
 * Rota: /admin/integracao
 * Design enterprise com hierarquia visual clara e cores semânticas
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { IntegrationTabs } from "@/components/admin/integration";
import { 
  CreditCard, 
  FileText, 
  MessageCircle, 
  Globe, 
  RefreshCw, 
  Zap, 
  TestTube,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import AdminWhatsAppConfig from "../AdminWhatsAppConfig";
import AdminCdn from "../AdminCdn";
import AdminTranscodeQueue from "../AdminTranscodeQueue";
import AdminSmartCache from "../AdminSmartCache";
import AdminQADashboard from "../AdminQADashboard";
import MercadoPagoIntegration from "@/components/admin/mercadopago/MercadoPagoIntegration";
import PaymentVariablesAdmin from "@/components/admin/payment/PaymentVariablesAdmin";
import { IntegrationCard } from "@/components/admin/integration";

// Section header component
function SectionHeader({ 
  title, 
  description,
  status
}: { 
  title: string; 
  description: string;
  status?: "configured" | "pending" | "error";
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground font-heading">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {description}
        </p>
      </div>
      {status && (
        <div className="flex items-center gap-2 text-xs font-medium">
          {status === "configured" && (
            <>
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-success">Configurado</span>
            </>
          )}
          {status === "pending" && (
            <>
              <AlertCircle className="h-4 w-4 text-warning" />
              <span className="text-warning">Pendente</span>
            </>
          )}
          {status === "error" && (
            <>
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-destructive">Erro</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Mercado Pago Tab Content
function MercadoPagoTab() {
  return (
    <div className="space-y-6">
      <SectionHeader 
        title="Integração Mercado Pago" 
        description="Configure pagamentos via PIX, cartão e boleto"
      />
      <MercadoPagoIntegration />
    </div>
  );
}

// Payment Variables Tab Content  
function PaymentVariablesTab() {
  return (
    <div className="space-y-6">
      <SectionHeader 
        title="Variáveis de Pagamento" 
        description="APIs, endpoints e variáveis do fluxo de checkout"
      />
      <PaymentVariablesAdmin />
    </div>
  );
}

// WhatsApp Tab Content
function WhatsAppTab() {
  return (
    <div className="space-y-6">
      <SectionHeader 
        title="Integração WhatsApp" 
        description="Configure notificações automáticas via WhatsApp"
      />
      <AdminWhatsAppConfig />
    </div>
  );
}

// CDN Tab Content
function CDNTab() {
  return (
    <div className="space-y-6">
      <SectionHeader 
        title="CDN & Storage" 
        description="Cloudflare R2, roteamento de conteúdo e downloads"
      />
      <AdminCdn />
    </div>
  );
}

// Transcode Tab Content
function TranscodeTab() {
  return (
    <div className="space-y-6">
      <SectionHeader 
        title="Transcode Queue" 
        description="Processamento de mídia e conversão de formatos"
      />
      <AdminTranscodeQueue />
    </div>
  );
}

// Smart Cache Tab Content
function SmartCacheTab() {
  return (
    <div className="space-y-6">
      <SectionHeader 
        title="Smart Cache" 
        description="Regras de cache, invalidação e otimização de performance"
      />
      <AdminSmartCache />
    </div>
  );
}

// QA Dashboard Tab Content
function QADashboardTab() {
  return (
    <div className="space-y-6">
      <SectionHeader 
        title="QA Dashboard" 
        description="Ferramentas de debug, logs e diagnósticos do sistema"
      />
      <AdminQADashboard />
    </div>
  );
}

export default function AdminIntegracaoPage() {
  const [activeTab, setActiveTab] = useState("mercadopago");

  const tabs = [
    {
      value: "mercadopago",
      label: "Mercado Pago",
      icon: CreditCard,
      variant: "payment" as const,
      content: <MercadoPagoTab />
    },
    {
      value: "payment-vars",
      label: "Variáveis API",
      icon: FileText,
      variant: "payment" as const,
      content: <PaymentVariablesTab />
    },
    {
      value: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      variant: "messaging" as const,
      content: <WhatsAppTab />
    },
    {
      value: "cdn",
      label: "CDN",
      icon: Globe,
      variant: "cdn" as const,
      content: <CDNTab />
    },
    {
      value: "transcode",
      label: "Transcode",
      icon: RefreshCw,
      variant: "transcode" as const,
      content: <TranscodeTab />
    },
    {
      value: "cache",
      label: "Smart Cache",
      icon: Zap,
      variant: "cache" as const,
      content: <SmartCacheTab />
    },
    {
      value: "qa",
      label: "QA Dashboard",
      icon: TestTube,
      variant: "qa" as const,
      content: <QADashboardTab />
    }
  ];

  return (
    <AdminShell>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-heading">
          Integrações & Ferramentas
        </h1>
        <p className="text-muted-foreground mt-1">
          Mercado Pago, WhatsApp, CDN e ferramentas de desenvolvimento
        </p>
        
        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <IntegrationCard variant="payment" className="py-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-medium">Pagamentos</span>
            </div>
          </IntegrationCard>
          <IntegrationCard variant="messaging" className="py-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-medium">WhatsApp</span>
            </div>
          </IntegrationCard>
          <IntegrationCard variant="cdn" className="py-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-medium">CDN R2</span>
            </div>
          </IntegrationCard>
          <IntegrationCard variant="cache" className="py-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-medium">Cache</span>
            </div>
          </IntegrationCard>
        </div>
      </div>

      {/* Integration Tabs */}
      <IntegrationTabs
        tabs={tabs}
        defaultValue="mercadopago"
        value={activeTab}
        onValueChange={setActiveTab}
      />
    </AdminShell>
  );
}
