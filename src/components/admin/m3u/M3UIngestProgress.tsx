/**
 * M3U Ingest Progress Component
 * 
 * Visual progress indicator for M3U streaming imports.
 * Shows status, bytes transferred, and method used.
 * 
 * @version 1.0.0
 */

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Cloud, 
  CloudUpload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Zap,
  FileUp,
  ArrowDownToLine
} from 'lucide-react';
import type { IngestProgress } from '@/hooks/useM3UIngest';
import { cn } from '@/lib/utils';

interface M3UIngestProgressProps {
  progress: IngestProgress;
  className?: string;
}

export function M3UIngestProgress({ progress, className }: M3UIngestProgressProps) {
  const { status, percent, bytes, message, method } = progress;

  const getStatusIcon = () => {
    switch (status) {
      case 'connecting':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'downloading':
        return <ArrowDownToLine className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'uploading':
        return <CloudUpload className="h-4 w-4 text-orange-500 animate-pulse" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-purple-500" />;
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Cloud className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getMethodBadge = () => {
    if (!method) return null;

    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      stream: { label: 'Streaming', variant: 'default' },
      signed_url: { label: 'Direct Upload', variant: 'secondary' },
      fallback: { label: 'Fallback', variant: 'outline' },
    };

    const config = variants[method] || { label: method, variant: 'outline' };

    return (
      <Badge variant={config.variant} className="text-xs">
        <Zap className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const formatBytes = (b: number): string => {
    if (b === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (status === 'idle') {
    return null;
  }

  return (
    <div className={cn('space-y-3 p-4 rounded-lg border bg-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">
            {status === 'complete' ? 'Ingest Concluído' : 'Importando M3U...'}
          </span>
        </div>
        {getMethodBadge()}
      </div>

      {/* Progress bar */}
      <Progress 
        value={percent} 
        className={cn(
          'h-2',
          status === 'error' && 'bg-destructive/20',
          status === 'complete' && 'bg-green-100'
        )}
      />

      {/* Status message */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className={cn(
          status === 'error' && 'text-destructive',
          status === 'complete' && 'text-green-600'
        )}>
          {message}
        </span>
        {bytes > 0 && (
          <span className="flex items-center gap-1">
            <FileUp className="h-3 w-3" />
            {formatBytes(bytes)}
          </span>
        )}
      </div>

      {/* Method explanation */}
      {method && status === 'complete' && (
        <p className="text-xs text-muted-foreground">
          {method === 'stream' && 
            'Streaming direto para R2 sem buffering em memória.'}
          {method === 'signed_url' && 
            'Upload via URL assinada para arquivos grandes.'}
          {method === 'fallback' && 
            'Fallback automático devido a timeout ou conexão lenta.'}
        </p>
      )}
    </div>
  );
}
