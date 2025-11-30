/**
 * Checkout - Página de pagamento com cadastro integrado
 * Usuário se cadastra e paga na mesma página
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSubscriptionPlans, SubscriptionPlan } from "@/hooks/useSubscriptionPlans";
import { useCoupons, Coupon } from "@/hooks/useCoupons";
import { mercadoPagoService } from "@/services/mercadoPagoService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CreditCard, Shield, Check, Lock, 
  Loader2, AlertCircle, ArrowLeft, Sparkles,
  User, Phone, Mail, MapPin, Percent, Tag, Ticket, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import logoWhite from "@/assets/logo-white.png";

// Opções de origem do cadastro
const DISCOVERY_OPTIONS = [
  { value: "google", label: "Google" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "indicacao", label: "Indicação de amigo" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "tiktok", label: "TikTok" },
  { value: "outro", label: "Outro" },
];

// Máscara para CPF
const formatCPF = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  return numbers
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2")
    .slice(0, 14);
};

// Máscara para telefone
const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 10) {
    return numbers
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return numbers
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .slice(0, 15);
};

interface FormData {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  origem: string;
}

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { plans, loading: plansLoading } = useSubscriptionPlans();
  const { validateCoupon } = useCoupons();
  
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(searchParams.get("plan"));
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    origem: "",
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  
  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  // Check for referral code in URL
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      // Auto-apply referral coupon
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
  
  // Final price after coupon
  const finalPrice = useMemo(() => {
    if (!selectedPlan) return 0;
    return Math.max(0, selectedPlan.price - couponDiscount);
  }, [selectedPlan, couponDiscount]);

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

  const handleInputChange = (field: keyof FormData, value: string) => {
    let formattedValue = value;
    
    if (field === "cpf") {
      formattedValue = formatCPF(value);
    } else if (field === "telefone") {
      formattedValue = formatPhone(value);
    }
    
    setFormData(prev => ({ ...prev, [field]: formattedValue }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};
    
    if (!formData.nome.trim() || formData.nome.trim().length < 3) {
      newErrors.nome = "Nome completo é obrigatório";
    }
    
    const cpfNumbers = formData.cpf.replace(/\D/g, "");
    if (cpfNumbers.length !== 11) {
      newErrors.cpf = "CPF inválido";
    }
    
    if (!formData.email.includes("@") || !formData.email.includes(".")) {
      newErrors.email = "Email inválido";
    }
    
    const phoneNumbers = formData.telefone.replace(/\D/g, "");
    if (phoneNumbers.length < 10 || phoneNumbers.length > 11) {
      newErrors.telefone = "Telefone inválido";
    }
    
    if (!formData.origem) {
      newErrors.origem = "Selecione como nos conheceu";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCheckout = async () => {
    if (!selectedPlanId) {
      toast.error("Selecione um plano");
      return;
    }
    
    if (!validateForm()) {
      toast.error("Preencha todos os campos corretamente");
      return;
    }

    setIsProcessing(true);
    try {
      // Aqui você pode enviar os dados do formulário junto com o checkout
      // Por enquanto, vamos apenas redirecionar para o Mercado Pago
      const checkout = await mercadoPagoService.createCheckout(selectedPlanId, {
        // Pass user data as metadata if needed
      });
      
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

  if (plansLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-300 via-slate-200 to-slate-300">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-background sticky top-0 z-50 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Voltar Button */}
          <Button 
            variant="ghost"
            onClick={() => navigate("/login")}
            className="text-white/80 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="text-sm">Voltar para o login</span>
          </Button>
          
          {/* Logo Centralizado */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <img 
              src={logoWhite} 
              alt="IPTV Link" 
              className="h-10 w-auto object-contain"
            />
          </div>

          {/* Security Badges */}
          <div className="flex items-center gap-2 md:gap-3">
            <motion.div 
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-400 text-xs font-semibold">Certificado SSL</span>
            </motion.div>
            <motion.div 
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <CreditCard className="h-4 w-4 text-blue-400" />
              <span className="text-blue-400 text-xs font-semibold">Mercado Pago</span>
            </motion.div>
            <motion.div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/30 to-teal-500/20 border border-emerald-500/50 shadow-lg shadow-emerald-500/20"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Lock className="h-4 w-4 text-emerald-400" />
              <span className="text-white text-sm font-bold">Compra Segura</span>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 md:py-8 max-w-6xl">
        {/* Title Card */}
        <motion.div 
          className="mb-6 md:mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-br from-slate-900/95 to-slate-800/90 border-2 border-slate-700/50 shadow-2xl shadow-black/50 backdrop-blur-sm">
            <CardContent className="py-6 text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Complete seu cadastro
              </h1>
              <p className="text-white/80">
                Preencha seus dados e escolha o melhor plano para você
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Registration Form */}
          <motion.div 
            className="lg:col-span-2 space-y-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* User Data Card */}
            <Card className="bg-gradient-to-br from-slate-900/95 to-slate-800/90 border-2 border-slate-700/50 shadow-2xl shadow-black/50 backdrop-blur-sm">
              <CardHeader className="pb-4 border-b border-slate-700/50">
                <CardTitle className="text-white flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  Dados Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Nome */}
                  <div className="sm:col-span-2">
                    <Label htmlFor="nome" className="text-white font-medium">Nome Completo *</Label>
                    <Input
                      id="nome"
                      placeholder="Seu nome completo"
                      value={formData.nome}
                      onChange={(e) => handleInputChange("nome", e.target.value)}
                      className={`mt-1.5 bg-slate-600/70 border-slate-500 text-white placeholder:text-white/70 focus:border-primary focus:ring-primary/20 ${
                        errors.nome ? 'border-red-500' : ''
                      }`}
                    />
                    {errors.nome && (
                      <p className="text-red-400 text-sm mt-1">{errors.nome}</p>
                    )}
                  </div>

                  {/* CPF */}
                  <div>
                    <Label htmlFor="cpf" className="text-white font-medium">CPF *</Label>
                    <Input
                      id="cpf"
                      placeholder="000.000.000-00"
                      value={formData.cpf}
                      onChange={(e) => handleInputChange("cpf", e.target.value)}
                      className={`mt-1.5 bg-slate-600/70 border-slate-500 text-white placeholder:text-white/70 focus:border-primary focus:ring-primary/20 ${
                        errors.cpf ? 'border-red-500' : ''
                      }`}
                    />
                    {errors.cpf && (
                      <p className="text-red-400 text-sm mt-1">{errors.cpf}</p>
                    )}
                  </div>

                  {/* Telefone */}
                  <div>
                    <Label htmlFor="telefone" className="text-white font-medium">
                      WhatsApp *
                      <Phone className="h-3.5 w-3.5 inline ml-1 text-emerald-400" />
                    </Label>
                    <Input
                      id="telefone"
                      placeholder="(00) 00000-0000"
                      value={formData.telefone}
                      onChange={(e) => handleInputChange("telefone", e.target.value)}
                      className={`mt-1.5 bg-slate-600/70 border-slate-500 text-white placeholder:text-white/70 focus:border-primary focus:ring-primary/20 ${
                        errors.telefone ? 'border-red-500' : ''
                      }`}
                    />
                    {errors.telefone && (
                      <p className="text-red-400 text-sm mt-1">{errors.telefone}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <Label htmlFor="email" className="text-white font-medium">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className={`mt-1.5 bg-slate-600/70 border-slate-500 text-white placeholder:text-white/70 focus:border-primary focus:ring-primary/20 ${
                        errors.email ? 'border-red-500' : ''
                      }`}
                    />
                    {errors.email && (
                      <p className="text-red-400 text-sm mt-1">{errors.email}</p>
                    )}
                  </div>

                  {/* Origem */}
                  <div>
                    <Label htmlFor="origem" className="text-white font-medium">Como nos conheceu? *</Label>
                    <Select 
                      value={formData.origem} 
                      onValueChange={(value) => handleInputChange("origem", value)}
                    >
                      <SelectTrigger 
                        className={`mt-1.5 bg-slate-600/70 border-slate-500 text-white ${
                          errors.origem ? 'border-red-500' : ''
                        }`}
                      >
                        <SelectValue placeholder="Selecione uma opção" className="text-white/70" />
                      </SelectTrigger>
                      <SelectContent>
                        {DISCOVERY_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.origem && (
                      <p className="text-red-400 text-sm mt-1">{errors.origem}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plans Selection Card */}
            <Card className="bg-gradient-to-br from-slate-900/95 to-slate-800/90 border-2 border-slate-700/50 shadow-2xl shadow-black/50 backdrop-blur-sm">
              <CardHeader className="pb-4 border-b border-slate-700/50">
                <CardTitle className="text-white flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Tag className="h-5 w-5 text-amber-400" />
                  </div>
                  Escolha seu Plano
                  <motion.div
                    className="ml-auto"
                    animate={{ 
                      opacity: [1, 0.6, 1],
                      scale: [1, 1.05, 1]
                    }}
                    transition={{ 
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 border-0 shadow-lg shadow-orange-500/30 px-4 py-1.5 text-sm">
                      <Sparkles className="h-4 w-4 mr-1.5 text-white" />
                      <span className="text-white font-bold">Oferta Limitada</span>
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
                          animate={{ 
                            opacity: 1, 
                            scale: 1,
                            y: isSelected ? -4 : 0,
                          }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ 
                            type: "spring", 
                            stiffness: 400, 
                            damping: 30,
                            delay: index * 0.05 
                          }}
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={`relative cursor-pointer rounded-xl p-4 transition-all duration-300 ${
                            isSelected 
                              ? 'bg-gradient-to-r from-primary/40 to-purple-600/30 ring-2 ring-primary shadow-xl shadow-primary/30' 
                              : 'bg-slate-600/50 hover:bg-slate-500/60 border-2 border-slate-500/60 hover:border-slate-400/70'
                          }`}
                        >
                          {/* Popular Badge */}
                          {plan.is_highlighted && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="absolute -top-2.5 left-4"
                            >
                              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Melhor Custo-Benefício
                              </Badge>
                            </motion.div>
                          )}

                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              {/* Radio indicator */}
                              <motion.div 
                                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                                  isSelected 
                                    ? 'border-primary bg-primary shadow-lg shadow-primary/50' 
                                    : 'border-slate-400 bg-slate-300/80'
                                }`}
                                animate={{ scale: isSelected ? 1.1 : 1 }}
                              >
                                <AnimatePresence>
                                  {isSelected && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      exit={{ scale: 0 }}
                                    >
                                      <Check className="h-3.5 w-3.5 text-white" />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                              
                              <div>
                              <h3 className="font-bold text-white text-lg">{plan.name}</h3>
                                <p className="text-sm text-white/80">
                                  {plan.period_months} {plan.period_months === 1 ? 'mês' : 'meses'} de acesso
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              {/* Preço cheio riscado */}
                              {savings && (
                                <motion.p 
                                  className="text-sm text-white/60 line-through"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                >
                                  R$ {savings.fullPrice.toFixed(2).replace(".", ",")}
                                </motion.p>
                              )}
                              
                              {/* Preço atual */}
                              <motion.div 
                                className={`text-2xl font-bold ${isSelected ? 'text-emerald-400' : 'text-white'}`}
                                animate={{ scale: isSelected ? 1.05 : 1 }}
                              >
                                R$ {plan.price.toFixed(2).replace(".", ",")}
                              </motion.div>
                              
                              {/* Preço por mês */}
                              {plan.period_months > 1 && (
                                <p className="text-xs text-white/70">
                                  R$ {(plan.price / plan.period_months).toFixed(2).replace(".", ",")}/mês
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Savings Banner */}
                          <AnimatePresence>
                            {savings && savings.percent > 0 && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 pt-3 border-t border-white/10"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Percent className="h-4 w-4 text-green-400" />
                                    <span className="text-sm text-green-400 font-medium">
                                      Economia de {savings.percent}%
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                                    - R$ {savings.amount.toFixed(2).replace(".", ",")}
                                  </Badge>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Features preview */}
                          <AnimatePresence>
                            {isSelected && plan.features && plan.features.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 pt-3 border-t border-slate-700/50"
                              >
                                <div className="grid grid-cols-2 gap-2">
                                    {plan.features.slice(0, 4).map((feature, i) => (
                                    <motion.div
                                      key={i}
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: i * 0.05 }}
                                      className="flex items-center gap-2 text-sm text-white"
                                    >
                                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                                      <span className="truncate">{feature}</span>
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {plans.length === 0 && (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <p className="text-white">Nenhum plano disponível no momento</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Order Summary - Sticky */}
          <motion.div 
            className="lg:col-span-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="sticky top-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-primary/30 shadow-2xl shadow-primary/20 backdrop-blur-sm overflow-hidden">
              {/* Urgency Banner */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-center">
                <p className="text-white text-sm font-semibold flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Preço promocional por tempo limitado!
                </p>
              </div>
              
              <CardHeader className="border-b border-slate-700/50">
                <CardTitle className="text-white flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  Resumo do Pedido
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <AnimatePresence mode="wait">
                  {selectedPlan ? (
                    <motion.div
                      key={selectedPlan.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      {/* Plan Info */}
                      <div className="p-4 rounded-xl bg-slate-700/60 border border-slate-600">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-white text-lg">{selectedPlan.name}</p>
                            <p className="text-sm text-white/80">{selectedPlan.period}</p>
                          </div>
                        <motion.p 
                            className="text-xl font-bold text-emerald-400"
                            key={selectedPlan.price}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                          >
                            R$ {selectedPlan.price.toFixed(2).replace(".", ",")}
                          </motion.p>
                        </div>
                      </div>

                      {/* Coupon Input */}
                      <div className="space-y-2">
                        <Label className="text-white flex items-center gap-2 font-medium">
                          <Ticket className="h-4 w-4 text-amber-400" />
                          Cupom de desconto
                        </Label>
                        {appliedCoupon ? (
                          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                            <div>
                              <p className="font-semibold text-emerald-400">{appliedCoupon.code}</p>
                              <p className="text-sm text-white">
                                {appliedCoupon.discount_type === 'percentage' 
                                  ? `${appliedCoupon.discount_value}% de desconto`
                                  : `R$ ${appliedCoupon.discount_value.toFixed(2)} de desconto`
                                }
                              </p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={handleRemoveCoupon}
                              className="text-white hover:text-white/80"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Digite o código"
                              value={couponCode}
                              onChange={(e) => {
                                setCouponCode(e.target.value.toUpperCase());
                                setCouponError("");
                              }}
                              className="bg-slate-600/70 border-slate-500 text-white placeholder:text-white/70 uppercase"
                            />
                            <Button 
                              variant="secondary"
                              onClick={handleApplyCoupon}
                              disabled={couponLoading}
                              className="shrink-0 bg-slate-600 hover:bg-slate-500 text-white"
                            >
                              {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                            </Button>
                          </div>
                        )}
                        {couponError && (
                          <p className="text-sm text-red-400">{couponError}</p>
                        )}
                      </div>

                      {/* Discount info */}
                      {(() => {
                        const savings = calculateSavings(selectedPlan);
                        if (savings && savings.percent > 0) {
                          return (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/30"
                            >
                              <div className="flex items-center gap-2 text-emerald-400">
                                <Percent className="h-4 w-4" />
                                <span className="font-semibold">Economia no plano:</span>
                              </div>
                              <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-emerald-400">
                                  {savings.percent}%
                                </span>
                                <span className="text-emerald-400/80">
                                  (R$ {savings.amount.toFixed(2).replace(".", ",")})
                                </span>
                              </div>
                            </motion.div>
                          );
                        }
                        return null;
                      })()}
                      
                      <Separator className="bg-slate-700" />
                      
                      {/* Subtotal and Coupon Discount */}
                      {appliedCoupon && couponDiscount > 0 && (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-white">
                            <span>Subtotal</span>
                            <span>R$ {selectedPlan.price.toFixed(2).replace(".", ",")}</span>
                          </div>
                          <div className="flex justify-between text-emerald-400 font-medium">
                            <span>Desconto do cupom</span>
                            <span>-R$ {couponDiscount.toFixed(2).replace(".", ",")}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Total */}
                      <div className="flex justify-between items-center p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40">
                        <span className="text-lg font-semibold text-white">Total</span>
                        <motion.span
                          key={finalPrice}
                          initial={{ scale: 1.1 }}
                          animate={{ scale: 1 }}
                          className="text-2xl font-bold text-emerald-400"
                        >
                          R$ {finalPrice.toFixed(2).replace(".", ",")}
                        </motion.span>
                      </div>

                      {/* Checkout Button */}
                      <Button 
                        className="w-full h-14 text-lg font-bold text-white bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:via-emerald-400 hover:to-teal-400 shadow-xl shadow-emerald-500/30 transition-all duration-300 hover:shadow-emerald-500/50 hover:scale-[1.02]" 
                        size="lg"
                        onClick={handleCheckout}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin text-white" />
                            <span className="text-white">Processando...</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-5 w-5 mr-2 text-white" />
                            <span className="text-white">FINALIZAR COMPRA</span>
                          </>
                        )}
                      </Button>

                      {/* Security Info */}
                      <div className="space-y-2.5 pt-2">
                        <div className="flex items-center gap-2 text-white text-sm">
                          <Shield className="h-4 w-4 text-emerald-400" />
                          <span>Pagamento 100% seguro</span>
                        </div>
                        <div className="flex items-center gap-2 text-white text-sm">
                          <Check className="h-4 w-4 text-emerald-400" />
                          <span>Acesso imediato após confirmação</span>
                        </div>
                        <div className="flex items-center gap-2 text-white text-sm">
                          <CreditCard className="h-4 w-4 text-emerald-400" />
                          <span>Cartão, Pix ou Boleto</span>
                        </div>
                      </div>

                      {/* Payment Methods */}
                      <div className="pt-4 border-t border-slate-600">
                        <p className="text-xs text-white text-center mb-3 font-medium">Formas de pagamento aceitas</p>
                        <div className="flex items-center justify-center gap-3">
                          <div className="h-10 px-4 bg-slate-700/70 rounded-lg flex items-center justify-center border border-slate-600">
                            <span className="text-sm font-bold text-emerald-400">PIX</span>
                          </div>
                          <div className="h-10 px-4 bg-slate-700/70 rounded-lg flex items-center justify-center border border-slate-600">
                            <CreditCard className="h-4 w-4 text-white mr-1.5" />
                            <span className="text-sm text-white">Cartão</span>
                          </div>
                          <div className="h-10 px-4 bg-slate-700/70 rounded-lg flex items-center justify-center border border-slate-600">
                            <span className="text-sm text-white">Boleto</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      className="text-center py-8"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <CreditCard className="h-12 w-12 text-white/50 mx-auto mb-3" />
                      <p className="text-white">Selecione um plano para continuar</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Footer Security Note */}
        <motion.div 
          className="mt-8 md:mt-12 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900/90 border border-emerald-500/30">
            <Shield className="h-5 w-5 text-emerald-400" />
            <span className="text-white text-sm font-medium">Ambiente de compra 100% seguro e criptografado</span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
