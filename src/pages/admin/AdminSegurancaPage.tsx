/**
 * AdminSegurancaPage - Hub de segurança
 * Rota: /admin/seguranca
 * Abas: Alerts, Monitor, Analytics, Escalation, Logins, IP Block, Whitelist, 2FA
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResponsiveTabs } from "@/components/admin/ResponsiveTabs";
import { Search, Shield, AlertTriangle, Eye, BarChart3, ArrowUpCircle, Lock, Ban, CheckCircle, Key } from "lucide-react";
import AdminSecurityAlerts from "../AdminSecurityAlerts";
import AdminSecurityMonitor from "../AdminSecurityMonitor";
import AdminSecurityAnalytics from "../AdminSecurityAnalytics";
import AdminSecurityEscalation from "../AdminSecurityEscalation";
import AdminSuspiciousLogins from "../AdminSuspiciousLogins";
import AdminIPBlocking from "../AdminIPBlocking";
import AdminIPWhitelist from "../AdminIPWhitelist";
import Admin2FASettings from "../Admin2FASettings";
import { SecurityAuditDashboard } from "@/components/admin/security/SecurityAuditDashboard";
import AdminRLSCoverage from "../AdminRLSCoverage";

export default function AdminSegurancaPage() {
  const [activeTab, setActiveTab] = useState("audit");

  const tabs = [
    {
      value: "audit",
      label: "Audit",
      icon: <Search className="h-4 w-4" />,
      content: <SecurityAuditDashboard />
    },
    {
      value: "rls",
      label: "RLS",
      icon: <Shield className="h-4 w-4" />,
      content: <AdminRLSCoverage />
    },
    {
      value: "alerts",
      label: "Alertas",
      icon: <AlertTriangle className="h-4 w-4" />,
      content: <AdminSecurityAlerts />
    },
    {
      value: "monitor",
      label: "Monitor",
      icon: <Eye className="h-4 w-4" />,
      content: <AdminSecurityMonitor />
    },
    {
      value: "analytics",
      label: "Analytics",
      icon: <BarChart3 className="h-4 w-4" />,
      content: <AdminSecurityAnalytics />
    },
    {
      value: "escalation",
      label: "Escalation",
      icon: <ArrowUpCircle className="h-4 w-4" />,
      content: <AdminSecurityEscalation />
    },
    {
      value: "logins",
      label: "Logins",
      icon: <Lock className="h-4 w-4" />,
      content: <AdminSuspiciousLogins />
    },
    {
      value: "ipblock",
      label: "IP Block",
      icon: <Ban className="h-4 w-4" />,
      content: <AdminIPBlocking />
    },
    {
      value: "whitelist",
      label: "Whitelist",
      icon: <CheckCircle className="h-4 w-4" />,
      content: <AdminIPWhitelist />
    },
    {
      value: "2fa",
      label: "2FA",
      icon: <Key className="h-4 w-4" />,
      content: <Admin2FASettings />
    }
  ];

  return (
    <AdminShell 
      title="Centro de Segurança"
      description="Monitoramento, alertas e controle de acesso"
    >
      <ResponsiveTabs
        defaultValue="audit"
        value={activeTab}
        onValueChange={setActiveTab}
        tabs={tabs}
      />
    </AdminShell>
  );
}
