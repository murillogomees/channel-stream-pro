/**
 * Bulk Download Panel - Enhanced CDN content download with filters and scheduling
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Download, 
  Filter, 
  Clock, 
  Play, 
  Pause, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  Folder,
  Film,
  Tv,
  Calendar,
  Zap,
  Search
} from 'lucide-react';

interface DownloadStats {
  total: number;
  pending: number;
  completed: number;
  failed: number;
  inProgress: number;
}

interface Category {
  group_title: string;
  count: number;
  selected: boolean;
}

export function BulkDownloadPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [stats, setStats] = useState<DownloadStats>({ total: 0, pending: 0, completed: 0, failed: 0, inProgress: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtros
  const [filters, setFilters] = useState({
    contentType: 'all', // all, vod, live
    onlyNew: true, // Apenas canais não baixados
    maxChannels: 100,
    categories: [] as string[],
  });

  // Agendamento
  const [schedule, setSchedule] = useState({
    enabled: false,
    frequency: 'daily', // daily, weekly, hourly
    hour: 3, // 3:00 AM
    dayOfWeek: 0, // Sunday
  });

  // Progresso
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentChannel: '',
    startedAt: null as Date | null,
  });

  useEffect(() => {
    loadStats();
    loadCategories();
    loadSchedule();
  }, []);

  const loadStats = async () => {
    try {
      // Contar total de canais
      const { count: total } = await supabase
        .from('m3u_channels')
        .select('*', { count: 'exact', head: true });

      // Contar canais no R2
      const { count: completed } = await supabase
        .from('r2_storage_objects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ready');

      // Contar pendentes (não no R2)
      const { count: pending } = await supabase
        .from('m3u_channels')
        .select('*', { count: 'exact', head: true })
        .is('cf_stream_uid', null);

      setStats({
        total: total || 0,
        pending: pending || 0,
        completed: completed || 0,
        failed: 0,
        inProgress: 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('m3u_channels')
        .select('group_title')
        .not('group_title', 'is', null);

      if (error) throw error;

      // Agrupar e contar
      const grouped = (data || []).reduce((acc, item) => {
        const title = item.group_title || 'Sem Categoria';
        acc[title] = (acc[title] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const categoryList = Object.entries(grouped)
        .map(([group_title, count]) => ({
          group_title,
          count: count as number,
          selected: false,
        }))
        .sort((a, b) => b.count - a.count);

      setCategories(categoryList);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from('content_routing_config')
        .select('config_value')
        .eq('config_key', 'cdn_download_schedule')
        .maybeSingle();

      if (data?.config_value && typeof data.config_value === 'object') {
        setSchedule(prev => ({ ...prev, ...(data.config_value as any) }));
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
  };

  const saveSchedule = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('content_routing_config')
        .upsert(
          {
            config_key: 'cdn_download_schedule',
            config_value: schedule,
            description: 'Agendamento de download automático para R2',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'config_key' }
        );

      if (error) throw error;

      toast({
        title: 'Agendamento salvo',
        description: schedule.enabled 
          ? `Downloads automáticos ${schedule.frequency === 'daily' ? 'diários às ' + schedule.hour + ':00' : schedule.frequency}`
          : 'Agendamento desabilitado',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (groupTitle: string) => {
    setCategories(prev => 
      prev.map(cat => 
        cat.group_title === groupTitle 
          ? { ...cat, selected: !cat.selected }
          : cat
      )
    );
  };

  const selectAllCategories = (selected: boolean) => {
    setCategories(prev => prev.map(cat => ({ ...cat, selected })));
  };

  const startBulkDownload = async () => {
    const selectedCategories = categories.filter(c => c.selected).map(c => c.group_title);
    
    setDownloading(true);
    setProgress({
      current: 0,
      total: filters.maxChannels,
      currentChannel: 'Iniciando...',
      startedAt: new Date(),
    });

    try {
      toast({
        title: 'Download iniciado',
        description: `Processando até ${filters.maxChannels} canais...`,
      });

      const { data, error } = await supabase.functions.invoke('cdn-bulk-downloader', {
        body: {
          maxChannels: filters.maxChannels,
          contentType: filters.contentType,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
          onlyNew: filters.onlyNew,
        }
      });

      if (error) throw error;

      toast({
        title: 'Download em progresso',
        description: data.message || `${data.channelsCount} canais sendo processados em background`,
      });

      // Iniciar polling de progresso
      pollProgress();

    } catch (error: any) {
      toast({
        title: 'Erro ao iniciar download',
        description: error.message,
        variant: 'destructive',
      });
      setDownloading(false);
    }
  };

  const pollProgress = () => {
    const interval = setInterval(async () => {
      await loadStats();
      
      // Verificar se terminou
      if (stats.inProgress === 0 && downloading) {
        clearInterval(interval);
        setDownloading(false);
        toast({
          title: 'Download concluído',
          description: `${stats.completed} arquivos baixados com sucesso`,
        });
      }
    }, 5000);

    // Parar após 10 minutos
    setTimeout(() => {
      clearInterval(interval);
      setDownloading(false);
    }, 600000);
  };

  const filteredCategories = categories.filter(cat =>
    cat.group_title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCount = categories.filter(c => c.selected).reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Canais</p>
                <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
              </div>
              <Tv className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">No R2</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed.toLocaleString()}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending.toLocaleString()}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cobertura</p>
                <p className="text-2xl font-bold">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                </p>
              </div>
              <Download className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {downloading && (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Baixando: {progress.currentChannel}</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="filters" className="space-y-4">
        <TabsList>
          <TabsTrigger value="filters" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros & Download
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <Calendar className="h-4 w-4" />
            Agendamento
          </TabsTrigger>
        </TabsList>

        {/* Tab: Filtros */}
        <TabsContent value="filters">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros de Download
              </CardTitle>
              <CardDescription>
                Selecione quais canais baixar para o R2 CDN
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tipo de Conteúdo */}
              <div className="space-y-2">
                <Label>Tipo de Conteúdo</Label>
                <Select 
                  value={filters.contentType} 
                  onValueChange={(v) => setFilters({ ...filters, contentType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Tv className="h-4 w-4" /> Todos
                      </div>
                    </SelectItem>
                    <SelectItem value="vod">
                      <div className="flex items-center gap-2">
                        <Film className="h-4 w-4" /> Apenas VOD (Filmes/Séries)
                      </div>
                    </SelectItem>
                    <SelectItem value="live">
                      <div className="flex items-center gap-2">
                        <Tv className="h-4 w-4" /> Apenas Live
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Opções */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="onlyNew" 
                    checked={filters.onlyNew}
                    onCheckedChange={(checked) => setFilters({ ...filters, onlyNew: !!checked })}
                  />
                  <Label htmlFor="onlyNew">Apenas canais não baixados</Label>
                </div>
                <div className="space-y-2">
                  <Label>Máximo de Canais</Label>
                  <Input
                    type="number"
                    value={filters.maxChannels}
                    onChange={(e) => setFilters({ ...filters, maxChannels: parseInt(e.target.value) || 100 })}
                    min={1}
                    max={10000}
                  />
                </div>
              </div>

              {/* Seletor de Categorias */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Categorias ({categories.length})</Label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => selectAllCategories(true)}>
                      Selecionar Tudo
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => selectAllCategories(false)}>
                      Limpar
                    </Button>
                  </div>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar categoria..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <ScrollArea className="h-64 border rounded-lg p-2">
                  <div className="space-y-1">
                    {filteredCategories.map((cat) => (
                      <div 
                        key={cat.group_title}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                          cat.selected ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                        }`}
                        onClick={() => toggleCategory(cat.group_title)}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox checked={cat.selected} />
                          <Folder className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm truncate max-w-[300px]">{cat.group_title}</span>
                        </div>
                        <Badge variant="secondary">{cat.count}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {categories.filter(c => c.selected).length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {categories.filter(c => c.selected).length} categorias selecionadas 
                    ({selectedCount.toLocaleString()} canais)
                  </p>
                )}
              </div>

              {/* Botão de Download */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  onClick={startBulkDownload} 
                  disabled={downloading}
                  className="flex-1"
                  size="lg"
                >
                  {downloading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Baixando...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Iniciar Download ({selectedCount > 0 ? selectedCount.toLocaleString() : filters.maxChannels} canais)
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={loadStats} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Agendamento */}
        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Agendamento Automático
              </CardTitle>
              <CardDescription>
                Configure downloads automáticos periódicos para manter o R2 atualizado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Download Automático</Label>
                  <p className="text-sm text-muted-foreground">
                    Baixar novos canais automaticamente
                  </p>
                </div>
                <Switch
                  checked={schedule.enabled}
                  onCheckedChange={(checked) => setSchedule({ ...schedule, enabled: checked })}
                />
              </div>

              {schedule.enabled && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Frequência</Label>
                      <Select 
                        value={schedule.frequency}
                        onValueChange={(v) => setSchedule({ ...schedule, frequency: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">A cada hora</SelectItem>
                          <SelectItem value="daily">Diário</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {schedule.frequency !== 'hourly' && (
                      <div className="space-y-2">
                        <Label>Horário (Hora)</Label>
                        <Select
                          value={schedule.hour.toString()}
                          onValueChange={(v) => setSchedule({ ...schedule, hour: parseInt(v) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i.toString().padStart(2, '0')}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {schedule.frequency === 'weekly' && (
                      <div className="space-y-2">
                        <Label>Dia da Semana</Label>
                        <Select
                          value={schedule.dayOfWeek.toString()}
                          onValueChange={(v) => setSchedule({ ...schedule, dayOfWeek: parseInt(v) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Domingo</SelectItem>
                            <SelectItem value="1">Segunda</SelectItem>
                            <SelectItem value="2">Terça</SelectItem>
                            <SelectItem value="3">Quarta</SelectItem>
                            <SelectItem value="4">Quinta</SelectItem>
                            <SelectItem value="5">Sexta</SelectItem>
                            <SelectItem value="6">Sábado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">
                      <Zap className="h-4 w-4 inline mr-1" />
                      <strong>Próxima execução:</strong>{' '}
                      {schedule.frequency === 'hourly' 
                        ? 'A cada hora cheia'
                        : schedule.frequency === 'daily'
                          ? `Todos os dias às ${schedule.hour.toString().padStart(2, '0')}:00`
                          : `Toda ${['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][schedule.dayOfWeek]} às ${schedule.hour.toString().padStart(2, '0')}:00`
                      }
                    </p>
                  </div>
                </div>
              )}

              <Button onClick={saveSchedule} disabled={loading} className="w-full">
                {loading ? 'Salvando...' : 'Salvar Agendamento'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
