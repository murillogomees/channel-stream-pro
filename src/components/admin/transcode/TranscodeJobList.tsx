import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RotateCcw, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Database } from '@/integrations/supabase/types';

type TranscodeJob = Database['public']['Tables']['transcode_jobs']['Row'];
type TranscodeJobStatus = Database['public']['Enums']['transcode_job_status'];
type QualityLadderPreset = Database['public']['Enums']['quality_ladder_preset'];

interface TranscodeJobListProps {
  jobs: TranscodeJob[];
  loading: boolean;
  onRetry: (jobId: string) => void;
  onDelete: (jobId: string) => void;
}

export function TranscodeJobList({ jobs, loading, onRetry, onDelete }: TranscodeJobListProps) {
  const getStatusBadge = (status: TranscodeJobStatus) => {
    const variants: Record<TranscodeJobStatus, { variant: any; label: string; className?: string }> = {
      queued: { variant: 'secondary', label: 'Na Fila' },
      processing: { variant: 'default', label: 'Processando' },
      ready: { variant: 'default', label: 'Pronto', className: 'bg-green-600' },
      failed: { variant: 'destructive', label: 'Falhou' },
      cancelled: { variant: 'outline', label: 'Cancelado' },
    };
    
    const config = variants[status];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getPresetBadge = (preset: QualityLadderPreset) => {
    const labels: Record<QualityLadderPreset, string> = {
      basic: '📱 Básico',
      standard: '💻 Standard',
      premium: '🎬 Premium',
      ultra: '⚡ Ultra',
    };
    return <Badge variant="outline">{labels[preset]}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum job na fila
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <div key={job.id} className="border rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {getStatusBadge(job.status)}
                {getPresetBadge(job.ladder_preset)}
                <span className="text-xs font-mono text-muted-foreground">
                  {job.id.substring(0, 8)}...
                </span>
                {job.priority > 1 && (
                  <Badge variant="secondary" className="text-xs">
                    P{job.priority}
                  </Badge>
                )}
              </div>
              <div className="text-sm font-medium mb-1 break-all">
                {job.source_url}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                {job.cf_stream_uid && (
                  <span>Stream UID: {job.cf_stream_uid.substring(0, 12)}...</span>
                )}
                {job.retry_count > 0 && (
                  <span>Tentativas: {job.retry_count}/{job.max_retries}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2 ml-4">
              {job.status === 'failed' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRetry(job.id)}
                  title="Retentar"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              )}
              {job.status === 'ready' && job.cf_stream_uid && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`https://customer-${job.cf_stream_uid}.cloudflarestream.com`, '_blank')}
                  title="Ver vídeo"
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(job.id)}
                title="Deletar"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Criado:</span>
              <div className="font-medium">
                {formatDistanceToNow(new Date(job.created_at), { 
                  addSuffix: true,
                  locale: ptBR 
                })}
              </div>
            </div>
            {job.started_at && (
              <div>
                <span className="text-muted-foreground">Iniciado:</span>
                <div className="font-medium">
                  {formatDistanceToNow(new Date(job.started_at), { 
                    addSuffix: true,
                    locale: ptBR 
                  })}
                </div>
              </div>
            )}
            {job.completed_at && (
              <div>
                <span className="text-muted-foreground">Concluído:</span>
                <div className="font-medium">
                  {formatDistanceToNow(new Date(job.completed_at), { 
                    addSuffix: true,
                    locale: ptBR 
                  })}
                </div>
              </div>
            )}
          </div>

          {job.error_message && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded text-xs">
              <div className="font-medium text-destructive mb-1">
                Erro {job.error_code && `(${job.error_code})`}:
              </div>
              <div className="text-destructive/90">{job.error_message}</div>
            </div>
          )}

          {job.cf_stream_uid && job.status === 'ready' && (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded text-xs">
              <span className="font-medium text-green-700 dark:text-green-300">✅ Stream UID:</span>
              <div className="font-mono break-all text-green-600 dark:text-green-400 mt-1">
                {job.cf_stream_uid}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
