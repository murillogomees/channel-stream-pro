import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, TrendingUp, Users, Calendar, Target, Award, TrendingDown, DollarSign, AlertTriangle, Download, ArrowUpRight, ArrowDownRight, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfiles } from '@/hooks/useProfiles';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line, LineChart, AreaChart, Area } from "recharts";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";

type PeriodFilter = '7' | '30' | '90' | '365' | 'all';

interface MarketingInvestment {
  [canal: string]: number;
}

const INVESTMENT_STORAGE_KEY = 'marketing_investments';

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const { profiles } = useProfiles();
  
  // Estado para filtro de período
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  
  // Estado para metas de conversão por canal
  const [conversionGoals, setConversionGoals] = useState<Record<string, number>>({
    'Google Ads': 50,
    'Facebook': 40,
    'Instagram': 45,
    'Indicação': 70,
    'Website': 35,
    'Outro': 30
  });

  // Estado para investimentos em marketing por canal
  const [marketingInvestments, setMarketingInvestments] = useState<MarketingInvestment>(() => {
    const stored = localStorage.getItem(INVESTMENT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {
      'Google Ads': 0,
      'Facebook': 0,
      'Instagram': 0,
      'Indicação': 0,
      'Website': 0,
      'Outro': 0
    };
  });

  // Salvar investimentos no localStorage
  useEffect(() => {
    localStorage.setItem(INVESTMENT_STORAGE_KEY, JSON.stringify(marketingInvestments));
  }, [marketingInvestments]);

  // Atualizar investimento de um canal
  const updateInvestment = (canal: string, valor: number) => {
    setMarketingInvestments(prev => ({
      ...prev,
      [canal]: valor
    }));
  };

  // Filtrar clientes por período
  const filteredClientes = useMemo(() => {
    if (periodFilter === 'all') return profiles;
    
    const now = new Date();
    const daysAgo = parseInt(periodFilter);
    const filterDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    
    return profiles.filter(profile => {
      if (!profile.created_at) return false;
      const cadastroDate = new Date(profile.created_at);
      return cadastroDate >= filterDate;
    });
  }, [profiles, periodFilter]);

  // Calcular período anterior para comparação
  const previousPeriodClientes = useMemo(() => {
    if (periodFilter === 'all') return [];
    
    const now = new Date();
    const daysAgo = parseInt(periodFilter);
    const currentPeriodStart = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    const previousPeriodStart = new Date(currentPeriodStart.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    
    return profiles.filter(profile => {
      if (!profile.created_at) return false;
      const cadastroDate = new Date(profile.created_at);
      return cadastroDate >= previousPeriodStart && cadastroDate < currentPeriodStart;
    });
  }, [profiles, periodFilter]);

  // Função para exportar dados para CSV
  const exportToCSV = () => {
    try {
      // Cabeçalhos do CSV
      const headers = [
        'Canal',
        'Total Leads',
        'Clientes Ativos',
        'Taxa de Conversão (%)',
        'Meta (%)',
        'Status Meta',
        'Receita Total (R$)',
        'Valor Médio (R$)',
        'Leads',
        'Testando',
        'Ativos'
      ];
      
      // Dados das linhas
      const rows = conversaoChartData.map((item, index) => {
        const meta = conversionGoals[item.name] || 0;
        const taxa = parseFloat(item.taxa);
        const statusMeta = taxa >= meta ? 'Atingida' : 'Abaixo da Meta';
        const roi = roiChartData.find(r => r.origem === item.name);
        const funil = funnelChartData.find(f => f.origem === item.name);
        
        return [
          item.name,
          item.total,
          item.ativos,
          item.taxa,
          meta,
          statusMeta,
          roi?.receitaTotal.toFixed(2) || '0.00',
          roi?.valorMedio.toFixed(2) || '0.00',
          funil?.Lead || 0,
          funil?.Testando || 0,
          funil?.Ativo || 0
        ];
      });
      
      // Adicionar totais
      rows.push([
        'TOTAL',
        totalClientes,
        clientesAtivos,
        taxaConversaoGeral,
        '-',
        '-',
        receitaTotal.toFixed(2),
        '-',
        '-',
        '-',
        '-'
      ]);
      
      // Criar CSV
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `analytics-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      toast.error('Erro ao exportar relatório');
    }
  };

  // Verificar metas e disparar alertas
  const checkConversionGoals = () => {
    const belowGoal = conversaoChartData.filter(item => {
      const meta = conversionGoals[item.name] || 0;
      const taxa = parseFloat(item.taxa);
      return taxa < meta && meta > 0;
    });
    
    if (belowGoal.length > 0) {
      toast.warning(
        `${belowGoal.length} canal(is) abaixo da meta de conversão`,
        {
          description: belowGoal.map(item => `${item.name}: ${item.taxa}%`).join(', '),
          action: {
            label: 'Ver detalhes',
            onClick: () => {
              document.getElementById('metas-section')?.scrollIntoView({ behavior: 'smooth' });
            }
          }
        }
      );
    } else {
      toast.success('Todas as metas estão sendo atingidas! 🎉');
    }
  };

  // Processar dados de origem
  const origemData = filteredClientes.reduce((acc, cliente) => {
    const origem = cliente.origemCadastro || 'Não informado';
    acc[origem] = (acc[origem] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(origemData).map(([name, value]) => ({
    name,
    value,
    percentage: ((value / filteredClientes.length) * 100).toFixed(1)
  }));

  // Dados do período anterior
  const previousOrigemData = previousPeriodClientes.reduce((acc, cliente) => {
    const origem = cliente.origemCadastro || 'Não informado';
    acc[origem] = (acc[origem] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Cores para o gráfico
  const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  // Dados por situação
  const situacaoData = filteredClientes.reduce((acc, cliente) => {
    acc[cliente.situacao] = (acc[cliente.situacao] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const situacaoChartData = Object.entries(situacaoData).map(([name, value]) => ({
    name,
    value,
    percentage: ((value / filteredClientes.length) * 100).toFixed(1)
  }));

  // Dados por plano
  const planoData = filteredClientes.reduce((acc, cliente) => {
    acc[cliente.plano] = (acc[cliente.plano] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const planoChartData = Object.entries(planoData).map(([name, value]) => ({
    name,
    value
  }));

  // Dados de conversão por origem
  const conversaoData = filteredClientes.reduce((acc, cliente) => {
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
  const totalClientes = filteredClientes.length;
  const clientesAtivos = filteredClientes.filter(c => c.clienteAtivo || c.situacao === 'Ativo').length;
  const previousTotalClientes = previousPeriodClientes.length;
  const previousClientesAtivos = previousPeriodClientes.filter(c => c.clienteAtivo || c.situacao === 'Ativo').length;
  const taxaConversaoGeral = totalClientes > 0 ? ((clientesAtivos / totalClientes) * 100).toFixed(1) : '0';
  const previousTaxaConversao = previousTotalClientes > 0 ? ((previousClientesAtivos / previousTotalClientes) * 100).toFixed(1) : '0';
  const melhorOrigem = conversaoChartData.length > 0 ? conversaoChartData[0] : null;

  // Calcular variações percentuais
  const clientesGrowth = previousTotalClientes > 0 
    ? (((totalClientes - previousTotalClientes) / previousTotalClientes) * 100).toFixed(1)
    : '0';
  const conversaoGrowth = parseFloat(previousTaxaConversao) > 0
    ? (parseFloat(taxaConversaoGeral) - parseFloat(previousTaxaConversao)).toFixed(1)
    : '0';

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

  // Análise temporal - conversão ao longo dos meses
  const temporalData = filteredClientes.reduce((acc, cliente) => {
    if (!cliente.dataCadastro) return acc;
    const date = new Date(cliente.dataCadastro);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const origem = cliente.origemCadastro || 'Não informado';
    
    if (!acc[monthKey]) {
      acc[monthKey] = {};
    }
    if (!acc[monthKey][origem]) {
      acc[monthKey][origem] = { total: 0, ativos: 0 };
    }
    
    acc[monthKey][origem].total += 1;
    if (cliente.clienteAtivo || cliente.situacao === 'Ativo') {
      acc[monthKey][origem].ativos += 1;
    }
    
    return acc;
  }, {} as Record<string, Record<string, { total: number; ativos: number }>>);

  const temporalChartData = Object.entries(temporalData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, origens]) => {
      const dataPoint: any = { month };
      Object.entries(origens).forEach(([origem, data]) => {
        dataPoint[origem] = ((data.ativos / data.total) * 100).toFixed(1);
      });
      return dataPoint;
    });

  // Análise de funil de conversão
  const funnelData = filteredClientes.reduce((acc, cliente) => {
    const origem = cliente.origemCadastro || 'Não informado';
    if (!acc[origem]) {
      acc[origem] = { lead: 0, testando: 0, ativo: 0 };
    }
    
    if (cliente.situacao === 'Lead') {
      acc[origem].lead += 1;
    } else if (cliente.situacao === 'Testando') {
      acc[origem].testando += 1;
    } else if (cliente.situacao === 'Ativo') {
      acc[origem].ativo += 1;
    }
    
    return acc;
  }, {} as Record<string, { lead: number; testando: number; ativo: number }>);

  const funnelChartData = Object.entries(funnelData).map(([origem, stages]) => {
    const total = stages.lead + stages.testando + stages.ativo;
    const leadToTest = total > 0 ? ((stages.testando + stages.ativo) / total * 100).toFixed(1) : '0';
    const testToActive = (stages.testando + stages.ativo) > 0 ? (stages.ativo / (stages.testando + stages.ativo) * 100).toFixed(1) : '0';
    
    return {
      origem,
      Lead: stages.lead,
      Testando: stages.testando,
      Ativo: stages.ativo,
      taxaLeadToTest: parseFloat(leadToTest),
      taxaTestToActive: parseFloat(testToActive)
    };
  });

  // Análise de ROI - Receita por canal
  const roiData = filteredClientes.reduce((acc, cliente) => {
    const origem = cliente.origemCadastro || 'Não informado';
    if (!acc[origem]) {
      acc[origem] = { totalReceita: 0, count: 0, clientes: [] };
    }
    
    const valor = cliente.valorPago || 0;
    acc[origem].totalReceita += valor;
    acc[origem].count += 1;
    if (valor > 0) {
      acc[origem].clientes.push(valor);
    }
    
    return acc;
  }, {} as Record<string, { totalReceita: number; count: number; clientes: number[] }>);

  const roiChartData = Object.entries(roiData)
    .map(([origem, data]) => ({
      origem,
      receitaTotal: data.totalReceita,
      valorMedio: data.clientes.length > 0 ? data.totalReceita / data.clientes.length : 0,
      clientesPagantes: data.clientes.length,
      totalClientes: data.count
    }))
    .sort((a, b) => b.receitaTotal - a.receitaTotal);

  const receitaTotal = roiChartData.reduce((sum, item) => sum + item.receitaTotal, 0);
  const melhorROI = roiChartData.length > 0 ? roiChartData[0] : null;

  // Análise de CAC e ROI Real
  const cacRoiData = roiChartData.map(item => {
    const investimento = marketingInvestments[item.origem] || 0;
    const cac = item.totalClientes > 0 ? investimento / item.totalClientes : 0;
    const roiReal = investimento > 0 ? ((item.receitaTotal - investimento) / investimento * 100) : 0;
    const lucro = item.receitaTotal - investimento;
    
    return {
      ...item,
      investimento,
      cac,
      roiReal,
      lucro
    };
  }).sort((a, b) => b.roiReal - a.roiReal);

  const investimentoTotal = Object.values(marketingInvestments).reduce((sum, val) => sum + val, 0);
  const lucroTotal = receitaTotal - investimentoTotal;
  const roiGeralReal = investimentoTotal > 0 ? ((receitaTotal - investimentoTotal) / investimentoTotal * 100) : 0;
  const melhorCanalROI = cacRoiData.length > 0 ? cacRoiData[0] : null;

  // Análise de tendência de receita mensal
  const receitaMensal = filteredClientes.reduce((acc, cliente) => {
    if (!cliente.dataCadastro || !cliente.valorPago) return acc;
    const date = new Date(cliente.dataCadastro);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!acc[monthKey]) {
      acc[monthKey] = 0;
    }
    acc[monthKey] += cliente.valorPago;
    
    return acc;
  }, {} as Record<string, number>);

  const receitaMensalData = Object.entries(receitaMensal)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, receita]) => ({
      month,
      receita: parseFloat(receita.toFixed(2))
    }));

  // Previsão de receita baseada em média móvel (últimos 3 meses)
  const calcularPrevisao = () => {
    if (receitaMensalData.length < 3) return [];
    
    const ultimos3Meses = receitaMensalData.slice(-3);
    const mediaMovel = ultimos3Meses.reduce((sum, item) => sum + item.receita, 0) / 3;
    
    // Calcular taxa de crescimento
    const crescimento = receitaMensalData.length >= 2
      ? (receitaMensalData[receitaMensalData.length - 1].receita - receitaMensalData[receitaMensalData.length - 2].receita) / receitaMensalData[receitaMensalData.length - 2].receita
      : 0;
    
    // Gerar previsão para próximos 3 meses
    const ultimoMes = receitaMensalData[receitaMensalData.length - 1];
    const [ano, mes] = ultimoMes.month.split('-').map(Number);
    
    const previsoes = [];
    for (let i = 1; i <= 3; i++) {
      const novoMes = new Date(ano, mes - 1 + i, 1);
      const monthKey = `${novoMes.getFullYear()}-${String(novoMes.getMonth() + 1).padStart(2, '0')}`;
      const previsaoValor = mediaMovel * (1 + (crescimento * i * 0.5)); // Crescimento amortecido
      
      previsoes.push({
        month: monthKey,
        receita: null,
        previsao: parseFloat(previsaoValor.toFixed(2))
      });
    }
    
    return previsoes;
  };

  const previsaoReceita = calcularPrevisao();
  const receitaComPrevisao = [
    ...receitaMensalData.map(item => ({ ...item, previsao: null })),
    ...previsaoReceita
  ];

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
    <div className="min-h-screen bg-background p-3 sm:p-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
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
          
          <div className="flex items-center gap-3">
            <Select value={periodFilter} onValueChange={(value) => setPeriodFilter(value as PeriodFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
                <SelectItem value="all">Todo o período</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={checkConversionGoals} variant="outline" className="gap-2">
              <Bell className="h-4 w-4" />
              Verificar Metas
            </Button>
            
            <Button onClick={exportToCSV} className="gap-2">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{filteredClientes.length}</div>
                {periodFilter !== 'all' && parseFloat(clientesGrowth) !== 0 && (
                  <Badge variant={parseFloat(clientesGrowth) > 0 ? "default" : "destructive"} className="gap-1">
                    {parseFloat(clientesGrowth) > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(parseFloat(clientesGrowth))}%
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {periodFilter === 'all' ? 'Todos os cadastros' : `Novos no período selecionado`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conversão Geral</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className={`text-2xl font-bold ${getConversaoColor(parseFloat(taxaConversaoGeral))}`}>
                  {taxaConversaoGeral}%
                </div>
                {periodFilter !== 'all' && parseFloat(conversaoGrowth) !== 0 && (
                  <Badge variant={parseFloat(conversaoGrowth) > 0 ? "default" : "destructive"} className="gap-1">
                    {parseFloat(conversaoGrowth) > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(parseFloat(conversaoGrowth))}pp
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {clientesAtivos} de {totalClientes} ativos
                {periodFilter !== 'all' && ` | Anterior: ${previousTaxaConversao}%`}
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Lucro: R$ {lucroTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ROI Real Geral</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${roiGeralReal >= 100 ? 'text-green-500' : roiGeralReal >= 0 ? 'text-yellow-500' : 'text-red-500'}`}>
                {roiGeralReal.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {melhorCanalROI ? `Melhor: ${melhorCanalROI.origem}` : 'Configure investimentos'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sistema de Metas de Conversão */}
        <Card id="metas-section">
          <CardHeader>
            <CardTitle>Metas de Conversão por Canal</CardTitle>
            <CardDescription>
              Defina e acompanhe as taxas de conversão esperadas para cada canal de marketing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {conversaoChartData.map((item, index) => {
                const meta = conversionGoals[item.name] || 0;
                const taxa = parseFloat(item.taxa);
                const abaixoDaMeta = taxa < meta;
                const percentualMeta = meta > 0 ? ((taxa / meta) * 100).toFixed(0) : '0';
                
                return (
                  <div key={index} className="flex items-center gap-4 p-4 border border-border rounded-lg">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.ativos} ativos de {item.total} leads
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-right">
                        <p className={`text-xl font-bold ${getConversaoColor(taxa)}`}>
                          {item.taxa}%
                        </p>
                        <p className="text-xs text-muted-foreground">atual</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={meta}
                          onChange={(e) => setConversionGoals(prev => ({
                            ...prev,
                            [item.name]: parseFloat(e.target.value) || 0
                          }))}
                          className="w-20 h-9 text-sm"
                          min="0"
                          max="100"
                        />
                        <span className="text-xs text-muted-foreground">% meta</span>
                      </div>
                      
                      {abaixoDaMeta && (
                        <Badge className="bg-red-500/10 text-red-500 border-red-500/20 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {percentualMeta}% da meta
                        </Badge>
                      )}
                      {!abaixoDaMeta && meta > 0 && (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          Meta atingida
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Dashboard de CAC e ROI Real */}
        <Card>
          <CardHeader>
            <CardTitle>Custo de Aquisição (CAC) e ROI Real por Canal</CardTitle>
            <CardDescription>
              Configure o investimento em marketing e visualize CAC, ROI real e lucratividade de cada canal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-2 border-primary/20 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground mb-1">Investimento Total</div>
                    <div className="text-2xl font-bold text-foreground">
                      R$ {investimentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-2 border-green-500/20 bg-green-500/5">
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground mb-1">Lucro Total</div>
                    <div className={`text-2xl font-bold ${lucroTotal >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      R$ {lucroTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-2 border-blue-500/20 bg-blue-500/5">
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground mb-1">ROI Real Geral</div>
                    <div className={`text-2xl font-bold ${roiGeralReal >= 100 ? 'text-green-500' : roiGeralReal >= 0 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {roiGeralReal.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Configurar Investimento por Canal</h4>
              {cacRoiData.map((item, index) => (
                <div key={index} className="p-4 border border-border rounded-lg hover:bg-accent/5 transition-smooth">
                  <div className="flex items-start gap-4 mb-4">
                    <div 
                      className="w-3 h-3 rounded-full mt-1 flex-shrink-0" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground mb-1">{item.origem}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.clientesPagantes} pagantes | {item.totalClientes} clientes | 
                        Receita: R$ {item.receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Investimento:</span>
                      <Input
                        type="number"
                        value={item.investimento}
                        onChange={(e) => updateInvestment(item.origem, parseFloat(e.target.value) || 0)}
                        className="w-32 h-9 text-sm"
                        min="0"
                        step="100"
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 pl-7">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">CAC</p>
                      <p className="text-lg font-bold text-foreground">
                        R$ {item.cac.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">por cliente</p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Lucro</p>
                      <p className={`text-lg font-bold ${item.lucro >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        R$ {item.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">receita - investimento</p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">ROI Real</p>
                      <p className={`text-lg font-bold ${item.roiReal >= 100 ? 'text-green-500' : item.roiReal >= 0 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {item.investimento > 0 ? `${item.roiReal.toFixed(1)}%` : '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">retorno investimento</p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">LTV/CAC</p>
                      <p className={`text-lg font-bold ${item.cac > 0 && item.valorMedio / item.cac >= 3 ? 'text-green-500' : 'text-yellow-500'}`}>
                        {item.cac > 0 ? (item.valorMedio / item.cac).toFixed(2) : '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">ideal: &gt; 3.0</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tendência e Previsão de Receita */}
        <Card>
          <CardHeader>
            <CardTitle>Tendência e Previsão de Receita</CardTitle>
            <CardDescription>
              Evolução histórica da receita mensal com previsão baseada em média móvel dos últimos 3 meses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={receitaComPrevisao}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs"
                    tickFormatter={(value) => {
                      const [year, month] = value.split('-');
                      return `${month}/${year.slice(2)}`;
                    }}
                  />
                  <YAxis 
                    className="text-xs"
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const [year, month] = data.month.split('-');
                        const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                        
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold text-foreground mb-2 capitalize">{monthName}</p>
                            <div className="space-y-1">
                              {data.receita !== null && (
                                <p className="text-sm text-green-500">
                                  Receita Real: <span className="font-medium">R$ {data.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </p>
                              )}
                              {data.previsao !== null && (
                                <p className="text-sm text-blue-500">
                                  Previsão: <span className="font-medium">R$ {data.previsao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="receita" 
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.3}
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    name="Receita Real"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="previsao" 
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Previsão"
                    dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {previsaoReceita.length > 0 && (
              <div className="mt-6 p-4 border border-border rounded-lg bg-accent/5">
                <h4 className="font-semibold text-foreground mb-3">Previsão para os Próximos 3 Meses</h4>
                <div className="grid grid-cols-3 gap-4">
                  {previsaoReceita.map((item, index) => {
                    const [year, month] = item.month.split('-');
                    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                    
                    return (
                      <div key={index} className="text-center p-3 border border-border rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1 capitalize">{monthName}</p>
                        <p className="text-xl font-bold text-primary">
                          R$ {item.previsao?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  * Previsão baseada em média móvel dos últimos 3 meses e tendência de crescimento
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Análise Temporal de Conversão */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução da Taxa de Conversão por Canal</CardTitle>
            <CardDescription>
              Acompanhe como a taxa de conversão de cada canal evolui ao longo dos meses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={temporalChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs"
                    tickFormatter={(value) => {
                      const [year, month] = value.split('-');
                      return `${month}/${year.slice(2)}`;
                    }}
                  />
                  <YAxis 
                    className="text-xs"
                    label={{ value: 'Taxa de Conversão (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const [year, month] = payload[0].payload.month.split('-');
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold text-foreground mb-2">
                              {new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                            </p>
                            <div className="space-y-1">
                              {payload.map((item: any, index: number) => (
                                <p key={index} className="text-sm" style={{ color: item.color }}>
                                  {item.name}: {item.value}%
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  {Object.keys(chartData.reduce((acc, item) => ({ ...acc, [item.name]: true }), {})).map((origem, index) => (
                    <Line 
                      key={origem}
                      type="monotone" 
                      dataKey={origem} 
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Funil de Conversão */}
        <Card>
          <CardHeader>
            <CardTitle>Funil de Conversão por Origem</CardTitle>
            <CardDescription>
              Visualize as etapas Lead → Testando → Ativo e taxas de abandono em cada fase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="origem" type="category" className="text-xs" width={100} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold text-foreground mb-2">{data.origem}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-blue-500">Lead: {data.Lead}</p>
                              <p className="text-yellow-500">Testando: {data.Testando}</p>
                              <p className="text-green-500">Ativo: {data.Ativo}</p>
                              <div className="border-t border-border mt-2 pt-2">
                                <p className="text-muted-foreground">
                                  Lead → Testando: <span className="font-medium text-foreground">{data.taxaLeadToTest}%</span>
                                </p>
                                <p className="text-muted-foreground">
                                  Testando → Ativo: <span className="font-medium text-foreground">{data.taxaTestToActive}%</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Lead" stackId="a" fill="hsl(var(--chart-3))" name="Lead" />
                  <Bar dataKey="Testando" stackId="a" fill="hsl(var(--chart-4))" name="Testando" />
                  <Bar dataKey="Ativo" stackId="a" fill="hsl(var(--chart-1))" name="Ativo" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detalhamento das taxas de abandono */}
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Taxas de Conversão por Etapa</h4>
              {funnelChartData.map((item, index) => (
                <div key={index} className="p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium text-foreground">{item.origem}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Total: {item.Lead + item.Testando + item.Ativo}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Lead → Testando/Ativo</p>
                      <div className="flex items-center gap-2">
                        <div className={`text-lg font-bold ${getConversaoColor(item.taxaLeadToTest)}`}>
                          {item.taxaLeadToTest}%
                        </div>
                        <span className="text-xs text-muted-foreground">
                          ({item.Testando + item.Ativo} de {item.Lead + item.Testando + item.Ativo})
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Testando → Ativo</p>
                      <div className="flex items-center gap-2">
                        <div className={`text-lg font-bold ${getConversaoColor(item.taxaTestToActive)}`}>
                          {item.taxaTestToActive}%
                        </div>
                        <span className="text-xs text-muted-foreground">
                          ({item.Ativo} de {item.Testando + item.Ativo})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Análise de ROI */}
        <Card>
          <CardHeader>
            <CardTitle>Análise de Valor por Canal (ROI)</CardTitle>
            <CardDescription>
              Receita total e valor médio gerado por cada origem de cadastro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={roiChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="origem" className="text-xs" />
                  <YAxis 
                    yAxisId="left"
                    className="text-xs"
                    label={{ value: 'Receita Total (R$)', angle: -90, position: 'insideLeft' }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    className="text-xs"
                    label={{ value: 'Valor Médio (R$)', angle: 90, position: 'insideRight' }}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold text-foreground mb-2">{data.origem}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-green-500">
                                Receita Total: <span className="font-medium">R$ {data.receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </p>
                              <p className="text-blue-500">
                                Valor Médio: <span className="font-medium">R$ {data.valorMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </p>
                              <p className="text-muted-foreground">
                                Clientes Pagantes: <span className="font-medium text-foreground">{data.clientesPagantes}</span>
                              </p>
                              <p className="text-muted-foreground">
                                Total de Clientes: <span className="font-medium text-foreground">{data.totalClientes}</span>
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar 
                    yAxisId="left"
                    dataKey="receitaTotal" 
                    fill="hsl(var(--chart-1))" 
                    name="Receita Total (R$)" 
                    radius={[8, 8, 0, 0]} 
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="valorMedio" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Valor Médio (R$)"
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Tabela de ROI detalhada */}
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Detalhamento de Receita por Canal</h4>
              {roiChartData.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/5 transition-smooth">
                  <div className="flex items-center gap-4 flex-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.origem}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.clientesPagantes} pagantes de {item.totalClientes} clientes
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-500">
                        R$ {item.receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">receita total</p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xl font-bold text-blue-500">
                        R$ {item.valorMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">valor médio</p>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-lg">Total Geral</span>
                  <span className="text-3xl font-bold text-primary">
                    R$ {receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
