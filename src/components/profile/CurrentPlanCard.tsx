/**
 * CurrentPlanCard - Card mostrando detalhes do plano atual do usuário
 * Para usuários com assinatura ativa/recorrente
 */

import { useState } from 'react';
import { Check, Crown, Star, Zap, Sparkles, Calendar, CreditCard, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PlanCards } from './PlanCards';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface CurrentPlanCardProps {
  plano: string;
  situacao: string;
  dataVencimento: string | null;
  dataUltimoPagamento: string | null;
  valorPago: number | null;
  isRecorrente?: boolean;
}

const planDetails: Record<string, { icon: React.ReactNode; color: string; features: string[] }> = {
  mensal: {
    icon: <Zap className="w-6 h-6" />,
    color: 'text-blue-500',
    features: ['Acesso a todos os canais', 'HD e Full HD', 'Suporte por WhatsApp', '1 mês de acesso'],
  },
  trimestral: {
    icon: <Star className="w-6 h-6" />,
    color: 'text-yellow-500',
    features: ['Acesso a todos os canais', 'HD e Full HD', 'Prioridade no suporte', '3 meses de acesso'],
  },
  semestral: {
    icon: <Crown className="w-6 h-6" />,
    color: 'text-purple-500',
    features: ['Acesso a todos os canais', 'HD e Full HD', 'Acesso antecipado a novidades', '6 meses de acesso'],
  },
  anual: {
    icon: <Sparkles className="w-6 h-6" />,
    color: 'text-primary',
    features: ['Acesso a todos os canais', 'HD e Full HD', 'Suporte VIP prioritário', '12 meses de acesso'],
  },
};

export function CurrentPlanCard({
  plano,
  situacao,
  dataVencimento,
  dataUltimoPagamento,
  valorPago,
  isRecorrente = false,
}: CurrentPlanCardProps) {
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const navigate = useNavigate();

  const planKey = plano?.toLowerCase() || 'mensal';
  const planInfo = planDetails[planKey] || planDetails.mensal;

  const formatDate = (date: string | null) => {
    if (!date) return 'Não definida';
    try {
      return format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  const formatPrice = (price: number | null) => {
    if (!price) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const getDaysRemaining = () => {
    if (!dataVencimento) return 0;
    const vencimento = new Date(dataVencimento);
    const now = new Date();
    const diffTime = vencimento.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const daysRemaining = getDaysRemaining();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          Meu Plano
        </CardTitle>
        <CardDescription>
          Detalhes da sua assinatura atual
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan Details */}
        <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-primary/20 ${planInfo.color}`}>
            {planInfo.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-foreground">Plano {plano}</h3>
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                {situacao}
              </Badge>
            </div>
            {isRecorrente && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <RefreshCw className="w-3 h-3" />
                <span>Renovação automática</span>
              </div>
            )}
          </div>
        </div>

        {/* Plan Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3" />
              Próximo vencimento
            </p>
            <p className="font-semibold text-foreground">{formatDate(dataVencimento)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {daysRemaining > 0 ? `${daysRemaining} dias restantes` : 'Vencido'}
            </p>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <CreditCard className="w-3 h-3" />
              Último pagamento
            </p>
            <p className="font-semibold text-foreground">{formatPrice(valorPago)}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatDate(dataUltimoPagamento)}</p>
          </div>
        </div>

        {/* Features List */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Incluído no seu plano:</h4>
          <ul className="space-y-2">
            {planInfo.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Observations */}
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            <strong>Observações:</strong> Sua assinatura {isRecorrente ? 'será renovada automaticamente' : 'não possui renovação automática'}. 
            {daysRemaining <= 7 && daysRemaining > 0 && (
              <span className="block mt-1 text-amber-600 dark:text-amber-400">
                ⚠️ Seu plano vence em {daysRemaining} dias.
              </span>
            )}
          </p>
        </div>

        {/* Change Plan Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowChangePlan(!showChangePlan)}
        >
          {showChangePlan ? (
            <>
              <ChevronUp className="w-4 h-4 mr-2" />
              Ocultar opções de plano
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-2" />
              Mudar de plano
            </>
          )}
        </Button>

        {/* Plan Selection (Hidden by default) */}
        <AnimatePresence>
          {showChangePlan && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Escolher novo plano</h3>
                </div>
                
                <PlanCards 
                  selectedPlan={selectedPlan} 
                  onSelectPlan={setSelectedPlan} 
                />

                {selectedPlan && selectedPlan !== planKey && (
                  <Button 
                    className="w-full h-12 text-base mt-4"
                    onClick={() => navigate(`/checkout?plan=${selectedPlan}`)}
                  >
                    <CreditCard className="w-5 h-5 mr-2" />
                    Mudar para Plano {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

export default CurrentPlanCard;
