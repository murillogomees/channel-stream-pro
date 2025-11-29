import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, Edit, Download, TrendingUp, Clock } from 'lucide-react';
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
  const [period, setPeriod] = useState('7');
  const [isLoading, setIsLoading] = useState(true);
  const [topViewed, setTopViewed] = useState<ListStats[]>([]);
  const [topEdited, setTopEdited] = useState<ListStats[]>([]);
  const [topExported, setTopExported] = useState<ListStats[]>([]);
  const [activityByType, setActivityByType] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, [period]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold">Estatísticas M3U</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Análise de uso das listas</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
            <SelectItem value="365">1 ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Gráfico de Pizza - responsivo */}
      <Card>
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="text-base">Distribuição de Atividades</CardTitle>
          <CardDescription className="text-xs">Total por tipo no período</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={activityByType}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={70}
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

      {/* Grid responsivo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Visualizadas */}
        <Card>
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Eye className="h-4 w-4" />
              Mais Visualizadas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {topViewed.map((stat, index) => (
                <div key={stat.list_id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge variant="secondary" className="flex-shrink-0 text-xs">{index + 1}</Badge>
                    <span className="font-medium text-xs sm:text-sm truncate">{stat.list_name}</span>
                  </div>
                  <Badge className="text-xs flex-shrink-0">{stat.total_views}</Badge>
                </div>
              ))}
              {topViewed.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">Sem dados</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Editadas */}
        <Card>
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Edit className="h-4 w-4" />
              Mais Editadas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {topEdited.map((stat, index) => (
                <div key={stat.list_id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge variant="secondary" className="flex-shrink-0 text-xs">{index + 1}</Badge>
                    <span className="font-medium text-xs sm:text-sm truncate">{stat.list_name}</span>
                  </div>
                  <Badge className="text-xs flex-shrink-0">{stat.total_edits}</Badge>
                </div>
              ))}
              {topEdited.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">Sem dados</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Exportadas */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Download className="h-4 w-4" />
              Mais Exportadas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
              {topExported.map((stat, index) => (
                <div key={stat.list_id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge variant="secondary" className="flex-shrink-0 text-xs">{index + 1}</Badge>
                    <span className="font-medium text-xs sm:text-sm truncate">{stat.list_name}</span>
                  </div>
                  <Badge className="text-xs flex-shrink-0">{stat.total_exports}</Badge>
                </div>
              ))}
              {topExported.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4 col-span-2">Sem dados</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
