import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface M3UUsageStats {
  m3u_list_id: string;
  m3u_name: string;
  total_clients: number;
  active_clients: number;
  inactive_clients: number;
  percentage_usage: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#8DD1E1'];

export default function AdminM3UUsageReport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<M3UUsageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Buscar todas as atribuições de M3U com informações dos clientes
      const { data: assignments, error: assignmentsError } = await supabase
        .from('client_m3u_lists')
        .select(`
          m3u_list_id,
          is_active,
          m3u_lists!inner(name),
          clientes!inner(cliente_ativo, situacao)
        `);

      if (assignmentsError) throw assignmentsError;

      // Agrupar estatísticas por M3U list
      const statsMap = new Map<string, M3UUsageStats>();

      assignments?.forEach((assignment: any) => {
        const listId = assignment.m3u_list_id;
        const listName = assignment.m3u_lists.name;
        const isClientActive = assignment.clientes.cliente_ativo && 
                              assignment.clientes.situacao === 'Ativo';

        if (!statsMap.has(listId)) {
          statsMap.set(listId, {
            m3u_list_id: listId,
            m3u_name: listName,
            total_clients: 0,
            active_clients: 0,
            inactive_clients: 0,
            percentage_usage: 0,
          });
        }

        const stat = statsMap.get(listId)!;
        stat.total_clients++;
        
        if (isClientActive && assignment.is_active) {
          stat.active_clients++;
        } else {
          stat.inactive_clients++;
        }
      });

      // Calcular percentagens e ordenar
      const totalClients = Array.from(statsMap.values()).reduce(
        (sum, stat) => sum + stat.total_clients,
        0
      );

      const statsArray = Array.from(statsMap.values()).map(stat => ({
        ...stat,
        percentage_usage: totalClients > 0 
          ? Math.round((stat.total_clients / totalClients) * 100) 
          : 0,
      })).sort((a, b) => b.total_clients - a.total_clients);

      setStats(statsArray);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      toast({
        title: 'Erro ao carregar estatísticas',
        description: 'Não foi possível carregar as estatísticas de uso de playlists M3U.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();

    // Atualizar a cada 30 segundos
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const exportToCSV = () => {
    const headers = ['Playlist M3U', 'Total Clientes', 'Clientes Ativos', 'Clientes Inativos', 'Percentual de Uso'];
    const rows = stats.map(stat => [
      stat.m3u_name,
      stat.total_clients,
      stat.active_clients,
      stat.inactive_clients,
      `${stat.percentage_usage}%`,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `m3u_usage_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({
      title: 'Relatório exportado',
      description: 'O relatório foi exportado com sucesso.',
    });
  };

  const chartData = stats.map(stat => ({
    name: stat.m3u_name.length > 20 ? stat.m3u_name.substring(0, 20) + '...' : stat.m3u_name,
    'Clientes Ativos': stat.active_clients,
    'Clientes Inativos': stat.inactive_clients,
  }));

  const pieData = stats.map(stat => ({
    name: stat.m3u_name,
    value: stat.total_clients,
  }));

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Relatório de Uso de Playlists M3U</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Última atualização: {lastUpdate.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadStats} variant="outline" disabled={loading}>
              <TrendingUp className="h-4 w-4 mr-2" />
              {loading ? 'Atualizando...' : 'Atualizar'}
            </Button>
            <Button onClick={exportToCSV} disabled={stats.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total de Playlists</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.reduce((sum, stat) => sum + stat.total_clients, 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.reduce((sum, stat) => sum + stat.active_clients, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Clientes por Playlist</CardTitle>
              <CardDescription>Comparação entre clientes ativos e inativos</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Clientes Ativos" fill="#22c55e" />
                  <Bar dataKey="Clientes Inativos" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Participação no Total</CardTitle>
              <CardDescription>Percentual de uso por playlist</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Playlist</CardTitle>
            <CardDescription>
              Estatísticas detalhadas de uso de cada playlist M3U
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando estatísticas...
              </div>
            ) : stats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma playlist M3U encontrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Playlist M3U</TableHead>
                    <TableHead className="text-center">Total Clientes</TableHead>
                    <TableHead className="text-center">Clientes Ativos</TableHead>
                    <TableHead className="text-center">Clientes Inativos</TableHead>
                    <TableHead className="text-center">% de Uso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((stat) => (
                    <TableRow key={stat.m3u_list_id}>
                      <TableCell className="font-medium">{stat.m3u_name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{stat.total_clients}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-green-500">{stat.active_clients}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{stat.inactive_clients}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default">{stat.percentage_usage}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
