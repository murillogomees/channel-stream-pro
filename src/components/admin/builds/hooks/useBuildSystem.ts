/**
 * useBuildSystem - Hook para gerenciar o sistema de builds
 */

import { useState, useCallback } from 'react';
import { 
  Platform, 
  PlatformName, 
  BuildJob, 
  BuildStatus, 
  CiCdConfig, 
  AutomationConfig,
  DEFAULT_PLATFORMS 
} from '../types';
import { toast } from 'sonner';

interface BuildSystemState {
  platforms: Platform[];
  jobs: BuildJob[];
  ciCdConfig: CiCdConfig;
  automationConfig: AutomationConfig;
  isRunning: boolean;
}

const DEFAULT_CICD_CONFIG: CiCdConfig = {
  autoTest: true,
  emulatorSimulation: true,
  logMonitoring: true,
  failureAlert: true,
  successNotification: true,
  sequentialBuild: true,
  buildOrder: ['android', 'ios', 'web', 'tizen', 'webos', 'roku', 'desktop', 'console']
};

const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  triggerAllBuilds: true,
  notifyOnComplete: true,
  retryOnFail: true
};

export function useBuildSystem() {
  const [state, setState] = useState<BuildSystemState>({
    platforms: DEFAULT_PLATFORMS,
    jobs: [],
    ciCdConfig: DEFAULT_CICD_CONFIG,
    automationConfig: DEFAULT_AUTOMATION_CONFIG,
    isRunning: false
  });

  const createJob = useCallback((platform: PlatformName): BuildJob => ({
    id: `${platform}-${Date.now()}`,
    platform,
    status: 'queued',
    progress: 0,
    startedAt: new Date().toISOString(),
    logs: [`[${new Date().toLocaleTimeString()}] Job criado para ${platform}`]
  }), []);

  const updateJobStatus = useCallback((jobId: string, status: BuildStatus, progress: number, log?: string) => {
    setState(prev => ({
      ...prev,
      jobs: prev.jobs.map(job => 
        job.id === jobId 
          ? { 
              ...job, 
              status, 
              progress,
              logs: log ? [...job.logs, `[${new Date().toLocaleTimeString()}] ${log}`] : job.logs,
              completedAt: ['success', 'failed', 'cancelled'].includes(status) ? new Date().toISOString() : undefined
            }
          : job
      )
    }));
  }, []);

  const simulateBuild = useCallback(async (job: BuildJob) => {
    const platform = state.platforms.find(p => p.name === job.platform);
    if (!platform) return;

    const steps: { status: BuildStatus; duration: number; log: string }[] = [
      { status: 'building', duration: 2000, log: `Compilando ${platform.scripts.compile}` },
      ...(platform.scripts.test ? [{ status: 'testing' as BuildStatus, duration: 1500, log: `Testando ${platform.scripts.test}` }] : []),
      { status: 'deploying', duration: 2000, log: `Deployando ${platform.scripts.deploy}` }
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      updateJobStatus(job.id, step.status, ((i + 1) / steps.length) * 100, step.log);
      await new Promise(resolve => setTimeout(resolve, step.duration));
    }

    // Simulate success/failure (90% success rate)
    const success = Math.random() > 0.1;
    updateJobStatus(
      job.id, 
      success ? 'success' : 'failed', 
      100, 
      success ? 'Build completado com sucesso!' : 'Erro durante o build'
    );

    if (success && state.automationConfig.notifyOnComplete) {
      toast.success(`Build ${platform.name} completado!`);
    } else if (!success) {
      toast.error(`Build ${platform.name} falhou!`);
    }

    return success;
  }, [state.platforms, state.automationConfig, updateJobStatus]);

  const startBuild = useCallback(async (platformName: PlatformName) => {
    const job = createJob(platformName);
    setState(prev => ({ ...prev, jobs: [...prev.jobs, job], isRunning: true }));
    
    toast.info(`Iniciando build para ${platformName}`);
    await simulateBuild(job);
    
    setState(prev => ({ ...prev, isRunning: false }));
  }, [createJob, simulateBuild]);

  const startAllBuilds = useCallback(async () => {
    setState(prev => ({ ...prev, isRunning: true }));
    toast.info('Iniciando builds para todas as plataformas');

    const buildOrder = state.ciCdConfig.buildOrder;
    
    if (state.ciCdConfig.sequentialBuild) {
      for (const platform of buildOrder) {
        const job = createJob(platform);
        setState(prev => ({ ...prev, jobs: [...prev.jobs, job] }));
        const success = await simulateBuild(job);
        
        if (!success && !state.automationConfig.retryOnFail) {
          toast.error('Build pipeline interrompido devido a falha');
          break;
        }
      }
    } else {
      const jobs = buildOrder.map(platform => createJob(platform));
      setState(prev => ({ ...prev, jobs: [...prev.jobs, ...jobs] }));
      await Promise.all(jobs.map(job => simulateBuild(job)));
    }

    setState(prev => ({ ...prev, isRunning: false }));
    toast.success('Pipeline de builds finalizado!');
  }, [state.ciCdConfig, state.automationConfig, createJob, simulateBuild]);

  const cancelBuild = useCallback((jobId: string) => {
    updateJobStatus(jobId, 'cancelled', 0, 'Build cancelado pelo usuário');
    toast.warning('Build cancelado');
  }, [updateJobStatus]);

  const clearHistory = useCallback(() => {
    setState(prev => ({ ...prev, jobs: [] }));
    toast.info('Histórico limpo');
  }, []);

  const updatePlatformConfig = useCallback((platformName: PlatformName, config: Partial<Platform>) => {
    setState(prev => ({
      ...prev,
      platforms: prev.platforms.map(p => 
        p.name === platformName ? { ...p, ...config } : p
      )
    }));
    toast.success(`Configuração de ${platformName} atualizada`);
  }, []);

  const updateCiCdConfig = useCallback((config: Partial<CiCdConfig>) => {
    setState(prev => ({
      ...prev,
      ciCdConfig: { ...prev.ciCdConfig, ...config }
    }));
  }, []);

  const updateAutomationConfig = useCallback((config: Partial<AutomationConfig>) => {
    setState(prev => ({
      ...prev,
      automationConfig: { ...prev.automationConfig, ...config }
    }));
  }, []);

  return {
    ...state,
    startBuild,
    startAllBuilds,
    cancelBuild,
    clearHistory,
    updatePlatformConfig,
    updateCiCdConfig,
    updateAutomationConfig
  };
}
