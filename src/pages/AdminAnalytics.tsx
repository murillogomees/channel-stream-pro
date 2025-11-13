import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Users, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClientes } from "@/hooks/useClientes";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

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
        <div className="grid gap-4 md:grid-cols-3">
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
              <CardTitle className="text-sm font-medium">Origem Mais Comum</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {chartData.length > 0 ? chartData.sort((a, b) => b.value - a.value)[0].name : '-'}
              </div>
              <p className="text-xs text-muted-foreground">
                {chartData.length > 0 ? `${chartData.sort((a, b) => b.value - a.value)[0].value} clientes` : 'Sem dados'}
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
