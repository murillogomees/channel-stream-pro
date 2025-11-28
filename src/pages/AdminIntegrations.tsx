import { PageHeader } from "@/components/admin/PageHeader";
import AdminWhatsAppConfig from "./AdminWhatsAppConfig";

export default function AdminIntegrations() {
  return (
    <div className="container mx-auto p-3 sm:p-6 max-w-7xl overflow-x-hidden">
      <PageHeader
        title="Integrações Externas"
        description="Gerenciamento de integrações com serviços externos"
      />

      <AdminWhatsAppConfig />
    </div>
  );
}
