import { useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { InstanceForm } from '@/components/admin/supabase-integration/InstanceForm';
import { InstanceList } from '@/components/admin/supabase-integration/InstanceList';
import { InstanceDashboard } from '@/components/admin/supabase-integration/InstanceDashboard';
import { useSupabaseInstances, SupabaseInstance } from '@/hooks/useSupabaseInstances';
import { toast } from 'sonner';

export default function AdminSupabaseIntegrationPage() {
  const {
    instances,
    loading,
    refresh,
    createInstance,
    deleteInstance,
    testConnection,
  } = useSupabaseInstances();

  const [selectedInstance, setSelectedInstance] = useState<SupabaseInstance | null>(null);

  const handleTest = async (id: string) => {
    const result = await testConnection(id);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    return result;
  };

  if (selectedInstance) {
    return (
      <AdminShell 
        title={selectedInstance.name} 
        description="Dashboard da instância Supabase"
      >
        <InstanceDashboard 
          instance={selectedInstance} 
          onBack={() => setSelectedInstance(null)} 
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Integração Supabase Self-Hosted"
      description="Gerencie instâncias Supabase self-hosted: conexão, backups, health e auditoria"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InstanceForm onSubmit={createInstance} loading={loading} />
        <InstanceList
          instances={instances}
          loading={loading}
          onTest={handleTest}
          onDelete={deleteInstance}
          onRefresh={refresh}
          onSelect={setSelectedInstance}
        />
      </div>
    </AdminShell>
  );
}
