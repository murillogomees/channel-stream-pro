import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Users, Calendar, Target, Award, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClientes } from "@/hooks/useClientes";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line } from "recharts";

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const { clientes } = useClientes();

  // Processar dados de origem
  const origemData = clientes.reduce((acc, cliente) => {
    const origem = cliente.origemCadastro || 'Não informado';
    acc[origem] = (acc[origem] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(origemData).map(([name, value]) => ({
    name,
    value,
    percentage: ((value / clientes.length) * 100).toFixed(1)
  }));

  // Cores para o gráfico
  const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  // Dados por situação
  const situacaoData = clientes.reduce((acc, cliente) => {
    acc[cliente.situacao] = (acc[cliente.situacao] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const situacaoChartData = Object.entries(situacaoData).map(([name, value]) => ({
    name,
    value,
    percentage: ((value / clientes.length) * 100).toFixed(1)
  }));

  // Dados por plano
  const planoData = clientes.reduce((acc, cliente) => {
    acc[cliente.plano] = (acc[cliente.plano] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const planoChartData = Object.entries(planoData).map(([name, value]) => ({
    name,
    value
  }));

  // Dados de conversão por origem
  const conversaoData = clientes.reduce((acc, cliente) => {
    const origem = cliente.origemCadastro || 'Não informado';
    if (!acc[origem]) {
      acc[origem] = { total: 0, ativos: 0 };
    }
    acc[origem].total += 1;
    if (cliente.clienteAtivo || cliente.situacao === 'Ativo') {
      acc[origem].ativos += 1;
    }
    return acc;
  }, {} as Record<string, { total: number; ativos: number }>);

  const conversaoChartData = Object.entries(conversaoData).map(([name, data]) => ({
    name,
    total: data.total,
    ativos: data.ativos,
    inativos: data.total - data.ativos,
    taxa: ((data.ativos / data.total) * 100).toFixed(1)
  })).sort((a, b) => parseFloat(b.taxa) - parseFloat(a.taxa));

  // Calcular métricas gerais de conversão
  const totalClientes = clientes.length;
  const clientesAtivos = clientes.filter(c => c.clienteAtivo || c.situacao === 'Ativo').length;
  const taxaConversaoGeral = totalClientes > 0 ? ((clientesAtivos / totalClientes) * 100).toFixed(1) : '0';
  const melhorOrigem = conversaoChartData.length > 0 ? conversaoChartData[0] : null;

  const getConversaoColor = (taxa: number) => {
    if (taxa >= 70) return 'text-green-500';
    if (taxa >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getConversaoBadge = (taxa: number) => {
    if (taxa >= 70) return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Excelente</Badge>;
    if (taxa >= 40) return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Bom</Badge>;
    return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Baixo</Badge>;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} clientes ({payload[0].payload.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/admin/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Analytics de Cadastros</h1>
              <p className="text-muted-foreground">Análise detalhada das origens e estatísticas dos clientes</p>
            </div>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clientes.length}</div>
              <p className="text-xs text-muted-foreground">
                Todos os cadastros no sistema
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conversão Geral</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getConversaoColor(parseFloat(taxaConversaoGeral))}`}>
                {taxaConversaoGeral}%
              </div>
              <p className="text-xs text-muted-foreground">
                {clientesAtivos} de {totalClientes} ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Melhor Canal</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {melhorOrigem ? melhorOrigem.name : '-'}
              </div>
              <p className="text-xs text-muted-foreground">
                {melhorOrigem ? `${melhorOrigem.taxa}% de conversão` : 'Sem dados'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fontes Diferentes</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{chartData.length}</div>
              <p className="text-xs text-muted-foreground">
                Origens de cadastro identificadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Seção de Conversão */}
        <Card>
          <CardHeader>
            <CardTitle>Relatório de Conversão por Canal</CardTitle>
            <CardDescription>
              Análise de quantos leads de cada origem se tornaram clientes ativos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={conversaoChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold text-foreground mb-2">{payload[0].payload.name}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-muted-foreground">
                                Total: <span className="font-medium text-foreground">{payload[0].payload.total}</span>
                              </p>
                              <p className="text-green-500">
                                Ativos: <span className="font-medium">{payload[0].payload.ativos}</span>
                              </p>
                              <p className="text-red-500">
                                Inativos: <span className="font-medium">{payload[0].payload.inativos}</span>
                              </p>
                              <p className="text-blue-500 font-bold">
                                Taxa: {payload[0].payload.taxa}%
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="ativos" fill="hsl(var(--chart-1))" name="Clientes Ativos" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="inativos" fill="hsl(var(--chart-3))" name="Clientes Inativos" radius={[8, 8, 0, 0]} />
                  <Line type="monotone" dataKey="taxa" stroke="hsl(var(--primary))" strokeWidth={2} name="Taxa de Conversão (%)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Tabela Detalhada de Conversão */}
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Detalhamento por Canal</h4>
              {conversaoChartData.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/5 transition-smooth">
                  <div className="flex items-center gap-4 flex-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.ativos} ativos de {item.total} cadastrados
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${getConversaoColor(parseFloat(item.taxa))}`}>
                        {item.taxa}%
                      </p>
                      <p className="text-xs text-muted-foreground">conversão</p>
                    </div>
                    {getConversaoBadge(parseFloat(item.taxa))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Gráficos */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Gráfico de Pizza - Origem */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Origem</CardTitle>
              <CardDescription>
                Visualização das fontes de cadastro dos clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Pizza - Situação */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Situação</CardTitle>
              <CardDescription>
                Status dos clientes cadastrados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={situacaoChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {situacaoChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Barras - Planos */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Plano</CardTitle>
            <CardDescription>
              Quantidade de clientes em cada plano de assinatura
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planoChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold text-foreground">{payload[0].payload.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {payload[0].value} clientes
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tabela Detalhada */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Origem</CardTitle>
            <CardDescription>
              Lista completa de origens e quantidade de cadastros
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {chartData.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium text-foreground">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">{item.value}</p>
                    <p className="text-sm text-muted-foreground">{item.percentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalytics;
