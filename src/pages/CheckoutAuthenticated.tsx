/**
 * CheckoutAuthenticated - Página de checkout para usuários já autenticados
 * Usa dados do perfil do usuário logado, sem formulário de cadastro
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionPlans, SubscriptionPlan } from "@/hooks/useSubscriptionPlans";
import { useCoupons, Coupon } from "@/hooks/useCoupons";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, Shield, Check, Lock, 
  Loader2, AlertCircle, ArrowLeft, Sparkles,
  User, Phone, Mail, Percent, Tag, Ticket, X,
  QrCode, FileText, Wallet
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import logoWhite from "@/assets/logo-white.png";

// Opções de forma de pagamento
const PAYMENT_METHODS = [
  { 
    value: "pix", 
    label: "PIX", 
    icon: QrCode, 
    description: "Pagamento instantâneo",
    highlight: true,
    discount: "5% de desconto"
  },
  { 
    value: "credit_card", 
    label: "Cartão de Crédito", 
    icon: CreditCard, 
    description: "Parcele em até 12x",
    highlight: false,
  },
  { 
    value: "debit_card", 
    label: "Cartão de Débito", 
    icon: Wallet, 
    description: "Débito à vista",
    highlight: false,
  },
  { 
    value: "boleto", 
    label: "Boleto Bancário", 
    icon: FileText, 
    description: "Vencimento em 3 dias",
    highlight: false,
  },
];

export default function CheckoutAuthenticated() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { plans, loading: plansLoading } = useSubscriptionPlans();
  const { validateCoupon } = useCoupons();
  
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(searchParams.get("plan"));
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("pix");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Check for referral code in URL
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setCouponCode(`AFILIADO-${ref.toUpperCase()}`);
    }
  }, [searchParams]);

  // Set default plan (highlighted or first one)
  useEffect(() => {
    if (plans.length > 0 && !selectedPlanId) {
      const highlighted = plans.find(p => p.is_highlighted && p.is_active);
      setSelectedPlanId(highlighted?.id || plans.find(p => p.is_active)?.id || null);
    }
  }, [plans, selectedPlanId]);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  
  // Calcular preço base mensal para referência de desconto
  const baseMonthlyPrice = useMemo(() => {
    const monthlyPlan = plans.find(p => p.period_months === 1 && p.is_active);
    return monthlyPlan?.price || 0;
  }, [plans]);
  
  // Calculate discount from coupon
  const couponDiscount = useMemo(() => {
    if (!appliedCoupon || !selectedPlan) return 0;
    
    if (appliedCoupon.discount_type === 'percentage') {
      return (selectedPlan.price * appliedCoupon.discount_value) / 100;
    }
    return Math.min(appliedCoupon.discount_value, selectedPlan.price);
  }, [appliedCoupon, selectedPlan]);

  // PIX discount (5%)
  const pixDiscount = useMemo(() => {
    if (!selectedPlan || selectedPaymentMethod !== "pix") return 0;
    return selectedPlan.price * 0.05;
  }, [selectedPlan, selectedPaymentMethod]);
  
  // Final price after all discounts
  const finalPrice = useMemo(() => {
    if (!selectedPlan) return 0;
    return Math.max(0, selectedPlan.price - couponDiscount - pixDiscount);
  }, [selectedPlan, couponDiscount, pixDiscount]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("Digite um código de cupom");
      return;
    }
    
    setCouponLoading(true);
    setCouponError("");
    
    const coupon = await validateCoupon(couponCode.trim().toUpperCase());
    
    if (coupon) {
      setAppliedCoupon(coupon);
      toast.success("Cupom aplicado com sucesso!");
    } else {
      setCouponError("Cupom inválido ou expirado");
    }
    
    setCouponLoading(false);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  // Calcular economia em relação ao plano mensal
  const calculateSavings = (plan: SubscriptionPlan) => {
    if (!baseMonthlyPrice || plan.period_months === 1) return null;
    
    const fullPrice = baseMonthlyPrice * plan.period_months;
    const savings = fullPrice - plan.price;
    const percent = Math.round((savings / fullPrice) * 100);
    
    return {
      amount: savings,
      percent,
      fullPrice,
    };
  };

  const handleCheckout = async () => {
    if (!selectedPlanId) {
      toast.error("Selecione um plano");
      return;
    }

    if (!selectedPaymentMethod) {
      toast.error("Selecione uma forma de pagamento");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await supabase.functions.invoke("mercado-pago-checkout", {
        body: {
          plan_id: selectedPlanId,
          payment_method: selectedPaymentMethod,
          coupon_code: appliedCoupon?.code || null,
          success_url: `${window.location.origin}/checkout/success`,
          failure_url: `${window.location.origin}/checkout/failure`,
          pending_url: `${window.location.origin}/checkout/pending`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao processar pagamento");
      }

      const data = response.data;

      // Redirect to Mercado Pago - ALWAYS use production mode (init_point)
      window.location.href = data.init_point;
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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-300 via-slate-200 to-slate-300">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-background sticky top-0 z-50 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Button 
            variant="ghost"
            onClick={() => navigate("/app/player")}
            className="text-white/80 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="text-sm">Voltar</span>
          </Button>
          
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <img src={logoWhite} alt="IPTV Link" className="h-10 w-auto object-contain" />
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <motion.div 
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-400 text-xs font-semibold">SSL</span>
            </motion.div>
            <motion.div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/30 to-teal-500/20 border border-emerald-500/50"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Lock className="h-4 w-4 text-emerald-400" />
              <span className="text-white text-sm font-bold">Compra Segura</span>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 md:py-8 max-w-6xl">
        <motion.div className="mb-6" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-gradient-to-br from-slate-900/95 to-slate-800/90 border-2 border-slate-700/50 shadow-2xl">
            <CardContent className="py-6 text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Renovar Assinatura
              </h1>
              <p className="text-white/80">
                Escolha seu plano e forma de pagamento
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <motion.div className="lg:col-span-2 space-y-6" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            
            {/* 1. User Info Card (Read-only) */}
            <Card className="bg-gradient-to-br from-slate-900/95 to-slate-800/90 border-2 border-slate-700/50 shadow-2xl">
              <CardHeader className="pb-4 border-b border-slate-700/50">
                <CardTitle className="text-white flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  Seus Dados
                  <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
                    <Check className="h-3 w-3 mr-1" />
                    Verificado
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-white/60">Nome</p>
                      <p className="text-white font-medium">{user.nome || user.email?.split('@')[0] || 'Usuário'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
                    <Mail className="h-5 w-5 text-blue-400" />
                    <div>
                      <p className="text-xs text-white/60">Email</p>
                      <p className="text-white font-medium truncate">{user.email}</p>
                    </div>
                  </div>
                  
                  {(user.telefone || user.telefone_whatsapp) && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 border border-slate-600/30 sm:col-span-2">
                      <Phone className="h-5 w-5 text-emerald-400" />
                      <div>
                        <p className="text-xs text-white/60">WhatsApp</p>
                        <p className="text-white font-medium">{user.telefone_whatsapp || user.telefone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 2. Payment Method Card */}
            <Card className="bg-gradient-to-br from-slate-900/95 to-slate-800/90 border-2 border-slate-700/50 shadow-2xl">
              <CardHeader className="pb-4 border-b border-slate-700/50">
                <CardTitle className="text-white flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/20">
                    <CreditCard className="h-5 w-5 text-emerald-400" />
                  </div>
                  1. Forma de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid sm:grid-cols-2 gap-3">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    const isSelected = selectedPaymentMethod === method.value;
                    
                    return (
                      <motion.div
                        key={method.value}
                        onClick={() => setSelectedPaymentMethod(method.value)}
                        className={`relative cursor-pointer rounded-xl p-4 transition-all duration-300 ${
                          isSelected 
                            ? 'bg-gradient-to-r from-emerald-500/40 to-teal-500/30 ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20' 
                            : 'bg-slate-600/50 hover:bg-slate-500/60 border-2 border-slate-500/60 hover:border-slate-400/70'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {method.highlight && (
                          <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-xs">
                            {method.discount}
                          </Badge>
                        )}
                        
                        <div className="flex items-center gap-3">
                          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-emerald-400 bg-emerald-400' : 'border-slate-400 bg-slate-300/80'
                          }`}>
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-emerald-500/30' : 'bg-slate-500/30'}`}>
                            <Icon className={`h-5 w-5 ${isSelected ? 'text-emerald-400' : 'text-white/70'}`} />
                          </div>
                          
                          <div>
                            <p className={`font-semibold ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                              {method.label}
                            </p>
                            <p className="text-xs text-white/60">{method.description}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Security badges */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <Shield className="h-4 w-4 text-emerald-400" />
                    <span>Dados criptografados</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <Lock className="h-4 w-4 text-blue-400" />
                    <span>Pagamento via Mercado Pago</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Plans Selection Card */}
            <Card className="bg-gradient-to-br from-slate-900/95 to-slate-800/90 border-2 border-slate-700/50 shadow-2xl">
              <CardHeader className="pb-4 border-b border-slate-700/50">
                <CardTitle className="text-white flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Tag className="h-5 w-5 text-amber-400" />
                  </div>
                  2. Escolha seu Plano
                  <motion.div
                    className="ml-auto"
                    animate={{ opacity: [1, 0.6, 1], scale: [1, 1.05, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  >
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 border-0 shadow-lg px-3 py-1">
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                      Oferta Limitada
                    </Badge>
                  </motion.div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {plans.filter(p => p.is_active).map((plan, index) => {
                      const savings = calculateSavings(plan);
                      const isSelected = selectedPlanId === plan.id;
                      
                      return (
                        <motion.div
                          key={plan.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1, y: isSelected ? -4 : 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 400, damping: 30, delay: index * 0.05 }}
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={`relative cursor-pointer rounded-xl p-4 transition-all duration-300 ${
                            isSelected 
                              ? 'bg-gradient-to-r from-primary/40 to-purple-600/30 ring-2 ring-primary shadow-xl shadow-primary/30' 
                              : 'bg-slate-600/50 hover:bg-slate-500/60 border-2 border-slate-500/60'
                          }`}
                        >
                          {plan.is_highlighted && (
                            <Badge className="absolute -top-2.5 left-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Melhor Custo-Benefício
                            </Badge>
                          )}

                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <motion.div 
                                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                                  isSelected ? 'border-primary bg-primary' : 'border-slate-400 bg-slate-300/80'
                                }`}
                                animate={{ scale: isSelected ? 1.1 : 1 }}
                              >
                                {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                              </motion.div>

                              <div>
                                <p className={`font-bold text-lg ${isSelected ? 'text-primary' : 'text-white'}`}>
                                  {plan.name}
                                </p>
                                {savings && (
                                  <p className="text-xs text-emerald-400">
                                    Economize {savings.percent}% ({plan.currency} {savings.amount.toFixed(2)})
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="text-right">
                              <p className={`text-2xl font-bold ${isSelected ? 'text-primary' : 'text-white'}`}>
                                {plan.currency} {plan.price.toFixed(2)}
                              </p>
                              <p className="text-xs text-white/60">{plan.period}</p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Order Summary Sidebar */}
          <motion.div 
            className="lg:sticky lg:top-24 space-y-4"
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gradient-to-br from-slate-900/95 to-slate-800/90 border-2 border-slate-700/50 shadow-2xl">
              <CardHeader className="pb-3 border-b border-slate-700/50">
                <CardTitle className="text-white flex items-center gap-2 text-lg">
                  <Ticket className="h-5 w-5 text-primary" />
                  Resumo do Pedido
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Selected Plan Summary */}
                {selectedPlan && (
                  <div className="p-3 rounded-lg bg-slate-700/40 border border-slate-600/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-white">{selectedPlan.name}</p>
                        <p className="text-xs text-white/60">{selectedPlan.period}</p>
                      </div>
                      <p className="font-bold text-white">
                        {selectedPlan.currency} {selectedPlan.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Coupon */}
                <div className="space-y-2">
                  <label className="text-sm text-white/80 font-medium">Cupom de desconto</label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4 text-emerald-400" />
                        <span className="font-semibold text-emerald-400">{appliedCoupon.code}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveCoupon}
                        className="h-6 w-6 p-0 text-white/60 hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Código do cupom"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          setCouponError("");
                        }}
                        className="bg-slate-600/70 border-slate-500 text-white placeholder:text-white/50 uppercase"
                      />
                      <Button
                        onClick={handleApplyCoupon}
                        disabled={couponLoading}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                      </Button>
                    </div>
                  )}
                  {couponError && (
                    <p className="text-red-400 text-sm flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {couponError}
                    </p>
                  )}
                </div>

                <Separator className="bg-slate-700/50" />

                {/* Price Breakdown */}
                <div className="space-y-2 text-sm">
                  {selectedPlan && (
                    <>
                      <div className="flex justify-between text-white/70">
                        <span>Subtotal</span>
                        <span>{selectedPlan.currency} {selectedPlan.price.toFixed(2)}</span>
                      </div>
                      
                      {couponDiscount > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Desconto cupom</span>
                          <span>- R$ {couponDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {pixDiscount > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Desconto PIX (5%)</span>
                          <span>- R$ {pixDiscount.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <Separator className="bg-slate-700/50" />

                {/* Total */}
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-white">Total</span>
                  <span className="text-2xl font-bold text-primary">
                    R$ {finalPrice.toFixed(2)}
                  </span>
                </div>

                {/* Checkout Button */}
                <Button
                  onClick={handleCheckout}
                  disabled={isProcessing || !selectedPlanId}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/30"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Lock className="h-5 w-5 mr-2" />
                      Pagar Agora
                    </>
                  )}
                </Button>

                {/* Security note */}
                <p className="text-center text-xs text-white/50">
                  Ao clicar, você será redirecionado para o Mercado Pago para finalizar o pagamento com segurança.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
