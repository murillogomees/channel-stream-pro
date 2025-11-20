import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useVODManagement } from '@/hooks/useVODManagement';
import VODDownloadProgress from '@/components/admin/VODDownloadProgress';
import { HardDrive, TrendingUp, Download, CheckCircle2, Clock, XCircle, Trash2 } from 'lucide-react';

export default function AdminVODStorage() {
  const { toast } = useToast();
  const { downloads, statistics, isLoading, refresh } = useVODManagement();
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const handleCleanup = async () => {
    try {
      setIsCleaningUp(true);
      
      // Invocar edge function de cleanup
      // Note: Esta função precisa estar configurada no Supabase
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cleanup-old-vod`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-supabase-cron-secret': 'manual-trigger'
          }
        }
      );

      if (!response.ok) throw new Error('Falha na limpeza');

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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Gerenciamento de Storage VOD</h1>
        <p className="text-muted-foreground">
          Monitore o uso de espaço no Cloudflare R2 e gerencie VODs hospedados
        </p>
      </div>

      <Separator />

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ações</CardTitle>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleCleanup}
              disabled={isCleaningUp}
              variant="outline"
              className="w-full"
            >
              {isCleaningUp ? 'Limpando...' : 'Limpar VODs Órfãos'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Downloads */}
      <VODDownloadProgress downloads={downloads} />

      {/* Informações e Dicas */}
      <Card>
        <CardHeader>
          <CardTitle>ℹ️ Informações sobre Storage VOD</CardTitle>
          <CardDescription>
            Entenda como funciona o sistema de download e hospedagem de VOD
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">O que são VODs?</h4>
            <p className="text-sm text-muted-foreground">
              VODs (Video on Demand) são conteúdos de vídeo que foram baixados das fontes originais
              e hospedados no seu próprio CDN (Cloudflare R2). Isso garante disponibilidade mesmo se a fonte original cair.
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">Como funciona o download?</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Canais marcados como VOD são enfileirados para download</li>
              <li>Downloads HLS baixam o manifest (.m3u8) e todos os segmentos (.ts)</li>
              <li>Sistema processa até 3 downloads simultâneos</li>
              <li>Falhas são automaticamente tentadas até 3 vezes</li>
              <li>VODs são servidos diretamente do R2, sem proxy</li>
            </ul>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">Limpeza Automática</h4>
            <p className="text-sm text-muted-foreground">
              O sistema executa limpeza diária removendo: VODs de canais deletados, VODs de canais
              que viraram live, e registros de download antigos (7+ dias). Você também pode executar
              limpeza manual a qualquer momento.
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Badge variant="outline">CDN Headers</Badge>
              Otimização de Cache
            </h4>
            <p className="text-sm text-muted-foreground">
              Streams live usam proxy com cache CDN otimizado: manifests .m3u8 (cache de 10s),
              segmentos .ts (cache de 24h). VODs hospedados no R2 usam cache agressivo (1 ano).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
