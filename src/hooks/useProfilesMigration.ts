/**
 * Hook for managing profiles migration
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  profilesMigrationService, 
  MigrationJob, 
  MigrationLog, 
  MigrationStats,
  FeatureFlag 
} from '@/services/profilesMigrationService';
import { useToast } from '@/hooks/use-toast';

export function useProfilesMigration() {
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [jobs, setJobs] = useState<MigrationJob[]>([]);
  const [currentJob, setCurrentJob] = useState<MigrationJob | null>(null);
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [featureFlag, setFeatureFlag] = useState<FeatureFlag | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsData, jobsData, flagData] = await Promise.all([
        profilesMigrationService.getStats(),
        profilesMigrationService.getJobs(),
        profilesMigrationService.getFeatureFlag(),
      ]);
      
      setStats(statsData);
      setJobs(jobsData);
      setFeatureFlag(flagData);
      
      // Set current job if one is running
      const runningJob = jobsData.find(j => j.status === 'running');
      if (runningJob) {
        setCurrentJob(runningJob);
        const logsData = await profilesMigrationService.getJobLogs(runningJob.job_id);
        setLogs(logsData);
      }
    } catch (error) {
      console.error('Error fetching migration data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar dados da migração',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startMigration = useCallback(async (batchSize = 100) => {
    setIsRunning(true);
    try {
      const job = await profilesMigrationService.startMigration(batchSize);
      if (job) {
        setCurrentJob(job);
        toast({
          title: 'Migração iniciada',
          description: `Job ${job.job_id} criado com sucesso`,
        });
        
        // Continue migration in background
        await profilesMigrationService.continueMigration(
          job.job_id, 
          batchSize,
          (updatedJob) => {
            setCurrentJob(updatedJob);
          }
        );
        
        toast({
          title: 'Migração concluída',
          description: 'Todos os registros foram processados',
        });
        
        await fetchData();
      }
    } catch (error) {
      console.error('Error starting migration:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar a migração',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  }, [toast, fetchData]);

  const pauseMigration = useCallback(async () => {
    if (!currentJob) return;
    
    const success = await profilesMigrationService.pauseMigration(currentJob.job_id);
    if (success) {
      setIsRunning(false);
      toast({
        title: 'Migração pausada',
        description: 'A migração foi pausada com sucesso',
      });
      await fetchData();
    }
  }, [currentJob, toast, fetchData]);

  const toggleFeatureFlag = useCallback(async () => {
    if (!featureFlag) return;
    
    // Validate before enabling
    if (!featureFlag.enabled) {
      const validation = await profilesMigrationService.validateMigration();
      if (!validation.isValid) {
        toast({
          title: 'Não é possível ativar',
          description: validation.issues.join('. '),
          variant: 'destructive',
        });
        return;
      }
    }
    
    const success = await profilesMigrationService.toggleProfilesOnlyMode(!featureFlag.enabled);
    if (success) {
      toast({
        title: featureFlag.enabled ? 'Flag desativada' : 'Flag ativada',
        description: featureFlag.enabled 
          ? 'Sistema voltou a usar fallback para clientes'
          : 'Sistema agora usa apenas profiles',
      });
      await fetchData();
    }
  }, [featureFlag, toast, fetchData]);

  const retryFailed = useCallback(async (clienteId: string) => {
    const success = await profilesMigrationService.retryMigration(clienteId);
    if (success) {
      toast({
        title: 'Retry bem-sucedido',
        description: `Cliente ${clienteId} migrado com sucesso`,
      });
      await fetchData();
    } else {
      toast({
        title: 'Erro no retry',
        description: 'Não foi possível migrar o cliente',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData]);

  const exportLogs = useCallback(async (jobId: string) => {
    const csv = await profilesMigrationService.exportLogsCSV(jobId);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration-logs-${jobId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const validateMigration = useCallback(async () => {
    const result = await profilesMigrationService.validateMigration();
    if (result.isValid) {
      toast({
        title: 'Validação OK',
        description: `Taxa de correspondência: ${result.matchRate.toFixed(2)}%`,
      });
    } else {
      toast({
        title: 'Problemas encontrados',
        description: result.issues.join('. '),
        variant: 'destructive',
      });
    }
    return result;
  }, [toast]);

  return {
    stats,
    jobs,
    currentJob,
    logs,
    featureFlag,
    isLoading,
    isRunning,
    startMigration,
    pauseMigration,
    toggleFeatureFlag,
    retryFailed,
    exportLogs,
    validateMigration,
    refresh: fetchData,
  };
}
