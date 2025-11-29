import { useState, useEffect } from 'react';
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
  Zap
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [stats, recentUploads] = await Promise.all([
        getStreamStatistics(),
        getRecentUploads(50)
      ]);

      setStatistics(stats);
      setUploads(recentUploads);

      // Load channel names
      if (recentUploads.length > 0) {
        const channelIds = [...new Set(recentUploads.map(u => u.channel_id))];
        const { data: channels } = await supabase
          .from('m3u_channels')
          .select('id, name')
          .in('id', channelIds);

        if (channels) {
          const names: Record<string, string> = {};
          channels.forEach(c => { names[c.id] = c.name; });
          setChannelNames(names);
        }
      }
    } catch (error) {
      console.error('Error loading Stream data:', error);
      toast.error('Erro ao carregar dados do Stream');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleRunScheduler = async () => {
    setRunningScheduler(true);
    try {
      const result = await runScheduler();
      if (result.success) {
        toast.success(`Scheduler executado: ${result.result?.newUploads || 0} novos uploads`);
        loadData();
      } else {
        toast.error(result.error || 'Erro ao executar scheduler');
      }
    } finally {
      setRunningScheduler(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return <Badge className="bg-emerald-500/20 text-emerald-400"><CheckCircle2 className="w-3 h-3 mr-1" />Pronto</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500/20 text-blue-400"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processando</Badge>;
      case 'uploading':
        return <Badge className="bg-yellow-500/20 text-yellow-400"><Upload className="w-3 h-3 mr-1" />Enviando</Badge>;
      case 'queued':
        return <Badge className="bg-gray-500/20 text-gray-400"><Clock className="w-3 h-3 mr-1" />Na fila</Badge>;
      case 'error':
        return <Badge className="bg-red-500/20 text-red-400"><AlertCircle className="w-3 h-3 mr-1" />Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
            <h2 className="text-xl font-semibold">Cloudflare Stream</h2>
            <p className="text-sm text-muted-foreground">
              Distribuição de VODs com adaptive bitrate
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadData}
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

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Em Processamento</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              {(statistics?.uploads_queued || 0) + (statistics?.uploads_processing || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {statistics?.uploads_queued || 0} na fila, {statistics?.uploads_processing || 0} processando
            </div>
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
          <CardTitle className="text-lg">Uploads Recentes</CardTitle>
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
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Play className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {channelNames[upload.channel_id] || upload.channel_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(upload.created_at), { 
                            addSuffix: true,
                            locale: ptBR 
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {upload.status === 'processing' && upload.progress_percent > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {upload.progress_percent}%
                        </span>
                      )}
                      {getStatusBadge(upload.status)}
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
