import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CreditCard, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import logoWhite from '@/assets/logo-white.png';

interface SubscriptionExpiredModalProps {
  isOpen: boolean;
  daysRemaining?: number;
  isTrial?: boolean;
  planName?: string;
}

export function SubscriptionExpiredModal({
  isOpen,
  daysRemaining = 0,
  isTrial = false,
  planName = 'Teste'
}: SubscriptionExpiredModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleGoToCheckout = () => {
    navigate('/checkout');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            <Card className="w-full max-w-md border-primary/20 bg-card/95 shadow-2xl">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <img src={logoWhite} alt="Logo" className="h-12 w-auto" />
                </div>
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-full bg-destructive/10">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                  </div>
                </div>
                <CardTitle className="text-xl sm:text-2xl">
                  {isTrial ? 'Período de Teste Encerrado' : 'Assinatura Expirada'}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {isTrial 
                    ? 'Seu período de teste gratuito de 3 dias terminou. Escolha um plano para continuar assistindo.'
                    : `Seu plano ${planName} expirou. Renove sua assinatura para continuar aproveitando todo o conteúdo.`
                  }
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Benefits reminder */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    O que você terá acesso:
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      +200.000 canais de TV ao vivo
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Filmes e séries em HD e 4K
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Suporte prioritário 24/7
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Multi-dispositivos simultâneos
                    </li>
                  </ul>
                </div>

                {/* Pricing hint */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">A partir de</p>
                  <p className="text-3xl font-bold text-primary">
                    R$ 30<span className="text-lg font-normal text-muted-foreground">/mês</span>
                  </p>
                </div>

                {/* CTA Button */}
                <Button 
                  onClick={handleGoToCheckout}
                  className="w-full h-12 text-base font-semibold gap-2"
                  size="lg"
                >
                  <CreditCard className="h-5 w-5" />
                  Escolher Plano
                </Button>

                {/* Time notice */}
                <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  Ativação imediata após confirmação do pagamento
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
