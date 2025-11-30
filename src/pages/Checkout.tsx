/**
 * Checkout - Página de pagamento customizada
 * Integração completa com Mercado Pago
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionPlans } from "@/hooks/useSubscriptionPlans";
import { mercadoPagoService } from "@/services/mercadoPagoService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, Shield, Check, ChevronRight, Lock, 
  Tv, Play, Loader2, AlertCircle, ArrowLeft, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { plans, loading: plansLoading } = useSubscriptionPlans();
  
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(searchParams.get("plan"));
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<"plan" | "payment">("plan");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast.error("Faça login para continuar");
      navigate("/login?redirect=/checkout");
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Set default plan if only one exists
  useEffect(() => {
    if (plans.length === 1 && !selectedPlanId) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId]);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  const handleCheckout = async () => {
    if (!selectedPlanId) {
      toast.error("Selecione um plano");
      return;
    }

    setIsProcessing(true);
    try {
      const checkout = await mercadoPagoService.createCheckout(selectedPlanId);
      
      // Redirect to Mercado Pago
      const isDev = window.location.hostname === "localhost" || 
                    window.location.hostname.includes("lovable");
      
      window.location.href = isDev ? checkout.sandbox_init_point : checkout.init_point;
    } catch (error: any) {
      console.error("[Checkout] Error:", error);
      toast.error(error.message || "Erro ao processar pagamento");
      setIsProcessing(false);
    }
  };

  if (authLoading || plansLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e]">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
          
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Tv className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-white">IPTV Link</span>
          </div>

          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Pagamento Seguro</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Escolha seu plano
          </h1>
          <p className="text-white/60">
            Acesso ilimitado a todos os canais, filmes e séries
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          {/* Plans Selection */}
          <div className="md:col-span-3 space-y-4">
            <AnimatePresence>
              {plans.filter(p => p.is_active).map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    className={`cursor-pointer transition-all duration-300 bg-white/5 border-white/10 hover:bg-white/10 ${
                      selectedPlanId === plan.id 
                        ? 'ring-2 ring-primary border-primary bg-primary/10' 
                        : ''
                    }`}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                          <div className={`mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            selectedPlanId === plan.id 
                              ? 'border-primary bg-primary' 
                              : 'border-white/30'
                          }`}>
                            {selectedPlanId === plan.id && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-white">{plan.name}</h3>
                              {plan.is_highlighted && (
                                <Badge className="bg-primary/20 text-primary border-primary/30">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Popular
                                </Badge>
                              )}
                            </div>
                            {plan.savings_percent && (
                              <p className="text-sm text-green-400 mt-1">Economia de {plan.savings_percent}%</p>
                            )}
                            
                            {plan.features && plan.features.length > 0 && (
                              <ul className="mt-3 space-y-1">
                                {plan.features.slice(0, 4).map((feature, i) => (
                                  <li key={i} className="flex items-center gap-2 text-sm text-white/70">
                                    <Check className="h-3 w-3 text-green-400" />
                                    {feature}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-2xl font-bold text-white">
                            R$ {plan.price.toFixed(2).replace(".", ",")}
                          </div>
                          <div className="text-xs text-white/50">
                            /{plan.period}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>

            {plans.length === 0 && (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                  <p className="text-white/60">Nenhum plano disponível no momento</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Summary */}
          <div className="md:col-span-2">
            <Card className="sticky top-4 bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedPlan ? (
                  <>
                    <div className="flex justify-between text-white/80">
                      <span>{selectedPlan.name}</span>
                      <span>R$ {selectedPlan.price.toFixed(2).replace(".", ",")}</span>
                    </div>
                    
                    <Separator className="bg-white/10" />
                    
                    <div className="flex justify-between text-lg font-bold text-white">
                      <span>Total</span>
                      <span>R$ {selectedPlan.price.toFixed(2).replace(".", ",")}</span>
                    </div>

                    <Button 
                      className="w-full mt-4" 
                      size="lg"
                      onClick={handleCheckout}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-5 w-5 mr-2" />
                          Pagar com Mercado Pago
                        </>
                      )}
                    </Button>

                    {/* Security Info */}
                    <div className="mt-6 space-y-3">
                      <div className="flex items-center gap-2 text-white/60 text-sm">
                        <Shield className="h-4 w-4 text-green-400" />
                        <span>Pagamento 100% seguro</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/60 text-sm">
                        <Check className="h-4 w-4 text-green-400" />
                        <span>Acesso imediato após confirmação</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/60 text-sm">
                        <CreditCard className="h-4 w-4 text-green-400" />
                        <span>Cartão, Pix ou Boleto</span>
                      </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-xs text-white/40 text-center mb-2">Formas de pagamento</p>
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-8 w-12 bg-white/10 rounded flex items-center justify-center">
                          <span className="text-xs text-white/60">PIX</span>
                        </div>
                        <div className="h-8 w-12 bg-white/10 rounded flex items-center justify-center">
                          <CreditCard className="h-4 w-4 text-white/60" />
                        </div>
                        <div className="h-8 w-12 bg-white/10 rounded flex items-center justify-center">
                          <span className="text-[10px] text-white/60">Boleto</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 text-white/20 mx-auto mb-3" />
                    <p className="text-white/40">Selecione um plano</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-6 text-white/40 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span>SSL Seguro</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <span>Mercado Pago</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5" />
              <span>Satisfação Garantida</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
