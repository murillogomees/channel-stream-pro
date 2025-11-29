import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { VODDownload } from '@/hooks/useVODManagement';

interface VODDownloadProgressProps {
  downloads: VODDownload[];
  onRetry?: (downloadId: string) => void;
}

export default function VODDownloadProgress({ downloads, onRetry }: VODDownloadProgressProps) {
  const activeDownloads = downloads.filter(d => 
    d.status === 'downloading' || d.status === 'processing'
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'pending':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      'pending': 'Aguardando',
      'downloading': 'Baixando',
      'processing': 'Processando',
      'completed': 'Completo',
      'failed': 'Falhou'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const calculateProgress = (download: VODDownload) => {
    if (download.segment_count === 0) return 0;
    return Math.round((download.segments_downloaded / download.segment_count) * 100);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`;
  };

  const isLargeFile = (bytes: number | null) => {
    if (!bytes) return false;
    return bytes > 500 * 1024 * 1024; // > 500MB
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Downloads de VOD
        </CardTitle>
        <CardDescription>
          {activeDownloads.length > 0 
            ? `${activeDownloads.length} download(s) em andamento` 
            : 'Nenhum download ativo no momento'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {downloads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum download registrado</p>
            </div>
          ) : (
            downloads.map((download) => (
              <div key={download.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(download.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          Canal {download.channel_id.slice(0, 8)}...
                        </span>
                        <Badge variant={getStatusBadgeVariant(download.status)} className="shrink-0">
                          {getStatusLabel(download.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {download.original_url}
                      </p>
                    </div>
                  </div>
                  
                  {download.status === 'failed' && onRetry && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRetry(download.id)}
                    >
                      Tentar Novamente
                    </Button>
                  )}
                </div>

                {(download.status === 'downloading' || download.status === 'processing') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {formatFileSize(download.file_size_bytes)} 
                        {download.segment_count > 1 && ` • ${download.segments_downloaded}/${download.segment_count} chunks`}
                      </span>
                      <span className="font-mono">{calculateProgress(download)}%</span>
                    </div>
                    <Progress 
                      value={calculateProgress(download)} 
                      className={isLargeFile(download.file_size_bytes) ? 'h-3' : 'h-2'}
                    />
                    {isLargeFile(download.file_size_bytes) && (
                      <p className="text-xs text-amber-500">
                        ⚠️ Arquivo grande - download pode demorar vários minutos
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Tamanho: </span>
                    <span className="font-medium">{formatFileSize(download.file_size_bytes)}</span>
                  </div>
                  
                  <div>
                    <span className="text-muted-foreground">Tentativas: </span>
                    <span className="font-medium">{download.retry_count}/3</span>
                  </div>
                  
                  {download.download_started_at && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Iniciado: </span>
                      <span className="font-medium">{formatDate(download.download_started_at)}</span>
                    </div>
                  )}
                  
                  {download.download_completed_at && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Concluído: </span>
                      <span className="font-medium">{formatDate(download.download_completed_at)}</span>
                    </div>
                  )}

                  {download.error_message && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Erro: </span>
                      <span className="text-destructive text-xs">{download.error_message}</span>
                    </div>
                  )}

                  {download.status === 'completed' && download.r2_url && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">URL R2: </span>
                      <a 
                        href={download.r2_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-xs truncate block"
                      >
                        {download.r2_url}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
