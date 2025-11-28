import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useVODManagement } from '@/hooks/useVODManagement';
import VODDownloadProgress from '@/components/admin/VODDownloadProgress';
import { HardDrive, TrendingUp, Download, CheckCircle2, Clock, XCircle, Trash2, Wand2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function AdminVODStorage() {
  const { toast } = useToast();
  const { downloads, statistics, isLoading, refresh, detectVODs } = useVODManagement();
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

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
          onClick={handleDetectVODs}
          disabled={isDetecting}
          variant="default"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          {isDetecting ? 'Detectando...' : 'Detectar VODs Automaticamente'}
        </Button>
        
        <Button
          onClick={handleCleanup}
          disabled={isCleaningUp}
          variant="outline"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {isCleaningUp ? 'Limpando...' : 'Limpar VODs Órfãos'}
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

      {/* Lista de Downloads */}
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
