import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { 
  Video, 
  Play,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { TranscodeJobDialog } from './TranscodeJobDialog';
import { TranscodeStats } from './TranscodeStats';
import { TranscodeJobList } from './TranscodeJobList';

type TranscodeJob = Database['public']['Tables']['transcode_jobs']['Row'];
type TranscodeJobStatus = Database['public']['Enums']['transcode_job_status'];

export function TranscodeQueueManager() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<TranscodeJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingJobs, setProcessingJobs] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    queued: 0,
    processing: 0,
    ready: 0,
    failed: 0,
    cancelled: 0,
  });

  useEffect(() => {
    loadJobs();
    
    // Subscribe to real-time updates
    const subscription = supabase
      .channel('transcode_jobs_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'transcode_jobs',
      }, () => {
        loadJobs();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transcode_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setJobs(data || []);
      
      // Calculate stats
      const newStats = {
        total: data?.length || 0,
        queued: data?.filter(j => j.status === 'queued').length || 0,
        processing: data?.filter(j => j.status === 'processing').length || 0,
        ready: data?.filter(j => j.status === 'ready').length || 0,
        failed: data?.filter(j => j.status === 'failed').length || 0,
        cancelled: data?.filter(j => j.status === 'cancelled').length || 0,
      };
      setStats(newStats);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar jobs',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessJobs = async () => {
    try {
      setProcessingJobs(true);
      const { data, error } = await supabase.functions.invoke('transcode-runner');

      if (error) throw error;

      toast({
        title: 'Jobs processados',
        description: `${data.processed} jobs processados com sucesso`,
      });

      loadJobs();
    } catch (error: any) {
      toast({
        title: 'Erro ao processar jobs',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingJobs(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('transcode_jobs')
        .update({ 
          status: 'queued' as TranscodeJobStatus,
          error_message: null,
          error_code: null,
          retry_count: 0,
        })
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: 'Job reenfileirado',
        description: 'Job foi movido de volta para a fila',
      });

      loadJobs();
    } catch (error: any) {
      toast({
        title: 'Erro ao retentar job',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Tem certeza que deseja deletar este job?')) return;

    try {
      const { error } = await supabase
        .from('transcode_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: 'Job deletado',
        description: 'Job removido da fila com sucesso',
      });

      loadJobs();
    } catch (error: any) {
      toast({
        title: 'Erro ao deletar job',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleJobCreated = () => {
    setDialogOpen(false);
    loadJobs();
    toast({
      title: 'Job criado',
      description: 'Novo job adicionado à fila de transcodificação',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Video className="w-8 h-8" />
            Transcode Queue Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie a fila de transcodificação de vídeos (Cloudflare Stream)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadJobs}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button 
            variant="default" 
            onClick={handleProcessJobs}
            disabled={processingJobs || stats.queued === 0}
          >
            {processingJobs ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Processar Fila ({stats.queued})
              </>
            )}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Job
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <TranscodeStats stats={stats} loading={loading} />

      {/* Job List */}
      <Card>
        <CardHeader>
          <CardTitle>Fila de Transcodificação</CardTitle>
          <CardDescription>
            Últimos 100 jobs de transcodificação do Cloudflare Stream
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TranscodeJobList
            jobs={jobs}
            loading={loading}
            onRetry={handleRetryJob}
            onDelete={handleDeleteJob}
          />
        </CardContent>
      </Card>

      {/* Create Job Dialog */}
      <TranscodeJobDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleJobCreated}
      />
    </div>
  );
}
