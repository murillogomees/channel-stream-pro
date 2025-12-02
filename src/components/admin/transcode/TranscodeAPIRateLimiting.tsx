import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Shield, Zap, TrendingUp, AlertCircle } from 'lucide-react';

interface RateLimitConfig {
  clientId: string;
  clientName: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  currentUsage: number;
  percentUsed: number;
  status: 'normal' | 'warning' | 'throttled';
}

export function TranscodeAPIRateLimiting() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<RateLimitConfig[]>([]);
  const [loading, setLoading] = useState(false);

  // New limit form
  const [newClientName, setNewClientName] = useState('');
  const [newPerMinute, setNewPerMinute] = useState('60');
  const [newPerHour, setNewPerHour] = useState('1000');

  useEffect(() => {
    loadRateLimits();
    const interval = setInterval(loadRateLimits, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadRateLimits = async () => {
    // Simulate rate limit data
    const mockConfigs: RateLimitConfig[] = [
      {
        clientId: 'client-1',
        clientName: 'Production API',
        requestsPerMinute: 100,
        requestsPerHour: 5000,
        currentUsage: 3250,
        percentUsed: 65,
        status: 'normal',
      },
      {
        clientId: 'client-2',
        clientName: 'Mobile App',
        requestsPerMinute: 50,
        requestsPerHour: 2000,
        currentUsage: 1800,
        percentUsed: 90,
        status: 'warning',
      },
      {
        clientId: 'client-3',
        clientName: 'Partner Integration',
        requestsPerMinute: 30,
        requestsPerHour: 1000,
        currentUsage: 1000,
        percentUsed: 100,
        status: 'throttled',
      },
    ];
    setConfigs(mockConfigs);
  };

  const addRateLimit = async () => {
    if (!newClientName.trim()) {
      toast({
        title: "Nome Obrigatório",
        description: "Informe um nome para o cliente",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const newConfig: RateLimitConfig = {
      clientId: `client-${Date.now()}`,
      clientName: newClientName,
      requestsPerMinute: parseInt(newPerMinute),
      requestsPerHour: parseInt(newPerHour),
      currentUsage: 0,
      percentUsed: 0,
      status: 'normal',
    };

    setConfigs([...configs, newConfig]);

    toast({
      title: "Rate Limit Configurado",
      description: `Cliente "${newClientName}" adicionado com sucesso`,
    });

    setNewClientName('');
    setNewPerMinute('60');
    setNewPerHour('1000');
    setLoading(false);
  };

  const resetUsage = async (clientId: string) => {
    setConfigs(configs.map(c => 
      c.clientId === clientId 
        ? { ...c, currentUsage: 0, percentUsed: 0, status: 'normal' as const }
        : c
    ));

    toast({
      title: "Uso Resetado",
      description: "Contadores de uso foram resetados",
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'throttled') {
      return <Badge variant="destructive">Throttled</Badge>;
    }
    if (status === 'warning') {
      return <Badge className="bg-yellow-500">Warning</Badge>;
    }
    return <Badge className="bg-green-500">Normal</Badge>;
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-red-500';
    if (percent >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const totalRequests = configs.reduce((sum, c) => sum + c.currentUsage, 0);
  const avgUsage = configs.length > 0 
    ? configs.reduce((sum, c) => sum + c.percentUsed, 0) / configs.length 
    : 0;
  const throttledCount = configs.filter(c => c.status === 'throttled').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          API Rate Limiting
        </CardTitle>
        <CardDescription>
          Controle fino de chamadas à API com quotas por cliente e throttling inteligente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Zap className="h-8 w-8 mx-auto text-primary mb-2" />
                <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground mt-1">Total Requests</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <TrendingUp className="h-8 w-8 mx-auto text-green-500 mb-2" />
                <div className="text-2xl font-bold">{avgUsage.toFixed(1)}%</div>
                <p className="text-sm text-muted-foreground mt-1">Uso Médio</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
                <div className="text-2xl font-bold">{throttledCount}</div>
                <p className="text-sm text-muted-foreground mt-1">Throttled</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Shield className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                <div className="text-2xl font-bold">{configs.length}</div>
                <p className="text-sm text-muted-foreground mt-1">Clientes</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add New Limit */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Adicionar Rate Limit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client-name">Nome do Cliente</Label>
                <Input
                  id="client-name"
                  placeholder="Ex: Production API"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="per-minute">Requests/Minuto</Label>
                <Input
                  id="per-minute"
                  type="number"
                  value={newPerMinute}
                  onChange={(e) => setNewPerMinute(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="per-hour">Requests/Hora</Label>
                <Input
                  id="per-hour"
                  type="number"
                  value={newPerHour}
                  onChange={(e) => setNewPerHour(e.target.value)}
                />
              </div>
            </div>

            <Button onClick={addRateLimit} disabled={loading} className="w-full">
              Adicionar Rate Limit
            </Button>
          </CardContent>
        </Card>

        {/* Rate Limits List */}
        <div className="space-y-3">
          {configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum rate limit configurado
            </div>
          ) : (
            configs.map((config) => (
              <Card key={config.clientId}>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{config.clientName}</h4>
                          {getStatusBadge(config.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {config.currentUsage.toLocaleString()} / {config.requestsPerHour.toLocaleString()} requests/hora
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resetUsage(config.clientId)}
                      >
                        Reset
                      </Button>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Uso: {config.percentUsed.toFixed(1)}%</span>
                        <span className="text-sm text-muted-foreground">
                          Limite: {config.requestsPerMinute}/min
                        </span>
                      </div>
                      <Progress 
                        value={config.percentUsed} 
                        className={`h-2 ${getProgressColor(config.percentUsed)}`}
                      />
                    </div>

                    {config.status === 'throttled' && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                        <AlertCircle className="h-4 w-4" />
                        Cliente atingiu limite. Requests estão sendo throttled.
                      </div>
                    )}

                    {config.status === 'warning' && (
                      <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                        <AlertCircle className="h-4 w-4" />
                        Uso elevado. Próximo do limite.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
