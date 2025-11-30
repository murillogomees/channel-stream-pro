/**
 * PÁGINA DE LOGIN INTERATIVA
 *
 * Design moderno com tela dividida animada:
 * - Login form vs Planos de assinatura
 * - Transições suaves como jogo de escolha
 * - Modo focado em cada seção
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, LogIn, Loader2, Wifi, Tv, Smartphone, Monitor, Gamepad2, Tablet, Chrome, Zap, Crown, Star } from "lucide-react";
import { motion } from "framer-motion";
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
type ViewMode = "split" | "login" | "plans";
const deviceIcons = [{
  icon: Smartphone,
  label: "Celular"
}, {
  icon: Monitor,
  label: "Computador"
}, {
  icon: Gamepad2,
  label: "Video Game"
}, {
  icon: Tablet,
  label: "Tablet"
}, {
  icon: Tv,
  label: "Android TV"
}, {
  icon: Chrome,
  label: "Fire Stick"
}];
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
  const {
    plans,
    loading: plansLoading
  } = useSubscriptionPlans();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      const isAdminRole = isAdmin || user.roles?.includes("admin");
      const isClientRole = user.roles?.includes("client");
      let redirectTo: string;
      if (isAdminRole) {
        redirectTo = "/dashboard";
      } else {
        const stateFrom = (location.state as any)?.from?.pathname;
        if (isClientRole) {
          redirectTo = stateFrom || "/app/player";
        } else {
          redirectTo = stateFrom || "/";
        }
      }
      navigate(redirectTo, {
        replace: true
      });
    }
  }, [isAuthenticated, isAdmin, authLoading, navigate, location, user]);
  const logFailedLogin = async (email: string) => {
    try {
      const {
        securityMonitoringService
      } = await import("@/services/securityMonitoringService");
      await securityMonitoringService.logFailedLogin(email, undefined, navigator.userAgent, true);
      fetch("https://api.ipify.org?format=json").then(res => res.json()).then(data => {
        import("@/services/suspiciousLoginService").then(module => {
          module.suspiciousLoginService.checkLogin(data.ip, email);
        });
      }).catch(() => {});
    } catch (err) {
      console.error("Erro ao registrar tentativa de login:", err);
    }
  };
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const validatedData = loginSchema.parse({
        email,
        password
      });
      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
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
    // Redirect to checkout
    navigate(`/checkout?plan=${plan.slug}`);
  };
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(price);
  };
  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" animate={{
        scale: [1, 1.2, 1],
        opacity: [0.3, 0.5, 0.3]
      }} transition={{
        duration: 8,
        repeat: Infinity
      }} />
        <motion.div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl" animate={{
        scale: [1.2, 1, 1.2],
        opacity: [0.2, 0.4, 0.2]
      }} transition={{
        duration: 10,
        repeat: Infinity
      }} />
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" animate={{
        rotate: [0, 360]
      }} transition={{
        duration: 60,
        repeat: Infinity,
        ease: "linear"
      }} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header with Logo */}
        <motion.header className="p-4 md:p-6 flex justify-center" initial={{
        opacity: 0,
        y: -20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.5
      }}>
          
        </motion.header>

        {/* Split View Container */}
        <div className="flex-1 flex flex-col lg:flex-row items-stretch w-full" onMouseLeave={() => setViewMode("split")}>
          {/* Login Section */}
          <div className={cn("transition-all duration-500 ease-out flex items-center justify-center p-4 lg:p-0", viewMode === "split" && "lg:w-1/2", viewMode === "login" && "lg:w-full", viewMode === "plans" && "lg:w-0 lg:opacity-0 lg:overflow-hidden")} onMouseEnter={() => setViewMode("login")}>
            <div className={cn("w-full max-w-lg bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl overflow-hidden p-6 transition-all duration-300", viewMode === "login" && "ring-2 ring-primary/20 shadow-primary/10")}>
              {/* Card Header */}
              <div className="text-center mb-6">
                <img src="/logo.png" alt="IPTV LINK" className="w-28 h-auto object-contain mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-foreground">Já sou cliente</h2>
                <p className="text-muted-foreground text-sm mt-2">
                  Entre com suas credenciais para acessar
                </p>
              </div>

              {/* Login Form */}
              <div>
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
                      Email
                    </Label>
                    <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading} className="bg-background/50 border-border h-12 rounded-xl focus:ring-2 focus:ring-primary/20" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                      Senha
                    </Label>
                    <div className="relative">
                      <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} className="bg-background/50 border-border h-12 rounded-xl pr-12 focus:ring-2 focus:ring-primary/20" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent/50 transition-colors">
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="remember-me" checked={rememberMe} onCheckedChange={checked => setRememberMe(checked === true)} />
                    <Label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer">
                      Continuar conectado por 30 dias
                    </Label>
                  </div>

                  <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl text-base font-semibold">
                    {isLoading ? <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Entrando...
                      </> : <>
                        <LogIn className="w-5 h-5 mr-2" />
                        Entrar
                      </>}
                  </Button>
                </form>
              </div>
            </div>
          </div>


          {/* Plans Section */}
          <div className={cn("transition-all duration-500 ease-out flex items-center justify-center p-4 lg:p-0", viewMode === "split" && "lg:w-1/2", viewMode === "plans" && "lg:w-full", viewMode === "login" && "lg:w-0 lg:opacity-0 lg:overflow-hidden")} onMouseEnter={() => setViewMode("plans")}>
            <div className={cn("w-full max-w-lg bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl overflow-hidden p-6 transition-all duration-300", viewMode === "plans" && "ring-2 ring-primary/20 shadow-primary/10")}>
              {/* Plans Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4">
                  <Crown className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Quero me cadastrar</h2>
                <p className="text-muted-foreground text-sm mt-2">
                  Escolha o plano perfeito e comece a assistir agora!
                </p>
              </div>

              {/* Device Icons */}
              <div className="flex flex-wrap justify-center gap-3 mb-6">
                {deviceIcons.map(device => <div key={device.label} className="flex flex-col items-center gap-1 hover:scale-110 hover:-translate-y-0.5 transition-transform">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                      <device.icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{device.label}</span>
                  </div>)}
              </div>

              {/* Plans Grid */}
              {plansLoading ? <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div> : <div className="grid grid-cols-2 gap-3">
                  {plans.map(plan => <div key={plan.id} onClick={() => handlePlanSelect(plan)} onMouseEnter={() => setHoveredPlan(plan.id)} onMouseLeave={() => setHoveredPlan(null)} className={cn("relative cursor-pointer rounded-xl border-2 p-3 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1", plan.is_highlighted ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border/50 bg-background/30 hover:border-primary/50", hoveredPlan === plan.id && "ring-2 ring-primary/20")}>
                      {/* Highlighted Badge */}
                      {plan.is_highlighted && <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            MAIS POPULAR
                          </span>
                        </div>}

                      {/* Savings Badge */}
                      {plan.savings_percent && plan.savings_percent > 0 && <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          -{plan.savings_percent}%
                        </div>}

                      <div className="text-center">
                        <h3 className="text-base font-bold text-foreground mb-1">{plan.name}</h3>
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-2xl font-extrabold text-primary">{formatPrice(plan.price)}</span>
                          <span className="text-xs text-muted-foreground">/{plan.period}</span>
                        </div>

                        {plan.savings_amount && plan.savings_amount > 0 && <p className="text-[10px] text-green-500 mt-1">
                            Economize {formatPrice(plan.savings_amount)}
                          </p>}
                      </div>

                      {/* CTA Button */}
                      <Button size="sm" className={cn("w-full mt-3 rounded-lg text-sm", plan.is_highlighted ? "bg-primary hover:bg-primary/90" : "bg-muted hover:bg-muted/80")} onClick={e => {
                  e.stopPropagation();
                  handlePlanSelect(plan);
                }}>
                        <Zap className="w-4 h-4 mr-2" />
                        {plan.cta_text || "Assinar agora"}
                      </Button>
                    </div>)}
                </div>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <motion.footer className="p-4 text-center" initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} transition={{
        delay: 0.5
      }}>
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-2">
            <Wifi className="w-4 h-4 text-green-500" />
            <span>Conectado</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2025 IPTV LINK. Todos os direitos reservados.</p>
        </motion.footer>
      </div>
    </div>;
}