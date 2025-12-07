import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, RotateCcw, Eye, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MigrationJob {
  id: string;
  job_type: string;
  target_table: string;
  status: string;
  total_items: number;
  processed_items: number;
  success_items: number;
  failed_items: number;
  throughput_per_min: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

interface MigrationJobsTableProps {
  jobs: MigrationJob[];
  onAction: (jobId: string, action: 'start' | 'pause' | 'resume' | 'retry' | 'view' | 'delete') => void;
  isLoading?: boolean;
}

export function MigrationJobsTable({ jobs, onAction, isLoading }: MigrationJobsTableProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      running: 'default',
      paused: 'secondary',
      completed: 'default',
      failed: 'destructive',
    };
    
    const colors: Record<string, string> = {
      pending: 'bg-muted text-muted-foreground',
      running: 'bg-primary text-primary-foreground animate-pulse',
      paused: 'bg-yellow-500/20 text-yellow-600',
      completed: 'bg-green-500/20 text-green-600',
      failed: 'bg-destructive/20 text-destructive',
    };
    
    return (
      <Badge variant={variants[status] || 'outline'} className={colors[status]}>
        {status}
      </Badge>
    );
  };

  const getProgress = (job: MigrationJob) => {
    if (job.total_items === 0) return 0;
    return Math.round((job.processed_items / job.total_items) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum job de migração encontrado
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tabela</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Progresso</TableHead>
          <TableHead>Sucesso/Falha</TableHead>
          <TableHead>Throughput</TableHead>
          <TableHead>Criado</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell className="font-medium">{job.target_table}</TableCell>
            <TableCell>
              <Badge variant="outline">{job.job_type}</Badge>
            </TableCell>
            <TableCell>{getStatusBadge(job.status)}</TableCell>
            <TableCell className="min-w-[150px]">
              <div className="space-y-1">
                <Progress value={getProgress(job)} className="h-2" />
                <span className="text-xs text-muted-foreground">
                  {job.processed_items.toLocaleString()} / {job.total_items.toLocaleString()}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <span className="text-green-600">{job.success_items.toLocaleString()}</span>
              {' / '}
              <span className="text-destructive">{job.failed_items.toLocaleString()}</span>
            </TableCell>
            <TableCell>
              {job.throughput_per_min > 0 
                ? `${Math.round(job.throughput_per_min)}/min`
                : '-'
              }
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatDistanceToNow(new Date(job.created_at), { 
                addSuffix: true, 
                locale: ptBR 
              })}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {job.status === 'pending' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onAction(job.id, 'start')}
                    title="Iniciar"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                {job.status === 'running' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onAction(job.id, 'pause')}
                    title="Pausar"
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
                {job.status === 'paused' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onAction(job.id, 'resume')}
                    title="Retomar"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                {(job.status === 'failed' || job.failed_items > 0) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onAction(job.id, 'retry')}
                    title="Retry falhas"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onAction(job.id, 'view')}
                  title="Ver detalhes"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {job.status !== 'running' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onAction(job.id, 'delete')}
                    title="Excluir"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
