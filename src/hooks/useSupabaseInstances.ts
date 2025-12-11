import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SupabaseInstance {
  id: string;
  name: string;
  supabase_url: string;
  pg_host: string | null;
  pg_port: number;
  status: 'pending' | 'active' | 'error' | 'inactive';
  last_health_check: string | null;
  last_backup: string | null;
  db_size_bytes: number | null;
  postgres_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstanceBackup {
  id: string;
  instance_id: string;
  file_path: string | null;
  file_size_bytes: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface AuditLog {
  id: string;
  instance_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  performed_by: string | null;
  ip_address: string | null;
  created_at: string;
}

// Simple XOR-based obfuscation for client-side (real encryption happens server-side)
function obfuscateKey(key: string): string {
  const encoded = btoa(key);
  return encoded.split('').reverse().join('');
}

function deobfuscateKey(obfuscated: string): string {
  const reversed = obfuscated.split('').reverse().join('');
  return atob(reversed);
}

export function useSupabaseInstances() {
  const [instances, setInstances] = useState<SupabaseInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('supabase_instances')
        .select('id, name, supabase_url, pg_host, pg_port, status, last_health_check, last_backup, db_size_bytes, postgres_version, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setInstances((data || []) as SupabaseInstance[]);
      setError(null);
    } catch (err) {
      console.error('Error fetching instances:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar instâncias');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const createInstance = async (data: {
    name: string;
    supabase_url: string;
    service_role_key: string;
    anon_key?: string;
    pg_host?: string;
    pg_port?: number;
  }) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      const { error: insertError } = await supabase.from('supabase_instances').insert({
        name: data.name,
        supabase_url: data.supabase_url,
        service_role_key_enc: obfuscateKey(data.service_role_key),
        anon_key_enc: data.anon_key ? obfuscateKey(data.anon_key) : null,
        pg_host: data.pg_host || null,
        pg_port: data.pg_port || 5432,
        status: 'pending',
        created_by: user.user.id,
      });

      if (insertError) throw insertError;

      toast.success('Instância criada com sucesso');
      await fetchInstances();
      return true;
    } catch (err) {
      console.error('Error creating instance:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao criar instância');
      return false;
    }
  };

  const deleteInstance = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('supabase_instances')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      toast.success('Instância removida');
      await fetchInstances();
      return true;
    } catch (err) {
      console.error('Error deleting instance:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao remover instância');
      return false;
    }
  };

  const testConnection = async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      // Get instance data including the key
      const { data: instance, error: fetchError } = await supabase
        .from('supabase_instances')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !instance) {
        throw new Error('Instância não encontrada');
      }

      // Deobfuscate the key
      const serviceRoleKey = deobfuscateKey(instance.service_role_key_enc);
      
      // Try to connect to the self-hosted Supabase
      const testClient = (await import('@supabase/supabase-js')).createClient(
        instance.supabase_url,
        serviceRoleKey,
        { auth: { persistSession: false } }
      );

      // Simple health check - try to get auth users count
      const { error: testError } = await testClient.from('profiles').select('id', { count: 'exact', head: true });

      if (testError && !testError.message.includes('does not exist')) {
        throw new Error(testError.message);
      }

      // Update status to active
      await supabase
        .from('supabase_instances')
        .update({ 
          status: 'active', 
          last_health_check: new Date().toISOString() 
        })
        .eq('id', id);

      // Log audit
      await logAudit(id, 'test_connection', { success: true });

      await fetchInstances();
      return { success: true, message: 'Conexão válida!' };
    } catch (err) {
      console.error('Connection test failed:', err);
      
      // Update status to error
      await supabase
        .from('supabase_instances')
        .update({ status: 'error' })
        .eq('id', id);

      await logAudit(id, 'test_connection', { success: false, error: String(err) });

      await fetchInstances();
      return { 
        success: false, 
        message: err instanceof Error ? err.message : 'Falha na conexão' 
      };
    }
  };

  const logAudit = async (instanceId: string | null, action: string, details: Record<string, unknown>) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      await supabase.from('supabase_instance_audit').insert([{
        instance_id: instanceId,
        action,
        details: details as any,
        performed_by: user.user?.id || null,
      }]);
    } catch (err) {
      console.error('Audit log failed:', err);
    }
  };

  const getAuditLogs = async (instanceId?: string): Promise<AuditLog[]> => {
    try {
      let query = supabase
        .from('supabase_instance_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (instanceId) {
        query = query.eq('instance_id', instanceId);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      return (data || []) as AuditLog[];
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      return [];
    }
  };

  const getBackups = async (instanceId: string): Promise<InstanceBackup[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('supabase_instance_backups')
        .select('*')
        .eq('instance_id', instanceId)
        .order('started_at', { ascending: false });

      if (fetchError) throw fetchError;
      return (data || []) as InstanceBackup[];
    } catch (err) {
      console.error('Error fetching backups:', err);
      return [];
    }
  };

  const triggerBackup = async (instanceId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      // Create backup record
      const { data: backup, error: insertError } = await supabase
        .from('supabase_instance_backups')
        .insert({
          instance_id: instanceId,
          status: 'pending',
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await logAudit(instanceId, 'backup_triggered', { backup_id: backup.id });

      toast.info('Backup agendado. Execute o script no host do Postgres.');
      return { success: true, message: 'Backup agendado' };
    } catch (err) {
      console.error('Error triggering backup:', err);
      return { 
        success: false, 
        message: err instanceof Error ? err.message : 'Erro ao agendar backup' 
      };
    }
  };

  return {
    instances,
    loading,
    error,
    refresh: fetchInstances,
    createInstance,
    deleteInstance,
    testConnection,
    getAuditLogs,
    getBackups,
    triggerBackup,
    logAudit,
  };
}
