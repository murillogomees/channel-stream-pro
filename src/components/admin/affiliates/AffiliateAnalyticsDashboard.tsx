import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAffiliateAnalytics } from '@/hooks/useAffiliateAnalytics';
import { MousePointer, Users, DollarSign, TrendingUp, Target } from 'lucide-react';
import { AffiliatePerformanceChart } from './AffiliatePerformanceChart';
import { AffiliateLeaderboard } from './AffiliateLeaderboard';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  affiliateId?: string;
}

export function AffiliateAnalyticsDashboard({ affiliateId }: Props) {
  const { stats, leaderboard, clicks, loading } = useAffiliateAnalytics(affiliateId);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Cliques',
      value: stats.totalClicks.toLocaleString('pt-BR'),
      icon: MousePointer,
      color: 'text-blue-500'
    },
    {
      title: 'Conversões',
      value: stats.totalConversions.toLocaleString('pt-BR'),
      icon: Users,
      color: 'text-green-500'
    },
    {
      title: 'Taxa Conversão',
      value: `${stats.avgConversionRate.toFixed(1)}%`,
      icon: Target,
      color: 'text-purple-500'
    },
    {
      title: 'Receita Gerada',
      value: `R$ ${stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-emerald-500'
    },
    {
      title: 'Comissões Pagas',
      value: `R$ ${stats.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'text-orange-500'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.title}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolução de Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <AffiliatePerformanceChart affiliateId={affiliateId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Afiliados</CardTitle>
          </CardHeader>
          <CardContent>
            <AffiliateLeaderboard data={leaderboard} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Clicks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cliques Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Data</th>
                  <th className="text-left py-2 px-3">Origem</th>
                  <th className="text-left py-2 px-3">UTM Source</th>
                  <th className="text-left py-2 px-3">Converteu</th>
                </tr>
              </thead>
              <tbody>
                {clicks.slice(0, 10).map(click => (
                  <tr key={click.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3">
                      {new Date(click.clicked_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2 px-3 truncate max-w-[200px]">
                      {click.referrer || '-'}
                    </td>
                    <td className="py-2 px-3">
                      {click.utm_source || '-'}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        click.converted 
                          ? 'bg-green-500/20 text-green-500' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {click.converted ? 'Sim' : 'Não'}
                      </span>
                    </td>
                  </tr>
                ))}
                {clicks.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      Nenhum clique registrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
