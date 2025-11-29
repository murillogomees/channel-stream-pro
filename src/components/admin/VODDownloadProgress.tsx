import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, CheckCircle2, XCircle, Clock, Loader2, Play, Pause, RefreshCw, HardDrive, Zap, TrendingUp } from 'lucide-react';
import { VODDownload } from '@/hooks/useVODManagement';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface VODDownloadProgressProps {
  downloads: VODDownload[];
  onRetry?: (downloadId: string) => void;
  channelNames?: Record<string, string>;
}

export default function VODDownloadProgress({ downloads, onRetry, channelNames = {} }: VODDownloadProgressProps) {
  const [pulseActive, setPulseActive] = useState(true);
  
  // Toggle pulse animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseActive(prev => !prev);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const activeDownloads = downloads.filter(d => 
    d.status === 'downloading' || d.status === 'processing' || d.status === 'queued'
  );

  const completedDownloads = downloads.filter(d => d.status === 'completed');
  const failedDownloads = downloads.filter(d => d.status === 'failed');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-orange-500" />;
      default:
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'pending':
      case 'queued':
      case 'paused':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'pending': 'Aguardando',
      'queued': 'Na fila',
      'downloading': 'Baixando',
      'processing': 'Processando',
      'completed': 'Completo',
      'failed': 'Falhou',
      'paused': 'Pausado'
    };
    return labels[status] || status;
  };

  const calculateProgress = (download: VODDownload) => {
    // Para HLS (usa segment_count)
    if (download.segment_count > 0) {
      return Math.round((download.segments_downloaded / download.segment_count) * 100);
    }
    
    // Para arquivos grandes (usa metadata.totalSize ou segments como chunks)
    const metadata = (download as any).metadata;
    if (metadata?.totalSize && download.file_size_bytes) {
      return Math.round((download.file_size_bytes / metadata.totalSize) * 100);
    }
    
    // Fallback: se tem partes no metadata, contar progresso por partes
    if (metadata?.parts && Array.isArray(metadata.parts)) {
      const partsCount = metadata.parts.length;
      if (download.segments_downloaded > 0) {
        // Estimativa baseada em segmentos baixados
        return Math.min(99, partsCount * 3); // Cada parte ~3%
      }
      return Math.min(99, partsCount * 3);
    }
    
    // Se tem file_size_bytes mas não temos total, mostrar como indeterminado
    if (download.file_size_bytes && download.file_size_bytes > 0) {
      // Mostra progresso baseado em chunks/segmentos baixados
      if (download.segments_downloaded > 0) {
        return Math.min(95, download.segments_downloaded * 3);
      }
    }
    
    return 0;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  };

  const formatSpeed = (download: VODDownload) => {
    if (!download.download_started_at || !download.file_size_bytes) return null;
    
    const startTime = new Date(download.download_started_at).getTime();
    const elapsed = (Date.now() - startTime) / 1000; // segundos
    
    if (elapsed < 5) return null; // Espera 5s para calcular
    
    const bytesPerSecond = download.file_size_bytes / elapsed;
    const mbPerSecond = bytesPerSecond / (1024 * 1024);
    
    return mbPerSecond >= 1 ? `${mbPerSecond.toFixed(1)} MB/s` : `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getChannelName = (channelId: string) => {
    return channelNames[channelId] || `Canal ${channelId.slice(0, 8)}...`;
  };

  // Calcular estatísticas de progresso geral
  const totalActiveProgress = activeDownloads.length > 0
    ? Math.round(activeDownloads.reduce((sum, d) => sum + calculateProgress(d), 0) / activeDownloads.length)
    : 0;

  const totalBytesDownloaded = downloads.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Downloads de VOD
              {activeDownloads.length > 0 && (
                <Badge variant="outline" className="ml-2 animate-pulse bg-blue-500/10">
                  {activeDownloads.length} ativos
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {activeDownloads.length > 0 
                ? `${completedDownloads.length} completos • ${failedDownloads.length} com falha • ${formatFileSize(totalBytesDownloaded)} baixados`
                : `${completedDownloads.length} completos • ${failedDownloads.length} com falha`
              }
            </CardDescription>
          </div>
          
          {activeDownloads.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">{totalActiveProgress}%</div>
                <div className="text-xs text-muted-foreground">progresso médio</div>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Barra de progresso geral quando há downloads ativos */}
        {activeDownloads.length > 0 && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="flex items-center gap-2">
                <Zap className={cn("h-4 w-4", pulseActive && "text-yellow-500")} />
                <span className="font-medium">Downloads em andamento</span>
              </span>
              <span className="text-muted-foreground">
                {activeDownloads.length} arquivo(s)
              </span>
            </div>
            <Progress 
              value={totalActiveProgress} 
              className="h-2"
            />
          </div>
        )}

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {downloads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Download className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">Nenhum download registrado</p>
                <p className="text-xs mt-1">Inicie downloads na aba "Gerenciamento de VOD"</p>
              </div>
            ) : (
              downloads.map((download) => {
                const progress = calculateProgress(download);
                const speed = formatSpeed(download);
                const isActive = download.status === 'downloading' || download.status === 'processing';
                const metadata = (download as any).metadata;
                const partsCount = metadata?.parts?.length || 0;
                
                return (
                  <div 
                    key={download.id} 
                    className={cn(
                      "border rounded-lg p-4 transition-all duration-300",
                      isActive && "border-primary/50 bg-primary/5",
                      download.status === 'completed' && "border-green-500/30 bg-green-500/5",
                      download.status === 'failed' && "border-destructive/30 bg-destructive/5"
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn(
                          "p-2 rounded-full",
                          isActive && "bg-blue-500/20",
                          download.status === 'completed' && "bg-green-500/20",
                          download.status === 'failed' && "bg-red-500/20",
                          download.status === 'queued' && "bg-yellow-500/20"
                        )}>
                          {getStatusIcon(download.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate max-w-[200px]">
                              {getChannelName(download.channel_id)}
                            </span>
                            <Badge variant={getStatusBadgeVariant(download.status)} className="shrink-0 text-xs">
                              {getStatusLabel(download.status)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {download.original_url.split('/').pop() || download.original_url}
                          </p>
                        </div>
                      </div>
                      
                      {download.status === 'failed' && onRetry && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRetry(download.id)}
                          className="shrink-0"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                    </div>

                    {/* Progress Bar para downloads ativos */}
                    {isActive && (
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <HardDrive className="h-3 w-3 text-muted-foreground" />
                            <span>{formatFileSize(download.file_size_bytes)}</span>
                            {partsCount > 0 && (
                              <span className="text-muted-foreground">• {partsCount} partes</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {speed && (
                              <span className="flex items-center gap-1 text-green-600">
                                <TrendingUp className="h-3 w-3" />
                                {speed}
                              </span>
                            )}
                            <span className="font-mono font-bold text-primary">{progress}%</span>
                          </div>
                        </div>
                        <div className="relative">
                          <Progress 
                            value={progress} 
                            className="h-3"
                          />
                          {/* Animated glow effect */}
                          <div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                            style={{ width: `${progress}%`, animationDuration: '2s' }}
                          />
                        </div>
                        {download.segments_downloaded > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {download.segments_downloaded} chunks enviados para R2
                          </p>
                        )}
                      </div>
                    )}

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {download.file_size_bytes && download.file_size_bytes > 0 && (
                        <div>
                          <span className="text-muted-foreground">Tamanho: </span>
                          <span className="font-medium">{formatFileSize(download.file_size_bytes)}</span>
                        </div>
                      )}
                      
                      {download.retry_count > 0 && (
                        <div>
                          <span className="text-muted-foreground">Tentativas: </span>
                          <span className="font-medium">{download.retry_count}/3</span>
                        </div>
                      )}
                      
                      {download.download_started_at && (
                        <div>
                          <span className="text-muted-foreground">Iniciado: </span>
                          <span className="font-medium">{formatDate(download.download_started_at)}</span>
                        </div>
                      )}
                      
                      {download.download_completed_at && download.status === 'completed' && (
                        <div>
                          <span className="text-muted-foreground">Concluído: </span>
                          <span className="font-medium">{formatDate(download.download_completed_at)}</span>
                        </div>
                      )}

                      {download.error_message && (
                        <div className="col-span-2 mt-1">
                          <span className="text-destructive">❌ {download.error_message}</span>
                        </div>
                      )}

                      {download.status === 'completed' && download.r2_url && (
                        <div className="col-span-2 mt-1">
                          <a 
                            href={download.r2_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Ver no R2
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
