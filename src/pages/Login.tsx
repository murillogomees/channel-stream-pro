/**
 * PÁGINA DE LOGIN INTERATIVA
 *
 * Design moderno com tela dividida animada:
 * - Login form vs Planos de assinatura
 * - Hover para preview, click para fixar
 * - Botões de navegação entre seções
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, LogIn, Loader2, Wifi, Tv, Smartphone, Monitor, Gamepad2, Tablet, Chrome, Zap, Crown, Star, ArrowRight, ArrowLeft } from "lucide-react";
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

// Estados: split (50/50), hover-login, hover-plans, locked-login, locked-plans
type ViewMode = "split" | "hover-login" | "hover-plans" | "locked-login" | "locked-plans";

const deviceIcons = [
  { icon: Smartphone, label: "Celular" },
  { icon: Monitor, label: "Computador" },
  { icon: Gamepad2, label: "Video Game" },
  { icon: Tablet, label: "Tablet" },
  { icon: Tv, label: "Android TV" },
  { icon: Chrome, label: "Fire Stick" }
];

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
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  // Verificar se está em modo fixo (locked)
  const isLocked = viewMode === "locked-login" || viewMode === "locked-plans";
  
  // Determinar qual seção está ativa (para expansão)
  const isLoginActive = viewMode === "hover-login" || viewMode === "locked-login";
  const isPlansActive = viewMode === "hover-plans" || viewMode === "locked-plans";

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
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isAdmin, authLoading, navigate, location, user]);

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
    navigate(`/checkout?plan=${plan.slug}`);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(price);
  };

  // Handlers para hover (só funciona se não estiver locked)
  const handleLoginHover = () => {
    if (!isLocked) setViewMode("hover-login");
  };

  const handlePlansHover = () => {
    if (!isLocked) setViewMode("hover-plans");
  };

  const handleMouseLeave = () => {
    if (!isLocked) setViewMode("split");
  };

  // Handlers para click (fixa a seção)
  const handleLoginClick = () => {
    setViewMode("locked-login");
  };

  const handlePlansClick = () => {
    setViewMode("locked-plans");
  };

  // Navegar para outra seção (via botão)
  const switchToPlans = () => {
    setViewMode("locked-plans");
  };

  const switchToLogin = () => {
    setViewMode("locked-login");
  };

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
      <div className="relative z-10 h-screen flex flex-col">
        {/* Split View Container */}
        <div 
          className="flex-1 flex flex-col lg:flex-row items-center justify-center w-full pb-20"
          onMouseLeave={handleMouseLeave}
        >
          {/* Login Section */}
          <motion.div
            className={cn(
              "flex items-center justify-center cursor-pointer",
              "transition-all duration-500 ease-out"
            )}
            animate={{
              width: isLoginActive ? "100%" : isPlansActive ? "0%" : "50%",
              opacity: isPlansActive ? 0 : 1,
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            onMouseEnter={handleLoginHover}
            onClick={handleLoginClick}
            style={{ 
              overflow: isPlansActive ? "hidden" : "visible",
              pointerEvents: isPlansActive ? "none" : "auto"
            }}
          >
            <motion.div
              className={cn(
                "bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl p-6 w-[400px]",
                "transition-all duration-300",
                isLoginActive && "ring-2 ring-primary/30 shadow-primary/20"
              )}
              animate={{
                scale: isLoginActive ? 1.05 : 1,
              }}
              transition={{ duration: 0.3 }}
            >
              {/* Card Header */}
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-3">
                  <Crown className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Já sou cliente!</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Acesse sua conta e aproveite
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-3">
                <div className="space-y-1.5">
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
                    className="bg-background/50 border-border h-10 rounded-lg focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
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
                      className="bg-background/50 border-border h-10 rounded-lg pr-10 focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPassword(!showPassword);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={checked => setRememberMe(checked === true)}
                  />
                  <Label htmlFor="remember-me" className="text-xs text-muted-foreground cursor-pointer">
                    Continuar conectado por 30 dias
                  </Label>
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-10 rounded-lg text-sm font-semibold">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 mr-2" />
                      Entrar
                    </>
                  )}
                </Button>
              </form>

              {/* Device Icons - Same as plans card */}
              <div className="flex flex-wrap justify-center gap-2 mt-4 pt-4 border-t border-border/30">
                {deviceIcons.slice(0, 6).map(device => (
                  <div key={device.label} className="flex flex-col items-center gap-0.5">
                    <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center">
                      <device.icon className="w-4 h-4 text-primary/70" />
                    </div>
                    <span className="text-[9px] text-muted-foreground/70">{device.label}</span>
                  </div>
                ))}
              </div>

              {/* Switch Button */}
              <AnimatePresence>
                {viewMode === "locked-login" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mt-4 pt-3 border-t border-border/50"
                  >
                    <Button
                      variant="ghost"
                      onClick={switchToPlans}
                      className="w-full h-9 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Ainda não sou cliente
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>

          {/* Plans Section */}
          <motion.div
            className={cn(
              "flex items-center justify-center cursor-pointer",
              "transition-all duration-500 ease-out"
            )}
            animate={{
              width: isPlansActive ? "100%" : isLoginActive ? "0%" : "50%",
              opacity: isLoginActive ? 0 : 1,
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            onMouseEnter={handlePlansHover}
            onClick={handlePlansClick}
            style={{ 
              overflow: isLoginActive ? "hidden" : "visible",
              pointerEvents: isLoginActive ? "none" : "auto"
            }}
          >
            <motion.div
              className={cn(
                "bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl p-6 w-[400px]",
                "transition-all duration-300",
                isPlansActive && "ring-2 ring-primary/30 shadow-primary/20"
              )}
              animate={{
                scale: isPlansActive ? 1.05 : 1,
              }}
              transition={{ duration: 0.3 }}
            >
              {/* Plans Header */}
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-3">
                  <Crown className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Quero me cadastrar</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Escolha o plano perfeito!
                </p>
              </div>

              {/* Device Icons */}
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {deviceIcons.map(device => (
                  <div key={device.label} className="flex flex-col items-center gap-0.5">
                    <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center">
                      <device.icon className="w-4 h-4 text-primary/70" />
                    </div>
                    <span className="text-[9px] text-muted-foreground/70">{device.label}</span>
                  </div>
                ))}
              </div>

              {/* Plans Grid */}
              {plansLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {plans.map(plan => (
                    <div
                      key={plan.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlanSelect(plan);
                      }}
                      onMouseEnter={() => setHoveredPlan(plan.id)}
                      onMouseLeave={() => setHoveredPlan(null)}
                      className={cn(
                        "relative cursor-pointer rounded-lg border-2 p-2.5 transition-all duration-300 hover:scale-[1.02]",
                        plan.is_highlighted
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                          : "border-border/50 bg-background/30 hover:border-primary/50",
                        hoveredPlan === plan.id && "ring-2 ring-primary/20"
                      )}
                    >
                      {/* Highlighted Badge */}
                      {plan.is_highlighted && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star className="w-2.5 h-2.5" />
                            POPULAR
                          </span>
                        </div>
                      )}

                      {/* Savings Badge */}
                      {plan.savings_percent && plan.savings_percent > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          -{plan.savings_percent}%
                        </div>
                      )}

                      <div className="text-center pt-1">
                        <h3 className="text-sm font-bold text-foreground">{plan.name}</h3>
                        <div className="flex items-baseline justify-center gap-0.5 mt-1">
                          <span className="text-lg font-extrabold text-primary">{formatPrice(plan.price)}</span>
                          <span className="text-[10px] text-muted-foreground">/{plan.period}</span>
                        </div>

                        {plan.savings_amount && plan.savings_amount > 0 && (
                          <p className="text-[9px] text-green-500 mt-0.5">
                            Economize {formatPrice(plan.savings_amount)}
                          </p>
                        )}
                      </div>

                      {/* CTA Button */}
                      <Button
                        size="sm"
                        className={cn(
                          "w-full mt-2 rounded-md text-xs h-8",
                          plan.is_highlighted ? "bg-primary hover:bg-primary/90" : "bg-muted hover:bg-muted/80"
                        )}
                        onClick={e => {
                          e.stopPropagation();
                          handlePlanSelect(plan);
                        }}
                      >
                        <Zap className="w-3 h-3 mr-1" />
                        {plan.cta_text || "Assinar"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Switch Button */}
              <AnimatePresence>
                {viewMode === "locked-plans" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mt-4 pt-3 border-t border-border/50"
                  >
                    <Button
                      variant="ghost"
                      onClick={switchToLogin}
                      className="w-full h-9 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Já sou cliente
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </div>

      </div>

      {/* Footer - Always fixed at bottom, outside animation flow */}
      <motion.footer
        className="fixed bottom-0 left-0 right-0 z-20 p-4 text-center bg-gradient-to-t from-background to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-2">
          <Wifi className="w-4 h-4 text-green-500" />
          <span>Conectado</span>
        </div>
        <p className="text-xs text-muted-foreground">© 2025 IPTV LINK. Todos os direitos reservados.</p>
      </motion.footer>
    </div>
  );
}
