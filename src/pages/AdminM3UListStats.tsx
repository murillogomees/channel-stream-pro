import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, Edit, Download, TrendingUp, Clock, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface ListStats {
  list_id: string;
  list_name: string;
  total_views: number;
  total_edits: number;
  total_exports: number;
  last_activity: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export default function AdminM3UListStats() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const [period, setPeriod] = useState('7');
  const [isLoading, setIsLoading] = useState(true);
  const [topViewed, setTopViewed] = useState<ListStats[]>([]);
  const [topEdited, setTopEdited] = useState<ListStats[]>([]);
  const [topExported, setTopExported] = useState<ListStats[]>([]);
  const [activityByType, setActivityByType] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/auth');
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
    }
  }, [isAdmin, period]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const days = parseInt(period);
      const startDate = startOfDay(subDays(new Date(), days));
      const endDate = endOfDay(new Date());

      // Buscar histórico de visualizações no período
      const { data: history, error } = await supabase
        .from('m3u_view_history')
        .select(`
          id,
          m3u_list_id,
          view_type,
          viewed_at,
          m3u_lists (
            id,
            name
          )
        `)
        .gte('viewed_at', startDate.toISOString())
        .lte('viewed_at', endDate.toISOString())
        .order('viewed_at', { ascending: false });

      if (error) throw error;

      // Processar estatísticas
      const statsMap = new Map<string, ListStats>();
      const activityTypes: Record<string, number> = {
        view: 0,
        edit: 0,
        export: 0
      };

      history?.forEach(item => {
        const listId = item.m3u_list_id;
        const listName = (item.m3u_lists as any)?.name || 'Lista Desconhecida';
        
        if (!statsMap.has(listId)) {
          statsMap.set(listId, {
            list_id: listId,
            list_name: listName,
            total_views: 0,
            total_edits: 0,
            total_exports: 0,
            last_activity: item.viewed_at || ''
          });
        }

        const stats = statsMap.get(listId)!;
        
        if (item.view_type === 'view') {
          stats.total_views++;
          activityTypes.view++;
        } else if (item.view_type === 'edit') {
          stats.total_edits++;
          activityTypes.edit++;
        } else if (item.view_type === 'export') {
          stats.total_exports++;
          activityTypes.export++;
        }

        if (item.viewed_at && item.viewed_at > stats.last_activity) {
          stats.last_activity = item.viewed_at;
        }
      });

      const allStats = Array.from(statsMap.values());

      // Top mais visualizadas
      const sortedByViews = [...allStats].sort((a, b) => b.total_views - a.total_views).slice(0, 10);
      setTopViewed(sortedByViews);

      // Top mais editadas
      const sortedByEdits = [...allStats].sort((a, b) => b.total_edits - a.total_edits).slice(0, 10);
      setTopEdited(sortedByEdits);

      // Top mais exportadas
      const sortedByExports = [...allStats].sort((a, b) => b.total_exports - a.total_exports).slice(0, 10);
      setTopExported(sortedByExports);

      // Atividade por tipo
      setActivityByType([
        { name: 'Visualizações', value: activityTypes.view },
        { name: 'Edições', value: activityTypes.edit },
        { name: 'Exportações', value: activityTypes.export }
      ]);

    } catch (error: any) {
      console.error('Error loading stats:', error);
      toast.error('Erro ao carregar estatísticas', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Estatísticas de Listas M3U</h1>
          <p className="text-muted-foreground">
            Análise de uso e acesso às listas M3U
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => navigate('/admin/m3u-lists')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>

      {/* Atividade por Tipo */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição de Atividades</CardTitle>
          <CardDescription>Total de ações por tipo no período selecionado</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={activityByType}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="hsl(var(--primary))"
                dataKey="value"
              >
                {activityByType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Visualizadas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Top 10 Mais Visualizadas
            </CardTitle>
            <CardDescription>Listas com maior número de visualizações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topViewed.map((stat, index) => (
                <div key={stat.list_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{index + 1}</Badge>
                    <div>
                      <p className="font-medium">{stat.list_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Última atividade: {format(new Date(stat.last_activity), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <Badge>{stat.total_views} visualizações</Badge>
                </div>
              ))}
              {topViewed.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma visualização no período
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Editadas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Top 10 Mais Editadas
            </CardTitle>
            <CardDescription>Listas com maior número de edições</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topEdited.map((stat, index) => (
                <div key={stat.list_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{index + 1}</Badge>
                    <div>
                      <p className="font-medium">{stat.list_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Última atividade: {format(new Date(stat.last_activity), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <Badge>{stat.total_edits} edições</Badge>
                </div>
              ))}
              {topEdited.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma edição no período
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Exportadas */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Top 10 Mais Exportadas
            </CardTitle>
            <CardDescription>Listas com maior número de exportações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {topExported.map((stat, index) => (
                <div key={stat.list_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{index + 1}</Badge>
                    <div>
                      <p className="font-medium">{stat.list_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Última atividade: {format(new Date(stat.last_activity), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <Badge>{stat.total_exports} exportações</Badge>
                </div>
              ))}
              {topExported.length === 0 && (
                <p className="text-center text-muted-foreground py-8 col-span-2">
                  Nenhuma exportação no período
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
