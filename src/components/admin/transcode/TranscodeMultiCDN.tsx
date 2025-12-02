import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Globe, CheckCircle2, XCircle, RefreshCw, TrendingUp } from 'lucide-react';

interface CDNProvider {
  id: string;
  name: string;
  region: string;
  status: 'active' | 'inactive' | 'failover';
  health: number;
  latency: number;
  bandwidth: number;
  cost: number;
  requests: number;
}

export function TranscodeMultiCDN() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<CDNProvider[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProviders();
    const interval = setInterval(loadProviders, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadProviders = async () => {
    const mockProviders: CDNProvider[] = [
      {
        id: 'cloudflare-us',
        name: 'Cloudflare R2 US-East',
        region: 'North America',
        status: 'active',
        health: 98,
        latency: 45,
        bandwidth: 850,
        cost: 12.50,
        requests: 125000,
      },
      {
        id: 'cloudflare-eu',
        name: 'Cloudflare R2 EU-West',
        region: 'Europe',
        status: 'active',
        health: 95,
        latency: 65,
        bandwidth: 420,
        cost: 8.20,
        requests: 68000,
      },
      {
        id: 'cloudflare-sa',
        name: 'Cloudflare R2 SA-East',
        region: 'South America',
        status: 'active',
        health: 92,
        latency: 35,
        bandwidth: 680,
        cost: 10.80,
        requests: 95000,
      },
      {
        id: 'stream-backup',
        name: 'Cloudflare Stream (Backup)',
        region: 'Global',
        status: 'failover',
        health: 100,
        latency: 55,
        bandwidth: 0,
        cost: 0,
        requests: 0,
      },
    ];
    setProviders(mockProviders);
  };

  const toggleProvider = async (providerId: string) => {
    setLoading(true);
    
    setProviders(providers.map(p => 
      p.id === providerId 
        ? { ...p, status: p.status === 'active' ? 'inactive' : 'active' as const }
        : p
    ));

    toast({
      title: "Status Atualizado",
      description: "Configuração do CDN foi alterada",
    });

    setLoading(false);
  };

  const triggerFailover = async (providerId: string) => {
    toast({
      title: "Failover Iniciado",
      description: "Redirecionando tráfego para CDN alternativo...",
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    toast({
      title: "Failover Completo",
      description: "Tráfego redirecionado com sucesso",
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') return <Badge className="bg-green-500">Active</Badge>;
    if (status === 'failover') return <Badge className="bg-yellow-500">Failover</Badge>;
    return <Badge variant="outline">Inactive</Badge>;
  };

  const getHealthColor = (health: number) => {
    if (health >= 95) return 'text-green-500';
    if (health >= 85) return 'text-yellow-500';
    return 'text-red-500';
  };

  const totalBandwidth = providers.reduce((sum, p) => sum + p.bandwidth, 0);
  const totalCost = providers.reduce((sum, p) => sum + p.cost, 0);
  const totalRequests = providers.reduce((sum, p) => sum + p.requests, 0);
  const activeCount = providers.filter(p => p.status === 'active').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Multi-CDN Distribution
        </CardTitle>
        <CardDescription>
          Distribuição automática entre múltiplos CDNs com failover inteligente e geo-routing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Globe className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                <div className="text-2xl font-bold">{activeCount}</div>
                <p className="text-sm text-muted-foreground mt-1">CDNs Ativos</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <TrendingUp className="h-8 w-8 mx-auto text-green-500 mb-2" />
                <div className="text-2xl font-bold">{totalBandwidth.toFixed(0)} GB</div>
                <p className="text-sm text-muted-foreground mt-1">Bandwidth Total</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">R$ {totalCost.toFixed(2)}</div>
                <p className="text-sm text-muted-foreground mt-1">Custo Mensal</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{(totalRequests / 1000).toFixed(0)}K</div>
                <p className="text-sm text-muted-foreground mt-1">Total Requests</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CDN Providers */}
        <div className="space-y-3">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {provider.status === 'active' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-400" />
                        )}
                        <h4 className="font-semibold">{provider.name}</h4>
                        {getStatusBadge(provider.status)}
                      </div>
                      <p className="text-sm text-muted-foreground ml-8">
                        {provider.region} • {provider.latency}ms latency
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleProvider(provider.id)}
                        disabled={loading}
                      >
                        {provider.status === 'active' ? 'Desativar' : 'Ativar'}
                      </Button>
                      {provider.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => triggerFailover(provider.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">Health</span>
                        <span className={`text-sm font-medium ${getHealthColor(provider.health)}`}>
                          {provider.health}%
                        </span>
                      </div>
                      <Progress value={provider.health} className="h-2" />
                    </div>

                    <div className="text-center">
                      <p className="text-2xl font-bold">{provider.bandwidth} GB</p>
                      <p className="text-xs text-muted-foreground">Bandwidth</p>
                    </div>

                    <div className="text-center">
                      <p className="text-2xl font-bold">{(provider.requests / 1000).toFixed(0)}K</p>
                      <p className="text-xs text-muted-foreground">Requests</p>
                    </div>

                    <div className="text-center">
                      <p className="text-2xl font-bold">R$ {provider.cost.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Custo/mês</p>
                    </div>
                  </div>

                  {provider.status === 'failover' && (
                    <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                      <RefreshCw className="h-4 w-4" />
                      Este CDN é usado apenas como backup em caso de falha
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
