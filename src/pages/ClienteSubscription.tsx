import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  ArrowLeft, 
  CreditCard, 
  Calendar, 
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, addMonths, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClienteData {
  id: string;
  nome: string;
  plano: string;
  situacao: string;
  data_vencimento: string | null;
  data_contratacao: string | null;
  data_ultimo_pagamento: string | null;
  valor_pago: number;
  forma_ultimo_pagamento: string | null;
  cliente_ativo: boolean;
}

const PLANS = [
  {
    id: 'Mensal',
    name: 'Plano Mensal',
    price: 39.90,
    interval: 'mensal',
    features: [
      'Acesso a todos os canais',
      'Suporte técnico prioritário',
      'Sem fidelidade',
      'Cancelamento a qualquer momento'
    ]
  },
  {
    id: 'Trimestral',
    name: 'Plano Trimestral',
    price: 99.90,
    interval: 'trimestral',
    badge: 'Economize 17%',
    features: [
      'Acesso a todos os canais',
      'Suporte técnico prioritário',
      '3 meses de acesso',
      'Economia de R$ 19,80'
    ]
  },
  {
    id: 'Semestral',
    name: 'Plano Semestral',
    price: 179.90,
    interval: 'semestral',
    badge: 'Economize 25%',
    features: [
      'Acesso a todos os canais',
      'Suporte técnico VIP',
      '6 meses de acesso',
      'Economia de R$ 59,50'
    ]
  },
  {
    id: 'Anual',
    name: 'Plano Anual',
    price: 299.90,
    interval: 'anual',
    badge: 'Melhor Oferta',
    features: [
      'Acesso a todos os canais',
      'Suporte técnico VIP',
      '12 meses de acesso',
      'Economia de R$ 178,90'
    ]
  }
];

export default function ClienteSubscription() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [clienteData, setClienteData] = useState<ClienteData | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchSubscriptionData();
    }
  }, [user, authLoading, navigate]);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);

      const { data: cliente, error } = await (supabase as any)
        .from('clientes')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;

      if (!cliente) {
        toast.error('Dados de assinatura não encontrados');
        navigate('/dashboard');
        return;
      }

      setClienteData(cliente);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
      toast.error('Erro ao carregar dados da assinatura');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = async (newPlan: string) => {
    if (!clienteData) return;

    try {
      toast.info('Solicitação de mudança de plano enviada!', {
        description: 'Nossa equipe entrará em contato para processar a mudança.'
      });

      // In a real implementation, this would create a request or trigger a workflow
      // For now, we just show a message
    } catch (error) {
      console.error('Error requesting plan change:', error);
      toast.error('Erro ao solicitar mudança de plano');
    }
  };

  const getStatusBadge = (situacao: string) => {
    const variants: Record<string, any> = {
      'Ativo': 'default',
      'Testando': 'secondary',
      'Vencido': 'destructive',
      'Cancelado': 'outline'
    };
    return <Badge variant={variants[situacao] || 'outline'}>{situacao}</Badge>;
  };

  const getDaysUntilRenewal = () => {
    if (!clienteData?.data_vencimento) return null;
    const renewalDate = parseISO(clienteData.data_vencimento);
    const today = new Date();
    return differenceInDays(renewalDate, today);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clienteData) {
    return null;
  }

  const currentPlan = PLANS.find(p => p.id === clienteData.plano);
  const daysUntilRenewal = getDaysUntilRenewal();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-8 px-4">
      <div className="container max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Dashboard
        </Button>

        <div className="space-y-6">
          {/* Current Subscription */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Assinatura Atual
              </CardTitle>
              <CardDescription>
                Gerencie sua assinatura e veja detalhes do pagamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Plano Atual</p>
                  <p className="text-2xl font-bold">{currentPlan?.name || clienteData.plano}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(clienteData.situacao)}
                    {clienteData.cliente_ativo && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Data de Contratação</p>
                  </div>
                  <p className="font-medium">
                    {clienteData.data_contratacao 
                      ? format(parseISO(clienteData.data_contratacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : 'Não disponível'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Próximo Vencimento</p>
                  </div>
                  <p className="font-medium">
                    {clienteData.data_vencimento 
                      ? format(parseISO(clienteData.data_vencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : 'Não disponível'}
                  </p>
                  {daysUntilRenewal !== null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {daysUntilRenewal > 0 
                        ? `${daysUntilRenewal} dias restantes`
                        : daysUntilRenewal === 0 
                        ? 'Vence hoje'
                        : `Vencido há ${Math.abs(daysUntilRenewal)} dias`}
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Valor</p>
                  </div>
                  <p className="font-medium text-2xl">
                    R$ {currentPlan?.price.toFixed(2) || clienteData.valor_pago.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Histórico de Pagamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clienteData.data_ultimo_pagamento ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium">Pagamento Confirmado</p>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(clienteData.data_ultimo_pagamento), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">R$ {clienteData.valor_pago.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {clienteData.forma_ultimo_pagamento || 'Não informado'}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Mostrando o último pagamento realizado. Entre em contato para ver histórico completo.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum pagamento registrado</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Plans */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Planos Disponíveis</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((plan) => {
                const isCurrentPlan = plan.id === clienteData.plano;
                return (
                  <Card key={plan.id} className={isCurrentPlan ? 'border-primary' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        {plan.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {plan.badge}
                          </Badge>
                        )}
                      </div>
                      <div>
                        <span className="text-3xl font-bold">R$ {plan.price.toFixed(2)}</span>
                        <span className="text-muted-foreground">/{plan.interval}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {isCurrentPlan ? (
                        <Badge variant="default" className="w-full justify-center">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Plano Atual
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handlePlanChange(plan.id)}
                        >
                          <TrendingUp className="h-4 w-4 mr-2" />
                          {PLANS.findIndex(p => p.id === clienteData.plano) > PLANS.findIndex(p => p.id === plan.id)
                            ? 'Fazer Downgrade'
                            : 'Fazer Upgrade'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Help Section */}
          <Card>
            <CardHeader>
              <CardTitle>Precisa de Ajuda?</CardTitle>
              <CardDescription>
                Entre em contato para alterar forma de pagamento ou tirar dúvidas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Para alterações na forma de pagamento, reembolsos ou outras questões relacionadas à assinatura,
                entre em contato com nossa equipe de suporte.
              </p>
              <Button variant="default" onClick={() => window.open('https://wa.me/556131425880', '_blank')}>
                Falar com Suporte
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
