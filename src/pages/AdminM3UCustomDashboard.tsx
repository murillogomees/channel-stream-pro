import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useM3UCustom } from '@/hooks/useM3UCustom';
import { supabase } from '@/integrations/supabase/client';
import { List, Tv, Cloud, Activity, CheckCircle, XCircle, Clock, Pencil, Plus, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold">Dashboard M3U</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Monitoramento das listas personalizadas</p>
        </div>
        <Button onClick={() => navigate('/admin/m3u-builder')} size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nova Lista
        </Button>
      </div>

      {/* Stats Grid - Responsivo 2x2 no mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Listas</CardTitle>
            <List className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{totalLists}</div>
            <p className="text-xs text-muted-foreground">{activeLists} ativa(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Canais</CardTitle>
            <Tv className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{totalChannels}</div>
            <p className="text-xs text-muted-foreground">{totalCategories} cat.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">CDN</CardTitle>
            <Cloud className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{successfulGenerations}</div>
            <p className="text-xs text-muted-foreground">{failedGenerations} falha(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Tempo</CardTitle>
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{averageGenerationTime}ms</div>
            <p className="text-xs text-muted-foreground">geração</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Listas M3U - Desktop */}
      <Card className="hidden md:block">
        <CardHeader className="p-4">
          <CardTitle className="text-base">Listas Criadas</CardTitle>
          <CardDescription className="text-xs">Visão geral das listas personalizadas</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4">Carregando...</p>
          ) : lists.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Nenhuma lista criada ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Cat.</TableHead>
                    <TableHead>Canais</TableHead>
                    <TableHead className="hidden lg:table-cell">Última Geração</TableHead>
                    <TableHead>CDN</TableHead>
                    <TableHead className="text-right w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lists.map((list) => (
                    <TableRow key={list.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[150px]">{list.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{list.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={list.status === 'active' ? 'default' : 'secondary'} className="text-xs">{list.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{list.total_categories}</TableCell>
                      <TableCell>{list.total_channels}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">
                        {list.last_generated_at ? format(new Date(list.last_generated_at), "dd/MM HH:mm", { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell>
                        {list.cdn_url ? (
                          <a href={list.cdn_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">URL</a>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right p-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/admin/m3u-builder?list=${list.id}`)}><Pencil className="h-3.5 w-3.5" /></Button>
                          {list.cdn_url && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(list.cdn_url, '_blank')}><Eye className="h-3.5 w-3.5" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Listas M3U - Mobile */}
      <div className="md:hidden space-y-3">
        <h3 className="text-sm font-medium">Listas Criadas</h3>
        {isLoading ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">Carregando...</CardContent></Card>
        ) : lists.length === 0 ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">Nenhuma lista criada</CardContent></Card>
        ) : (
          lists.map((list) => (
            <Card key={list.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{list.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{list.slug}</p>
                  </div>
                  <Badge variant={list.status === 'active' ? 'default' : 'secondary'} className="text-xs flex-shrink-0">{list.status}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{list.total_categories} cat.</span>
                  <span>{list.total_channels} canais</span>
                  {list.last_generated_at && <span>{format(new Date(list.last_generated_at), "dd/MM", { locale: ptBR })}</span>}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  {list.cdn_url ? (
                    <a href={list.cdn_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">Ver URL CDN</a>
                  ) : (
                    <span className="text-muted-foreground text-xs">CDN não gerado</span>
                  )}
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/m3u-builder?list=${list.id}`)}><Pencil className="h-4 w-4" /></Button>
                    {list.cdn_url && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(list.cdn_url, '_blank')}><Eye className="h-4 w-4" /></Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Informações sobre Otimização R2 - Collapsible no mobile */}
      <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Cloud className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
            Otimizações R2 Ativas
          </CardTitle>
          <CardDescription className="text-xs">Tecnologias avançadas</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm">CDN Global</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">Latência mínima global</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm">Cache Agressivo</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">Performance máxima</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm">Zero Egress</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">90% economia vs S3</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm">VOD Hosting</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">Hospedagem independente</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm">Stream Proxy</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">Autenticação tempo real</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm">Auto Regeneração</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">M3U diário ao CDN</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs de Geração - Desktop */}
      <Card className="hidden md:block">
        <CardHeader className="p-4">
          <CardTitle className="text-base">Histórico de Gerações</CardTitle>
          <CardDescription className="text-xs">Últimas 50 gerações</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingLogs ? (
            <p className="text-sm text-muted-foreground p-4">Carregando...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Nenhuma geração</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Lista</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Canais</TableHead>
                    <TableHead className="hidden lg:table-cell">Tamanho</TableHead>
                    <TableHead>Tempo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.slice(0, 20).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="text-xs max-w-[100px] truncate">{log.list_name || 'N/A'}</TableCell>
                      <TableCell>
                        {log.cdn_upload_status === 'success' ? (
                          <Badge variant="default" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">{log.channels_count}</TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">{log.file_size ? `${(log.file_size / 1024).toFixed(1)}KB` : '-'}</TableCell>
                      <TableCell className="text-xs">{log.generation_time_ms}ms</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs de Geração - Mobile */}
      <div className="md:hidden space-y-3">
        <h3 className="text-sm font-medium">Histórico de Gerações</h3>
        {isLoadingLogs ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">Carregando...</CardContent></Card>
        ) : logs.length === 0 ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">Nenhuma geração</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {logs.slice(0, 10).map((log) => (
              <Card key={log.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{log.list_name || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{log.generation_time_ms}ms</span>
                      {log.cdn_upload_status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
