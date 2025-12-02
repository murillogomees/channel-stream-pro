import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FlaskConical, TrendingUp, Trophy } from 'lucide-react';

export function CacheABTesting() {
  const { toast } = useToast();
  const [testName, setTestName] = useState('');
  const [variantATTL, setVariantATTL] = useState('3600');
  const [variantBTTL, setVariantBTTL] = useState('7200');
  const [trafficSplit, setTrafficSplit] = useState('50');

  const handleCreateTest = async () => {
    if (!testName) {
      toast({
        title: 'Erro',
        description: 'Nome do teste é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Teste A/B criado',
      description: `Teste "${testName}" iniciado com split ${trafficSplit}%/${100 - parseInt(trafficSplit)}%`,
    });

    // Reset form
    setTestName('');
    setVariantATTL('3600');
    setVariantBTTL('7200');
    setTrafficSplit('50');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            Criar Teste A/B
          </CardTitle>
          <CardDescription>
            Compare diferentes configurações de cache para otimizar performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="test-name">Nome do Teste</Label>
            <Input
              id="test-name"
              placeholder="Ex: TTL 1h vs 2h - Homepage"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="variant-a-ttl">Variante A - TTL (segundos)</Label>
              <Input
                id="variant-a-ttl"
                type="number"
                value={variantATTL}
                onChange={(e) => setVariantATTL(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="variant-b-ttl">Variante B - TTL (segundos)</Label>
              <Input
                id="variant-b-ttl"
                type="number"
                value={variantBTTL}
                onChange={(e) => setVariantBTTL(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="traffic-split">Split de Tráfego (% para Variante A)</Label>
            <Select value={trafficSplit} onValueChange={setTrafficSplit}>
              <SelectTrigger id="traffic-split">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10% / 90%</SelectItem>
                <SelectItem value="25">25% / 75%</SelectItem>
                <SelectItem value="50">50% / 50%</SelectItem>
                <SelectItem value="75">75% / 25%</SelectItem>
                <SelectItem value="90">90% / 10%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleCreateTest} className="w-full">
            <FlaskConical className="w-4 h-4 mr-2" />
            Iniciar Teste A/B
          </Button>
        </CardContent>
      </Card>

      {/* Mock Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Testes Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">TTL 30min vs 1h - API Calls</h4>
                <span className="text-xs text-muted-foreground">5 dias ativo</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Variante A (50%)</div>
                  <div className="font-semibold">Hit Rate: 78.3%</div>
                  <div className="text-xs text-muted-foreground">Avg Response: 245ms</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Variante B (50%)</div>
                  <div className="font-semibold text-green-600">Hit Rate: 85.1% <Trophy className="w-3 h-3 inline" /></div>
                  <div className="text-xs text-muted-foreground">Avg Response: 198ms</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline">Ver Detalhes</Button>
                <Button size="sm" variant="default">Aplicar Vencedor</Button>
                <Button size="sm" variant="destructive">Finalizar</Button>
              </div>
            </div>

            <div className="text-center text-sm text-muted-foreground py-4">
              Nenhum outro teste ativo no momento
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
