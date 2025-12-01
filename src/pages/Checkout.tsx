/**
 * Checkout - Página de pagamento com cadastro integrado
 * Usuário se cadastra e paga na mesma página
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSubscriptionPlans, SubscriptionPlan } from "@/hooks/useSubscriptionPlans";
import { useCoupons, Coupon } from "@/hooks/useCoupons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { 
  CreditCard, Shield, Check, Lock, 
  Loader2, AlertCircle, ArrowLeft, Sparkles,
  User, Phone, Mail, Percent, Tag, Ticket, X,
  Eye, EyeOff, QrCode, FileText, Wallet
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
  email: string;
  telefone: string;
  senha: string;
  confirmarSenha: string;
  origem: string;
}

interface FormErrors {
  nome?: string;
  email?: string;
  telefone?: string;
  senha?: string;
  confirmarSenha?: string;
  origem?: string;
}

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { plans, loading: plansLoading } = useSubscriptionPlans();
  const { validateCoupon } = useCoupons();
  
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(searchParams.get("plan"));
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("pix");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordStrong, setIsPasswordStrong] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    nome: "",
    email: "",
    telefone: "",
    senha: "",
    confirmarSenha: "",
    origem: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  
  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

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

  const handleInputChange = (field: keyof FormData, value: string) => {
    let formattedValue = value;
    
    if (field === "telefone") {
      formattedValue = formatPhone(value);
    }
    
    setFormData(prev => ({ ...prev, [field]: formattedValue }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.nome.trim() || formData.nome.trim().length < 3) {
      newErrors.nome = "Nome completo é obrigatório (mínimo 3 caracteres)";
    }
    
    if (!formData.email.includes("@") || !formData.email.includes(".")) {
      newErrors.email = "Email inválido";
    }
    
    const phoneNumbers = formData.telefone.replace(/\D/g, "");
    if (phoneNumbers.length < 10 || phoneNumbers.length > 11) {
      newErrors.telefone = "WhatsApp inválido";
    }

    if (!formData.senha || formData.senha.length < 6) {
      newErrors.senha = "Senha deve ter no mínimo 6 caracteres";
    } else if (!isPasswordStrong) {
      newErrors.senha = "A senha não atende aos requisitos mínimos de segurança";
    }

    if (formData.senha !== formData.confirmarSenha) {
      newErrors.confirmarSenha = "As senhas não coincidem";
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

    if (!selectedPaymentMethod) {
      toast.error("Selecione uma forma de pagamento");
      return;
    }
    
    if (!validateForm()) {
      toast.error("Preencha todos os campos corretamente");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch("https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/checkout-with-registration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: selectedPlanId,
          user_data: {
            nome: formData.nome.trim(),
            email: formData.email.trim().toLowerCase(),
            telefone: formData.telefone.replace(/\D/g, ""),
            senha: formData.senha,
            origem: formData.origem,
          },
          payment_method: selectedPaymentMethod,
          coupon_code: appliedCoupon?.code || null,
          success_url: `${window.location.origin}/checkout/success`,
          failure_url: `${window.location.origin}/checkout/failure`,
          pending_url: `${window.location.origin}/checkout/pending`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao processar cadastro");
      }

      // Redirect to Mercado Pago
      const isDev = window.location.hostname === "localhost" || 
                    window.location.hostname.includes("lovable");
      
      window.location.href = isDev ? data.sandbox_init_point : data.init_point;
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
          <Button 
            variant="ghost"
            onClick={() => navigate("/login")}
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
                Crie sua conta e assine
              </h1>
              <p className="text-white/80">
                Preencha seus dados, escolha o plano e a forma de pagamento
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Registration Form */}
          <motion.div className="lg:col-span-2 space-y-6" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            
            {/* 1. User Data Card */}
            <Card className="bg-gradient-to-br from-slate-900/95 to-slate-800/90 border-2 border-slate-700/50 shadow-2xl">
              <CardHeader className="pb-4 border-b border-slate-700/50">
                <CardTitle className="text-white flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  1. Dados Pessoais
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
                      className={`mt-1.5 bg-slate-600/70 border-slate-500 text-white placeholder:text-white/70 ${errors.nome ? 'border-red-500' : ''}`}
                    />
                    {errors.nome && <p className="text-red-400 text-sm mt-1">{errors.nome}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <Label htmlFor="email" className="text-white font-medium">
                      <Mail className="h-3.5 w-3.5 inline mr-1" />
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className={`mt-1.5 bg-slate-600/70 border-slate-500 text-white placeholder:text-white/70 ${errors.email ? 'border-red-500' : ''}`}
                    />
                    {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
                  </div>

                  {/* Telefone */}
                  <div>
                    <Label htmlFor="telefone" className="text-white font-medium">
                      <Phone className="h-3.5 w-3.5 inline mr-1 text-emerald-400" />
                      WhatsApp *
                    </Label>
                    <Input
                      id="telefone"
                      placeholder="(00) 00000-0000"
                      value={formData.telefone}
                      onChange={(e) => handleInputChange("telefone", e.target.value)}
                      className={`mt-1.5 bg-slate-600/70 border-slate-500 text-white placeholder:text-white/70 ${errors.telefone ? 'border-red-500' : ''}`}
                    />
                    {errors.telefone && <p className="text-red-400 text-sm mt-1">{errors.telefone}</p>}
                  </div>

                  {/* Senha */}
                  <div>
                    <Label htmlFor="senha" className="text-white font-medium">
                      <Lock className="h-3.5 w-3.5 inline mr-1" />
                      Senha de Acesso *
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="senha"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={formData.senha}
                        onChange={(e) => handleInputChange("senha", e.target.value)}
                        className={`bg-slate-600/70 border-slate-500 text-white placeholder:text-white/70 pr-10 ${errors.senha ? 'border-red-500' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <PasswordStrengthIndicator password={formData.senha} onStrengthChange={setIsPasswordStrong} />
                    {errors.senha && <p className="text-red-400 text-sm mt-1">{errors.senha}</p>}
                  </div>

                  {/* Confirmar Senha */}
                  <div>
                    <Label htmlFor="confirmarSenha" className="text-white font-medium">
                      <Lock className="h-3.5 w-3.5 inline mr-1" />
                      Confirmar Senha *
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="confirmarSenha"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Repita a senha"
                        value={formData.confirmarSenha}
                        onChange={(e) => handleInputChange("confirmarSenha", e.target.value)}
                        className={`bg-slate-600/70 border-slate-500 text-white placeholder:text-white/70 pr-10 ${errors.confirmarSenha ? 'border-red-500' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmarSenha && <p className="text-red-400 text-sm mt-1">{errors.confirmarSenha}</p>}
                  </div>

                  {/* Origem */}
                  <div className="sm:col-span-2">
                    <Label htmlFor="origem" className="text-white font-medium">Como nos conheceu? *</Label>
                    <Select value={formData.origem} onValueChange={(value) => handleInputChange("origem", value)}>
                      <SelectTrigger className={`mt-1.5 bg-slate-600/70 border-slate-500 text-white ${errors.origem ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Selecione uma opção" />
                      </SelectTrigger>
                      <SelectContent>
                        {DISCOVERY_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.origem && <p className="text-red-400 text-sm mt-1">{errors.origem}</p>}
                  </div>
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
                  2. Forma de Pagamento
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
                  3. Escolha seu Plano
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
                                <h3 className="font-bold text-xl bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                                  {plan.name}
                                </h3>
                                <p className="text-sm text-white/80">
                                  {plan.period_months} {plan.period_months === 1 ? 'mês' : 'meses'} de acesso
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              {savings && (
                                <p className="text-sm text-white/60 line-through">
                                  R$ {savings.fullPrice.toFixed(2).replace(".", ",")}
                                </p>
                              )}
                              <motion.div 
                                className={`text-2xl font-bold ${isSelected ? 'text-emerald-400' : 'text-white'}`}
                                animate={{ scale: isSelected ? 1.05 : 1 }}
                              >
                                R$ {plan.price.toFixed(2).replace(".", ",")}
                              </motion.div>
                              {plan.period_months > 1 && (
                                <p className="text-xs text-white/70">
                                  R$ {(plan.price / plan.period_months).toFixed(2).replace(".", ",")}/mês
                                </p>
                              )}
                            </div>
                          </div>

                          {savings && savings.percent > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
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
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Order Summary - Sticky */}
          <motion.div className="lg:col-span-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Card className="sticky top-24 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-primary/30 shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-center">
                <p className="text-white text-sm font-semibold flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Preço promocional!
                </p>
              </div>
              
              <CardHeader className="border-b border-slate-700/50">
                <CardTitle className="text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Resumo do Pedido
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {selectedPlan ? (
                  <div className="space-y-4">
                    {/* Plan Info */}
                    <div className="p-4 rounded-xl bg-slate-700/60 border border-slate-600">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-white text-lg">{selectedPlan.name}</p>
                          <p className="text-sm text-white/80">{selectedPlan.period}</p>
                        </div>
                        <p className="text-xl font-bold text-emerald-400">
                          R$ {selectedPlan.price.toFixed(2).replace(".", ",")}
                        </p>
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
                                : `R$ ${appliedCoupon.discount_value.toFixed(2)} de desconto`}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={handleRemoveCoupon} className="text-white">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Digite o código"
                            value={couponCode}
                            onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                            className="bg-slate-600/70 border-slate-500 text-white uppercase"
                          />
                          <Button variant="secondary" onClick={handleApplyCoupon} disabled={couponLoading} className="shrink-0 bg-slate-600 hover:bg-slate-500 text-white">
                            {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                          </Button>
                        </div>
                      )}
                      {couponError && <p className="text-sm text-red-400">{couponError}</p>}
                    </div>

                    <Separator className="bg-slate-700" />

                    {/* Discounts */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-white">
                        <span>Subtotal</span>
                        <span>R$ {selectedPlan.price.toFixed(2).replace(".", ",")}</span>
                      </div>
                      {couponDiscount > 0 && (
                        <div className="flex justify-between text-emerald-400 font-medium">
                          <span>Desconto cupom</span>
                          <span>- R$ {couponDiscount.toFixed(2).replace(".", ",")}</span>
                        </div>
                      )}
                      {pixDiscount > 0 && (
                        <div className="flex justify-between text-emerald-400 font-medium">
                          <span>Desconto PIX (5%)</span>
                          <span>- R$ {pixDiscount.toFixed(2).replace(".", ",")}</span>
                        </div>
                      )}
                    </div>

                    <Separator className="bg-slate-700" />
                    
                    {/* Total */}
                    <div className="flex justify-between items-center">
                      <span className="text-white font-medium">Total</span>
                      <motion.span 
                        key={finalPrice}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className="text-3xl font-bold text-emerald-400"
                      >
                        R$ {finalPrice.toFixed(2).replace(".", ",")}
                      </motion.span>
                    </div>

                    {/* Payment Method Selected */}
                    <div className="p-3 rounded-lg bg-slate-700/60 flex items-center gap-2">
                      {(() => {
                        const method = PAYMENT_METHODS.find(m => m.value === selectedPaymentMethod);
                        if (!method) return null;
                        const Icon = method.icon;
                        return (
                          <>
                            <Icon className="h-5 w-5 text-emerald-400" />
                            <span className="text-white font-medium">{method.label}</span>
                          </>
                        );
                      })()}
                    </div>

                    {/* Checkout Button */}
                    <Button
                      onClick={handleCheckout}
                      disabled={isProcessing || !selectedPlanId || !selectedPaymentMethod}
                      className="w-full h-14 text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Lock className="h-5 w-5 mr-2" />
                          Finalizar e Pagar
                        </>
                      )}
                    </Button>

                    {/* Security Note */}
                    <p className="text-xs text-white/50 text-center">
                      Pagamento processado com segurança pelo Mercado Pago
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <p className="text-white">Selecione um plano</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
