/**
 * Profiles Migration Service
 * Handles migration from clientes → profiles table
 */

import { supabase } from '@/integrations/supabase/client';

export interface MigrationJob {
  job_id: string;
  started_at: string;
  finished_at: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  batch_size: number;
  total_records: number;
  processed_records: number;
  success_count: number;
  error_count: number;
  summary: Record<string, unknown> | null;
  created_by: string | null;
}

export interface MigrationLog {
  id: number;
  job_id: string;
  cliente_id: string | null;
  profile_id: string | null;
  action: string;
  field_mapping: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
}

export interface FeatureFlag {
  id: string;
  flag_name: string;
  enabled: boolean;
  description: string | null;
  updated_at: string;
}

export interface MigrationStats {
  totalClientes: number;
  totalProfiles: number;
  migratedProfiles: number;
  pendingMigration: number;
  errorCount: number;
  successRate: number;
}

class ProfilesMigrationService {
  /**
   * Check if USE_PROFILES_ONLY flag is enabled
   */
  async isProfilesOnlyMode(): Promise<boolean> {
    const { data } = await (supabase
      .from('app_feature_flags')
      .select('enabled')
      .eq('flag_name', 'USE_PROFILES_ONLY')
      .single() as any);
    
    return data?.enabled ?? false;
  }

  /**
   * Get feature flag status
   */
  async getFeatureFlag(): Promise<FeatureFlag | null> {
    const { data, error } = await (supabase
      .from('app_feature_flags')
      .select('*')
      .eq('flag_name', 'USE_PROFILES_ONLY')
      .single() as any);
    
    if (error) {
      console.error('Error fetching feature flag:', error);
      return null;
    }
    
    return data;
  }

  /**
   * Toggle USE_PROFILES_ONLY flag
   */
  async toggleProfilesOnlyMode(enabled: boolean): Promise<boolean> {
    const { error } = await (supabase
      .from('app_feature_flags')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('flag_name', 'USE_PROFILES_ONLY') as any);
    
    if (error) {
      console.error('Error toggling feature flag:', error);
      return false;
    }
    
    return true;
  }

  /**
   * Get migration statistics
   */
  async getStats(): Promise<MigrationStats> {
    const [clientesRes, profilesRes, migratedRes, errorsRes] = await Promise.all([
      (supabase.from('clientes').select('*', { count: 'exact', head: true }) as any),
      (supabase.from('profiles').select('*', { count: 'exact', head: true }) as any),
      (supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('migrated_from_clientes', true) as any),
      (supabase.from('profiles_migration_logs').select('*', { count: 'exact', head: true }).eq('action', 'failed') as any),
    ]);

    const totalClientes = clientesRes.count || 0;
    const totalProfiles = profilesRes.count || 0;
    const migratedProfiles = migratedRes.count || 0;
    const errorCount = errorsRes.count || 0;

    return {
      totalClientes,
      totalProfiles,
      migratedProfiles,
      pendingMigration: totalClientes - migratedProfiles,
      errorCount,
      successRate: totalClientes > 0 ? (migratedProfiles / totalClientes) * 100 : 0,
    };
  }

  /**
   * Get all migration jobs
   */
  async getJobs(): Promise<MigrationJob[]> {
    const { data, error } = await (supabase
      .from('profiles_migration_jobs')
      .select('*')
      .order('started_at', { ascending: false }) as any);
    
    if (error) {
      console.error('Error fetching migration jobs:', error);
      return [];
    }
    
    return data || [];
  }

  /**
   * Get logs for a specific job
   */
  async getJobLogs(jobId: string, limit = 100): Promise<MigrationLog[]> {
    const { data, error } = await (supabase
      .from('profiles_migration_logs')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(limit) as any);
    
    if (error) {
      console.error('Error fetching migration logs:', error);
      return [];
    }
    
    return data || [];
  }

  /**
   * Start a new migration job
   */
  async startMigration(batchSize = 100): Promise<MigrationJob | null> {
    // Get total clientes count
    const { count: totalCount } = await (supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true }) as any);

    // Create job
    const { data: job, error: jobError } = await (supabase
      .from('profiles_migration_jobs')
      .insert({
        status: 'running',
        batch_size: batchSize,
        total_records: totalCount || 0,
      })
      .select()
      .single() as any);

    if (jobError || !job) {
      console.error('Error creating migration job:', jobError);
      return null;
    }

    // Start first batch
    await this.runBatch(job.job_id, batchSize);

    return job;
  }

  /**
   * Run a migration batch
   */
  async runBatch(jobId: string, batchSize = 100): Promise<{ processed: number; completed: boolean }> {
    const { data, error } = await supabase
      .rpc('run_profiles_migration_batch', {
        p_job_id: jobId,
        p_batch_size: batchSize,
      });

    if (error) {
      console.error('Error running migration batch:', error);
      return { processed: 0, completed: true };
    }

    const result = data as unknown as { processed?: number; completed?: boolean } | null;
    return {
      processed: result?.processed || 0,
      completed: result?.completed ?? true,
    };
  }

  /**
   * Continue running migration until complete
   */
  async continueMigration(jobId: string, batchSize = 100, onProgress?: (job: MigrationJob) => void): Promise<void> {
    let completed = false;
    
    while (!completed) {
      const result = await this.runBatch(jobId, batchSize);
      completed = result.completed;
      
      if (onProgress) {
        const jobs = await this.getJobs();
        const job = jobs.find(j => j.job_id === jobId);
        if (job) onProgress(job);
      }
      
      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Pause a running migration
   */
  async pauseMigration(jobId: string): Promise<boolean> {
    const { error } = await (supabase
      .from('profiles_migration_jobs')
      .update({ status: 'paused' })
      .eq('job_id', jobId) as any);
    
    return !error;
  }

  /**
   * Get clientes that failed migration
   */
  async getFailedMigrations(jobId?: string): Promise<MigrationLog[]> {
    let query = supabase
      .from('profiles_migration_logs')
      .select('*')
      .eq('action', 'failed')
      .order('created_at', { ascending: false });
    
    if (jobId) {
      query = query.eq('job_id', jobId);
    }

    const { data, error } = await (query.limit(100) as any);
    
    if (error) {
      console.error('Error fetching failed migrations:', error);
      return [];
    }
    
    return data || [];
  }

  /**
   * Retry a failed migration for a specific cliente
   */
  async retryMigration(clienteId: string): Promise<boolean> {
    // Get cliente data
    const { data: cliente, error: clienteError } = await (supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .single() as any);

    if (clienteError || !cliente) {
      console.error('Error fetching cliente:', clienteError);
      return false;
    }

    // Find matching profile
    const { data: profile } = await (supabase
      .from('profiles')
      .select('id')
      .or(`user_id.eq.${cliente.user_id},email.eq.${cliente.email}`)
      .single() as any);

    if (!profile) {
      console.error('No matching profile found for cliente:', clienteId);
      return false;
    }

    // Update profile with cliente data
    const { error: updateError } = await (supabase
      .from('profiles')
      .update({
        nome: cliente.nome,
        telefone: cliente.telefone,
        situacao: cliente.situacao,
        plano: cliente.plano,
        data_vencimento: cliente.data_vencimento,
        data_contratacao: cliente.data_contratacao,
        valor_pago: cliente.valor_pago,
        cliente_ativo: cliente.cliente_ativo,
        migrated_from_clientes: true,
        cliente_legacy_id: cliente.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id) as any);

    return !updateError;
  }

  /**
   * Export migration logs to CSV
   */
  async exportLogsCSV(jobId: string): Promise<string> {
    const logs = await this.getJobLogs(jobId, 10000);
    
    const headers = ['ID', 'Job ID', 'Cliente ID', 'Profile ID', 'Action', 'Error', 'Created At'];
    const rows = logs.map(log => [
      log.id,
      log.job_id,
      log.cliente_id || '',
      log.profile_id || '',
      log.action,
      log.error || '',
      log.created_at,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    return csv;
  }

  /**
   * Validate migration completeness
   */
  async validateMigration(): Promise<{
    isValid: boolean;
    issues: string[];
    matchRate: number;
  }> {
    const issues: string[] = [];

    // Check counts
    const stats = await this.getStats();
    
    if (stats.migratedProfiles < stats.totalClientes) {
      issues.push(`${stats.pendingMigration} clientes ainda não migrados`);
    }

    if (stats.errorCount > 0) {
      issues.push(`${stats.errorCount} erros durante migração`);
    }

    // Check for missing critical fields
    const { count: missingNome } = await (supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('migrated_from_clientes', true)
      .is('nome', null) as any);

    if (missingNome && missingNome > 0) {
      issues.push(`${missingNome} perfis migrados sem nome`);
    }

    const matchRate = stats.totalClientes > 0 
      ? (stats.migratedProfiles / stats.totalClientes) * 100 
      : 100;

    return {
      isValid: issues.length === 0 && matchRate >= 99.5,
      issues,
      matchRate,
    };
  }
}

export const profilesMigrationService = new ProfilesMigrationService();
