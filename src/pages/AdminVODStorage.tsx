import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useVODManagement } from '@/hooks/useVODManagement';
import VODDownloadProgress from '@/components/admin/VODDownloadProgress';
import { HardDrive, TrendingUp, Download, CheckCircle2, Clock, XCircle, Trash2, Wand2, RefreshCw, Rocket, Cloud, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function AdminVODStorage() {
  const { toast } = useToast();
  const { downloads, hostedVODs, statistics, isLoading, refresh, detectVODs } = useVODManagement();
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isStartingDownloads, setIsStartingDownloads] = useState(false);

  // Filtrar downloads por status
  const activeDownloads = downloads.filter(d => ['downloading', 'processing', 'queued'].includes(d.status));
  const completedDownloads = downloads.filter(d => d.status === 'completed');
  const failedDownloads = downloads.filter(d => d.status === 'failed');
  const pendingDownloads = downloads.filter(d => d.status === 'pending');

  const handleStartDownloads = async () => {
    try {
      setIsStartingDownloads(true);
      
      const { data, error } = await supabase.functions.invoke('schedule-vod-downloads', {
        body: { 
          limit: 50,
          priority: 'size' // menores primeiro para resultados rápidos
        }
      });

      if (error) throw error;

      if (data.scheduled > 0) {
        toast({
          title: 'Downloads iniciados',
          description: `${data.scheduled} VODs agendados para download. ${data.totalPending - data.scheduled} ainda pendentes.`,
        });
      } else {
        toast({
          title: 'Nenhum VOD para baixar',
          description: data.message || 'Todos os VODs já foram processados ou estão em andamento.',
        });
      }

      refresh();
    } catch (error: any) {
      toast({
        title: 'Erro ao iniciar downloads',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsStartingDownloads(false);
    }
  };

  const handleCleanup = async () => {
    try {
      setIsCleaningUp(true);
      
      const { error } = await supabase.functions.invoke('cleanup-old-vod', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: 'Limpeza concluída',
        description: 'VODs órfãos e downloads antigos foram removidos',
      });

      refresh();
    } catch (error: any) {
      toast({
        title: 'Erro na limpeza',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleDetectVODs = async () => {
    try {
      setIsDetecting(true);
      const result = await detectVODs();
      
      toast({
        title: 'Detecção concluída',
        description: `${result.updated_count} canais marcados como VOD. Total: ${result.vod_count} VODs, ${result.live_count} Live`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro na detecção',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Gerenciamento de Storage VOD</h2>
        <p className="text-muted-foreground">
          Monitore o uso de espaço no Cloudflare R2 e gerencie VODs hospedados
        </p>
      </div>

      <Separator />

      {/* Ações Rápidas */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={handleStartDownloads}
          disabled={isStartingDownloads || (statistics?.vods_pending || 0) === 0}
          variant="default"
          className="bg-green-600 hover:bg-green-700"
        >
          <Rocket className="w-4 h-4 mr-2" />
          {isStartingDownloads ? 'Iniciando...' : `Baixar VODs para R2 (${statistics?.vods_pending || 0} pendentes)`}
        </Button>

        <Button
          onClick={handleDetectVODs}
          disabled={isDetecting}
          variant="secondary"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          {isDetecting ? 'Detectando...' : 'Detectar VODs'}
        </Button>
        
        <Button
          onClick={handleCleanup}
          disabled={isCleaningUp}
          variant="outline"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {isCleaningUp ? 'Limpando...' : 'Limpar Órfãos'}
        </Button>
        
        <Button
          onClick={refresh}
          disabled={isLoading}
          variant="ghost"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de VODs</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.total_vods || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Canais marcados como VOD
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VODs Hospedados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.vods_uploaded || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Já disponíveis no R2
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VODs Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.vods_pending || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Aguardando download
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Espaço Usado</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics ? formatBytes(statistics.total_storage_bytes || 0) : '0 MB'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Média: {statistics?.avg_file_size_mb || 0} MB por VOD
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status de Downloads */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Download className="h-4 w-4 text-blue-500 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.downloads_in_progress || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Downloads ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Falhados</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.downloads_failed || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Requerem atenção</p>
          </CardContent>
        </Card>
      </div>

      {/* Downloads Ativos em Tempo Real */}
      {activeDownloads.length > 0 && (
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Downloads em Execução ({activeDownloads.length})
            </CardTitle>
            <CardDescription>Atualizando em tempo real</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeDownloads.map((download) => {
                const progress = download.segment_count > 0 
                  ? Math.round((download.segments_downloaded / download.segment_count) * 100)
                  : 0;
                return (
                  <div key={download.id} className="bg-background rounded-lg p-3 border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        <span className="text-sm font-medium truncate max-w-[200px]">
                          {download.channel_id.slice(0, 8)}...
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {download.status === 'queued' ? 'Na fila' : 
                           download.status === 'downloading' ? 'Baixando' : 'Processando'}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {download.segments_downloaded}/{download.segment_count} segmentos
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                      <span>{progress}%</span>
                      {download.file_size_bytes && (
                        <span>{(download.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid com VODs Hospedados e Falhos */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* VODs Hospedados no R2 */}
        <Card className="border-green-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Cloud className="h-5 w-5" />
              VODs Hospedados no R2 ({hostedVODs.length})
            </CardTitle>
            <CardDescription>Últimos VODs enviados para o CDN</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {hostedVODs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Cloud className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">Nenhum VOD hospedado ainda</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {hostedVODs.map((vod) => (
                    <div key={vod.id} className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{vod.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{vod.group_title}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          {vod.r2_url && (
                            <a 
                              href={vod.r2_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Hospedado em {new Date(vod.r2_uploaded_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Downloads com Falha */}
        <Card className="border-red-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Downloads com Falha ({failedDownloads.length})
            </CardTitle>
            <CardDescription>Requerem atenção ou retry</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {failedDownloads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mb-2 opacity-50 text-green-500" />
                  <p className="text-sm">Nenhum download com falha</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {failedDownloads.map((download) => (
                    <div key={download.id} className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            Canal {download.channel_id.slice(0, 12)}...
                          </p>
                          <p className="text-xs text-destructive mt-1 line-clamp-2">
                            {download.error_message || 'Erro desconhecido'}
                          </p>
                        </div>
                        <Badge variant="destructive" className="text-xs shrink-0">
                          {download.retry_count}/3 tentativas
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Lista Completa de Downloads */}
      <VODDownloadProgress downloads={downloads} />

      {/* Informações e Dicas */}
      <Card>
        <CardHeader>
          <CardTitle>ℹ️ Sistema VOD com Cloudflare R2</CardTitle>
          <CardDescription>
            Entenda como funciona o sistema de download e hospedagem de VOD
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Detecção Automática</h4>
            <p className="text-sm text-muted-foreground">
              O sistema detecta automaticamente conteúdo VOD baseado em padrões de categoria
              (filmes, séries, cinema, temporadas) e URLs (contendo /movie/, /series/, /vod/).
              Use o botão "Detectar VODs" para executar a detecção manualmente.
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">Benefícios do R2</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Startup &lt;1 segundo para conteúdo hospedado</li>
              <li>Zero buffering - streams entregues via CDN global</li>
              <li>Alta disponibilidade (99.99%) mesmo se origem cair</li>
              <li>Egress gratuito - sem custo de banda</li>
              <li>Cache agressivo de 1 ano para VODs</li>
            </ul>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Badge variant="outline">Estratégia Híbrida</Badge>
              Recomendada
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>Live TV:</strong> Stream direto via proxy (não hospeda)</li>
              <li><strong>Filmes/Séries populares:</strong> Download automático para R2</li>
              <li><strong>Catálogo completo:</strong> Stream direto, download sob demanda</li>
            </ul>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">Limpeza Automática</h4>
            <p className="text-sm text-muted-foreground">
              O sistema executa limpeza diária removendo: VODs de canais deletados, VODs de canais
              que viraram live, e registros de download antigos (7+ dias).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
