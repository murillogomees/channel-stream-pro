import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useM3UCustom } from '@/hooks/useM3UCustom';
import { supabase } from '@/integrations/supabase/client';
import { List, Tv, Cloud, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GenerationLog {
  id: string;
  custom_list_id: string;
  file_size: number;
  channels_count: number;
  generation_time_ms: number;
  cdn_upload_status: string;
  cdn_upload_time_ms: number;
  error_message?: string;
  created_at: string;
  list_name?: string;
}

export default function AdminM3UCustomDashboard() {
  const { lists, isLoading } = useM3UCustom();
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const { data, error } = await supabase
        .from('m3u_generation_logs')
        .select(`
          *,
          m3u_custom_lists(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const logsWithListName = (data || []).map((log: any) => ({
        ...log,
        list_name: log.m3u_custom_lists?.name
      }));

      setLogs(logsWithListName);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const totalLists = lists.length;
  const activeLists = lists.filter(l => l.status === 'active').length;
  const totalChannels = lists.reduce((sum, l) => sum + l.total_channels, 0);
  const totalCategories = lists.reduce((sum, l) => sum + l.total_categories, 0);

  const successfulGenerations = logs.filter(l => l.cdn_upload_status === 'success').length;
  const failedGenerations = logs.filter(l => l.cdn_upload_status === 'failed').length;
  const averageGenerationTime = logs.length > 0
    ? Math.round(logs.reduce((sum, l) => sum + l.generation_time_ms, 0) / logs.length)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard M3U Personalizado</h1>
        <p className="text-muted-foreground">Monitoramento e estatísticas das listas M3U</p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Listas</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLists}</div>
            <p className="text-xs text-muted-foreground">
              {activeLists} ativa(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Canais</CardTitle>
            <Tv className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalChannels}</div>
            <p className="text-xs text-muted-foreground">
              {totalCategories} categoria(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gerações CDN</CardTitle>
            <Cloud className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successfulGenerations}</div>
            <p className="text-xs text-muted-foreground">
              {failedGenerations} falha(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageGenerationTime}ms</div>
            <p className="text-xs text-muted-foreground">
              Geração de M3U
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Listas M3U */}
      <Card>
        <CardHeader>
          <CardTitle>Listas M3U Criadas</CardTitle>
          <CardDescription>Visão geral de todas as listas personalizadas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : lists.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma lista criada ainda</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Categorias</TableHead>
                  <TableHead>Canais</TableHead>
                  <TableHead>Última Geração</TableHead>
                  <TableHead>URL CDN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.map((list) => (
                  <TableRow key={list.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{list.name}</p>
                        <p className="text-xs text-muted-foreground">{list.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={list.status === 'active' ? 'default' : 'secondary'}>
                        {list.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{list.total_categories}</TableCell>
                    <TableCell>{list.total_channels}</TableCell>
                    <TableCell>
                      {list.last_generated_at
                        ? format(new Date(list.last_generated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {list.cdn_url ? (
                        <a
                          href={list.cdn_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm"
                        >
                          Ver URL
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">Não gerado</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Logs de Geração */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Gerações</CardTitle>
          <CardDescription>Últimas 50 gerações de arquivos M3U</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLogs ? (
            <p className="text-sm text-muted-foreground">Carregando logs...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma geração registrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Lista</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Canais</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Tempo Geração</TableHead>
                  <TableHead>Tempo Upload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm">{log.list_name || 'N/A'}</TableCell>
                    <TableCell>
                      {log.cdn_upload_status === 'success' ? (
                        <Badge variant="default" className="flex items-center gap-1 w-fit">
                          <CheckCircle className="h-3 w-3" />
                          Sucesso
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <XCircle className="h-3 w-3" />
                          Falha
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{log.channels_count}</TableCell>
                    <TableCell className="text-sm">
                      {log.file_size ? `${(log.file_size / 1024).toFixed(2)} KB` : '-'}
                    </TableCell>
                    <TableCell className="text-sm">{log.generation_time_ms}ms</TableCell>
                    <TableCell className="text-sm">
                      {log.cdn_upload_time_ms ? `${log.cdn_upload_time_ms}ms` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
