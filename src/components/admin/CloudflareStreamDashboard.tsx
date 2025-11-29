import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Cloud, 
  Play, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  RefreshCw,
  Upload,
  DollarSign,
  Film,
  Zap,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getStreamStatistics, 
  getRecentUploads, 
  runScheduler,
  StreamStatistics,
  StreamUpload
} from '@/services/cloudflareStreamService';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function CloudflareStreamDashboard() {
  const [statistics, setStatistics] = useState<StreamStatistics | null>(null);
  const [uploads, setUploads] = useState<StreamUpload[]>([]);
  const [channelNames, setChannelNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const loadChannelNames = useCallback(async (channelIds: string[]) => {
    if (channelIds.length === 0) return;
    
    const uniqueIds = [...new Set(channelIds)];
    const missingIds = uniqueIds.filter(id => !channelNames[id]);
    
    if (missingIds.length === 0) return;
    
    const { data: channels } = await supabase
      .from('m3u_channels')
      .select('id, name')
      .in('id', missingIds);

    if (channels) {
      const names: Record<string, string> = { ...channelNames };
      channels.forEach(c => { names[c.id] = c.name; });
      setChannelNames(names);
    }
  }, [channelNames]);

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [stats, recentUploads] = await Promise.all([
        getStreamStatistics(),
        getRecentUploads(50)
      ]);

      setStatistics(stats);
      setUploads(recentUploads);

      if (recentUploads.length > 0) {
        await loadChannelNames(recentUploads.map(u => u.channel_id));
      }
    } catch (error) {
      console.error('Error loading Stream data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadChannelNames]);

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  // Realtime subscription for uploads
  useEffect(() => {
    const channel = supabase
      .channel('cf-stream-uploads-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cf_stream_uploads'
        },
        async (payload) => {
          console.log('[CF-Dashboard] Realtime update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newUpload = payload.new as StreamUpload;
            setUploads(prev => [newUpload, ...prev.slice(0, 49)]);
            await loadChannelNames([newUpload.channel_id]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedUpload = payload.new as StreamUpload;
            setUploads(prev => 
              prev.map(u => u.id === updatedUpload.id ? updatedUpload : u)
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setUploads(prev => prev.filter(u => u.id !== deletedId));
          }
          
          // Refresh statistics on changes
          const stats = await getStreamStatistics();
          if (stats) setStatistics(stats);
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
        console.log('[CF-Dashboard] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadChannelNames]);

  // Polling for statistics every 10 seconds when there are active uploads
  useEffect(() => {
    const hasActiveUploads = uploads.some(u => 
      ['processing', 'uploading', 'queued'].includes(u.status)
    );

    if (!hasActiveUploads) return;

    const interval = setInterval(async () => {
      const stats = await getStreamStatistics();
      if (stats) setStatistics(stats);
    }, 10000);

    return () => clearInterval(interval);
  }, [uploads]);

  const handleRunScheduler = async () => {
    setRunningScheduler(true);
    try {
      const result = await runScheduler();
      if (result.success) {
        toast.success(`Scheduler executado: ${result.result?.newUploads || 0} novos uploads`);
        loadData(false);
      } else {
        toast.error(result.error || 'Erro ao executar scheduler');
      }
    } finally {
      setRunningScheduler(false);
    }
  };

  const getStatusBadge = (upload: StreamUpload) => {
    const status = upload.status;
    const progress = upload.progress_percent || 0;
    
    switch (status) {
      case 'ready':
        return <Badge className="bg-emerald-500/20 text-emerald-400"><CheckCircle2 className="w-3 h-3 mr-1" />Pronto</Badge>;
      case 'processing':
        return (
          <div className="flex items-center gap-2">
            <div className="w-20">
              <Progress value={progress} className="h-2" />
            </div>
            <Badge className="bg-blue-500/20 text-blue-400">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              {progress.toFixed(0)}%
            </Badge>
          </div>
        );
      case 'uploading':
        return <Badge className="bg-yellow-500/20 text-yellow-400"><Upload className="w-3 h-3 mr-1 animate-pulse" />Enviando</Badge>;
      case 'queued':
        return <Badge className="bg-gray-500/20 text-gray-400"><Clock className="w-3 h-3 mr-1" />Na fila</Badge>;
      case 'error':
        return <Badge className="bg-red-500/20 text-red-400"><AlertCircle className="w-3 h-3 mr-1" />Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Calculate active processing stats
  const processingUploads = uploads.filter(u => u.status === 'processing');
  const avgProgress = processingUploads.length > 0
    ? processingUploads.reduce((acc, u) => acc + (u.progress_percent || 0), 0) / processingUploads.length
    : 0;

  if (loading && !statistics) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/20">
            <Cloud className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              Cloudflare Stream
              {isLive && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <Activity className="w-3 h-3 animate-pulse" />
                  Live
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              Distribuição de VODs com adaptive bitrate
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => loadData(false)}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            size="sm" 
            onClick={handleRunScheduler}
            disabled={runningScheduler}
          >
            {runningScheduler ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Processar Fila
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>VODs no Stream</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Film className="w-5 h-5 text-emerald-400" />
              {statistics?.vods_on_stream?.toLocaleString() || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              de {statistics?.total_vods?.toLocaleString() || 0} VODs totais
            </div>
            {statistics && statistics.total_vods > 0 && (
              <Progress 
                value={(statistics.vods_on_stream / statistics.total_vods) * 100} 
                className="mt-2 h-1"
              />
            )}
          </CardContent>
        </Card>

        <Card className={processingUploads.length > 0 ? 'ring-2 ring-blue-500/30' : ''}>
          <CardHeader className="pb-2">
            <CardDescription>Em Processamento</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {processingUploads.length > 0 ? (
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              ) : (
                <Clock className="w-5 h-5 text-blue-400" />
              )}
              {(statistics?.uploads_queued || 0) + (statistics?.uploads_processing || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {statistics?.uploads_queued || 0} na fila, {statistics?.uploads_processing || 0} processando
            </div>
            {processingUploads.length > 0 && (
              <div className="mt-2">
                <Progress value={avgProgress} className="h-1.5" />
                <p className="text-xs text-blue-400 mt-1">
                  Média: {avgProgress.toFixed(0)}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Horas de Conteúdo</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-400" />
              {statistics?.total_duration_hours?.toLocaleString() || 0}h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Duração total no Stream
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Custo Estimado</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              ${statistics?.estimated_monthly_cost?.toFixed(2) || '0.00'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              /mês (storage apenas)
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Errors Alert */}
      {(statistics?.uploads_error || 0) > 0 && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-sm">
              {statistics?.uploads_error} uploads com erro. Verifique os logs.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Recent Uploads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Uploads Recentes
            {processingUploads.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {processingUploads.length} ativo{processingUploads.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Últimos 50 uploads para o Cloudflare Stream</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {uploads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum upload encontrado
                </div>
              ) : (
                uploads.map((upload) => (
                  <div 
                    key={upload.id}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      upload.status === 'processing' 
                        ? 'bg-blue-500/10 border border-blue-500/20' 
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Play className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {channelNames[upload.channel_id] || upload.channel_id}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {formatDistanceToNow(new Date(upload.created_at), { 
                              addSuffix: true,
                              locale: ptBR 
                            })}
                          </span>
                          {upload.error_message && (
                            <span className="text-red-400 truncate max-w-[200px]" title={upload.error_message}>
                              {upload.error_message}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {getStatusBadge(upload)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export default CloudflareStreamDashboard;
