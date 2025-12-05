/**
 * PÁGINA DE LOGIN RESPONSIVA
 * @version 2.0.1
 * Mobile: Uma coluna por vez com botões de navegação
 * Desktop/TV: Duas colunas lado a lado, clique expande para tela cheia
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, LogIn, Loader2, Wifi, Zap, Crown, Star, ArrowRight, ArrowLeft, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { z } from "zod";
import { useSubscriptionPlans, SubscriptionPlan } from "@/hooks/useSubscriptionPlans";
import { cn } from "@/lib/utils";

const REMEMBER_ME_KEY = "iptv_remember_me";
const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60 * 1000;

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres")
});

type ViewMode = "initial" | "login" | "plans";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isAuthenticated,
    isAdmin,
    loading: authLoading,
    refreshUser,
    user
  } = useAuth();
  const { plans, loading: plansLoading } = useSubscriptionPlans();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("initial");
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      const isAdminOrMaster = isAdmin || user.roles?.includes("admin") || user.roles?.includes("master");
      let redirectTo: string;
      
      if (isAdminOrMaster) {
        redirectTo = "/admin/dashboard";
      } else {
        redirectTo = "/app/player";
      }
      
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isAdmin, authLoading, navigate, user]);

  const logFailedLogin = async (email: string) => {
    try {
      const { securityMonitoringService } = await import("@/services/securityMonitoringService");
      await securityMonitoringService.logFailedLogin(email, undefined, navigator.userAgent, true);
      fetch("https://api.ipify.org?format=json")
        .then(res => res.json())
        .then(data => {
          import("@/services/suspiciousLoginService").then(module => {
            module.suspiciousLoginService.checkLogin(data.ip, email);
          });
        })
        .catch(() => {});
    } catch (err) {
      console.error("Erro ao registrar tentativa de login:", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const validatedData = loginSchema.parse({ email, password });
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password
      });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Email ou senha incorretos");
          setTimeout(() => logFailedLogin(validatedData.email), 0);
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Por favor, confirme seu email antes de fazer login");
        } else {
          toast.error(error.message);
        }
        return;
      }
      if (data.user) {
        toast.success("Login realizado com sucesso!");
        if (rememberMe) {
          localStorage.setItem(REMEMBER_ME_KEY, JSON.stringify({
            expires: Date.now() + REMEMBER_ME_DURATION,
            userId: data.user.id
          }));
        } else {
          localStorage.removeItem(REMEMBER_ME_KEY);
        }
        await refreshUser();
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erro ao fazer login. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    navigate(`/checkout?plan=${plan.id}`);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(price);
  };

  const openLogin = () => setViewMode("login");
  const openPlans = () => navigate("/signup"); // Redireciona para cadastro
  const goBack = () => setViewMode("initial");

  // Initial Selection Cards (two side by side)
  const initialView = (
    <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 px-4">
      {/* Login Card Preview */}
      <motion.div
        whileHover={{ scale: 1.03, y: -5 }}
        whileTap={{ scale: 0.98 }}
        onClick={openLogin}
        className="cursor-pointer bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-8 w-full max-w-[280px] text-center transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-5">
          <Crown className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Já sou cliente</h3>
        <p className="text-sm text-muted-foreground">Acesse sua conta</p>
      </motion.div>

      {/* Plans Card Preview */}
      <motion.div
        whileHover={{ scale: 1.03, y: -5 }}
        whileTap={{ scale: 0.98 }}
        onClick={openPlans}
        className="cursor-pointer bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-8 w-full max-w-[280px] text-center transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-5">
          <Zap className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Quero me cadastrar</h3>
        <p className="text-sm text-muted-foreground">3 dias grátis!</p>
      </motion.div>
    </div>
  );

  // Full Screen Login View
  const loginView = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex items-center justify-center p-4"
    >
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={goBack}
        className="absolute top-4 right-4 z-10"
      >
        <X className="w-6 h-6" />
      </Button>

      <div className="bg-card/90 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl p-8 w-full max-w-md">
        {/* Card Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-5">
            <Crown className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-foreground">Bem-vindo de volta!</h2>
          <p className="text-muted-foreground mt-2">Entre com suas credenciais</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isLoading}
              className="bg-background/50 border-border h-12 rounded-xl focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
              Senha
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                className="bg-background/50 border-border h-12 rounded-xl pr-12 focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent/50 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={checked => setRememberMe(checked === true)}
            />
            <Label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer">
              Continuar conectado por 30 dias
            </Label>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl text-base font-semibold">
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Entrando...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5 mr-2" />
                Entrar
              </>
            )}
          </Button>
        </form>

        {/* Switch to Signup */}
        <div className="mt-6 pt-4 border-t border-border/50">
          <Button
            variant="ghost"
            onClick={() => navigate("/signup")}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            Criar conta grátis
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </motion.div>
  );

  // Full Screen Plans View
  const plansView = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
    >
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={goBack}
        className="absolute top-4 right-4 z-10"
      >
        <X className="w-6 h-6" />
      </Button>

      <div className="bg-card/90 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl p-6 md:p-10 w-full max-w-6xl my-8">
        {/* Header */}
        <div className="text-center mb-8 md:mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">Escolha seu plano</h2>
          <p className="text-muted-foreground mt-3 text-lg">
            Assista em todos os seus dispositivos
          </p>
        </div>

        {/* Devices Banner */}
        <div className="bg-primary/10 border border-primary/20 rounded-2xl px-6 py-4 mb-8 text-center">
          <p className="text-primary font-medium text-base md:text-lg">
            📱 Celular • 💻 PC • 📺 Smart TV • 🎮 Video Game • Fire Stick
          </p>
        </div>

        {/* Plans Grid */}
        {plansLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
            {plans.map(plan => (
              <motion.div
                key={plan.id}
                whileHover={{ scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handlePlanSelect(plan)}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                className={cn(
                  "relative cursor-pointer rounded-2xl border-2 transition-all duration-200 p-6 flex flex-col",
                  plan.is_highlighted
                    ? "border-primary bg-primary/10 shadow-xl shadow-primary/20 ring-1 ring-primary/30"
                    : "border-border/50 bg-background/60 hover:border-primary/40 hover:bg-background/80",
                  hoveredPlan === plan.id && "ring-2 ring-primary/40"
                )}
              >
                {/* Highlighted Badge */}
                {plan.is_highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-primary text-primary-foreground font-bold rounded-full flex items-center gap-1.5 whitespace-nowrap shadow-lg text-sm px-4 py-1.5">
                      <Star className="w-4 h-4" fill="currentColor" />
                      MAIS POPULAR
                    </span>
                  </div>
                )}

                {/* Savings Badge */}
                {plan.savings_percent && plan.savings_percent > 0 && (
                  <div className="absolute -top-2 -right-2 bg-emerald-500 text-white font-bold rounded-full shadow-lg text-sm px-3 py-1">
                    -{plan.savings_percent}%
                  </div>
                )}

                <div className={cn("text-center flex-1 flex flex-col", plan.is_highlighted && "pt-3")}>
                  <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                  
                  <div className="flex items-baseline justify-center gap-1 mt-4">
                    <span className="text-3xl md:text-4xl font-extrabold text-primary">
                      {formatPrice(plan.price)}
                    </span>
                    <span className="text-muted-foreground font-medium">/{plan.period}</span>
                  </div>

                  {plan.period_months > 1 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatPrice(plan.price / plan.period_months)}/mês
                    </p>
                  )}

                  {plan.savings_amount && plan.savings_amount > 0 && (
                    <p className="text-emerald-500 font-semibold text-sm mt-2">
                      Economize {formatPrice(plan.savings_amount)}
                    </p>
                  )}

                  {/* Features */}
                  {plan.features && plan.features.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-border/30 flex-1">
                      <ul className="space-y-2.5 text-left">
                        {plan.features.slice(0, 5).map((feature, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80">
                            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <Button
                  size="lg"
                  className={cn(
                    "w-full font-semibold mt-5 h-12 rounded-xl",
                    plan.is_highlighted 
                      ? "bg-primary hover:bg-primary/90" 
                      : "bg-foreground/10 hover:bg-foreground/20 text-foreground"
                  )}
                >
                  Assinar agora
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Back to Login */}
        <div className="mt-8 pt-6 border-t border-border/50">
          <Button
            variant="ghost"
            onClick={openLogin}
            className="w-full text-muted-foreground hover:text-foreground text-lg"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Já sou cliente
          </Button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden relative">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center py-20">
        {initialView}
      </div>

      {/* Full Screen Views */}
      <AnimatePresence>
        {viewMode === "login" && loginView}
        {viewMode === "plans" && plansView}
      </AnimatePresence>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 p-4 text-center bg-gradient-to-t from-background to-transparent">
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-2">
          <Wifi className="w-4 h-4 text-green-500" />
          <span>Conectado</span>
        </div>
        <p className="text-xs text-muted-foreground">© 2025 IPTV LINK. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
