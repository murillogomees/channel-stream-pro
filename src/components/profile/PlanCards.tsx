/**
 * PlanCards - Cards de seleção de planos
 * Exibe os planos disponíveis para o usuário escolher
 */

import { Check, Sparkles, Crown, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  savings?: string;
  popular?: boolean;
  icon: React.ReactNode;
  features: string[];
}

const plans: Plan[] = [
  {
    id: 'mensal',
    name: 'Mensal',
    price: 30,
    period: '/mês',
    description: 'Ideal para testar',
    icon: <Zap className="w-6 h-6" />,
    features: [
      'Acesso a todos os canais',
      'HD e Full HD',
      'Suporte por WhatsApp',
    ]
  },
  {
    id: 'trimestral',
    name: 'Trimestral',
    price: 79.90,
    period: '/3 meses',
    description: 'Economize R$ 10',
    savings: 'Economize R$ 10',
    icon: <Star className="w-6 h-6" />,
    features: [
      'Tudo do Mensal',
      'Prioridade no suporte',
      '3 meses de acesso',
    ]
  },
  {
    id: 'semestral',
    name: 'Semestral',
    price: 149.90,
    period: '/6 meses',
    description: 'Mais popular',
    savings: 'Economize R$ 30',
    popular: true,
    icon: <Crown className="w-6 h-6" />,
    features: [
      'Tudo do Trimestral',
      'Acesso antecipado a novidades',
      '6 meses de acesso',
    ]
  },
  {
    id: 'anual',
    name: 'Anual',
    price: 279.90,
    period: '/ano',
    description: 'Melhor custo-benefício',
    savings: 'Economize R$ 80',
    icon: <Sparkles className="w-6 h-6" />,
    features: [
      'Tudo do Semestral',
      'Suporte VIP prioritário',
      '12 meses de acesso',
    ]
  }
];

interface PlanCardsProps {
  selectedPlan?: string;
  onSelectPlan: (planId: string) => void;
  className?: string;
}

export function PlanCards({ selectedPlan, onSelectPlan, className }: PlanCardsProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}>
      {plans.map((plan, index) => (
        <motion.div
          key={plan.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          onClick={() => onSelectPlan(plan.id)}
          className={cn(
            "relative cursor-pointer rounded-xl border-2 p-5 transition-all",
            "hover:shadow-lg hover:border-primary/50",
            selectedPlan === plan.id
              ? "border-primary bg-primary/5 shadow-lg"
              : "border-border bg-card hover:bg-accent/5",
            plan.popular && "ring-2 ring-primary/20"
          )}
        >
          {/* Badge Popular */}
          {plan.popular && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                Mais Popular
              </span>
            </div>
          )}

          {/* Selected indicator */}
          {selectedPlan === plan.id && (
            <div className="absolute top-3 right-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              selectedPlan === plan.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}>
              {plan.icon}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{plan.name}</h3>
              <p className="text-xs text-muted-foreground">{plan.description}</p>
            </div>
          </div>

          {/* Price */}
          <div className="mb-4">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
              <span className="text-muted-foreground text-sm">{plan.period}</span>
            </div>
            {plan.savings && (
              <p className="text-xs text-green-600 font-medium mt-1">
                {plan.savings}
              </p>
            )}
          </div>

          {/* Features */}
          <ul className="space-y-2">
            {plan.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      ))}
    </div>
  );
}

export default PlanCards;
