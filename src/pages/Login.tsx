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
import {
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  Wifi,
  Tv,
  Smartphone,
  Monitor,
  Gamepad2,
  Tablet,
  Chrome,
  Play,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Zap,
  Crown,
  Star,
} from "lucide-react";
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
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

type ViewMode = "split" | "login" | "plans";

const deviceIcons = [
  { icon: Smartphone, label: "Celular" },
  { icon: Monitor, label: "Computador" },
  { icon: Gamepad2, label: "Video Game" },
  { icon: Tablet, label: "Tablet" },
  { icon: Tv, label: "Android TV" },
  { icon: Chrome, label: "Fire Stick" },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin, loading: authLoading, refreshUser, user } = useAuth();
  const { plans, loading: plansLoading } = useSubscriptionPlans();

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
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isAdmin, authLoading, navigate, location, user]);

  const logFailedLogin = async (email: string) => {
    try {
      const { securityMonitoringService } = await import("@/services/securityMonitoringService");
      await securityMonitoringService.logFailedLogin(email, undefined, navigator.userAgent, true);

      fetch("https://api.ipify.org?format=json")
        .then((res) => res.json())
        .then((data) => {
          import("@/services/suspiciousLoginService").then((module) => {
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
        password: validatedData.password,
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
          localStorage.setItem(
            REMEMBER_ME_KEY,
            JSON.stringify({
              expires: Date.now() + REMEMBER_ME_DURATION,
              userId: data.user.id,
            }),
          );
        } else {
          localStorage.removeItem(REMEMBER_ME_KEY);
        }

        await refreshUser();
        await new Promise((resolve) => setTimeout(resolve, 300));
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
      currency: "BRL",
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl"
          animate={{
            rotate: [0, 360],
          }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header with Logo */}
        <motion.header
          className="p-4 md:p-6 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <img src="/logo.png" alt="IPTV LINK" className="w-32 md:w-40 h-auto object-contain" />
        </motion.header>

        {/* Split View Container */}
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-4 gap-4 md:gap-8">
          {/* Login Section */}
          <AnimatePresence mode="wait">
            {(viewMode === "split" || viewMode === "login") && (
              <motion.div
                key="login-section"
                className={cn(
                  "w-full transition-all duration-500",
                  viewMode === "split" ? "lg:w-1/2 max-w-md" : "max-w-lg",
                )}
                initial={{ opacity: 0, x: -50 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  scale: viewMode === "login" ? 1.02 : 1,
                }}
                exit={{ opacity: 0, x: -100, scale: 0.9 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <motion.div
                  className={cn(
                    "bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl overflow-hidden",
                    viewMode === "login" && "ring-2 ring-primary/20",
                  )}
                  whileHover={{ boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
                  onMouseEnter={() => setViewMode("login")}
                >
                  {/* Card Header */}
                  <div className="p-6 pb-2 flex flex-col items-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                      className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center"
                    >
                      <img src="/logo.png" alt="IPTV LINK" className="w-12 h-12 object-contain" />
                    </motion.div>
                    <h2 className="text-2xl font-bold text-foreground">Já sou cliente</h2>
                    <p className="text-muted-foreground text-center text-sm mt-2">
                      Entre com suas credenciais para acessar
                    </p>
                  </div>

                  {/* Login Form */}
                  <div className="p-6 pt-4">
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
                          onChange={(e) => setEmail(e.target.value)}
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
                            onChange={(e) => setPassword(e.target.value)}
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
                          onCheckedChange={(checked) => setRememberMe(checked === true)}
                        />
                        <Label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer">
                          Continuar conectado por 30 dias
                        </Label>
                      </div>

                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-12 rounded-xl text-base font-semibold"
                      >
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

                    {/* Switch to Plans */}
                    {viewMode === "login" && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 pt-4 border-t border-border/50"
                      >
                        <Button
                          variant="ghost"
                          onClick={() => setViewMode("split")}
                          className="w-full text-muted-foreground hover:text-foreground"
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Ver planos disponíveis
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Divider (only in split mode) */}
          {viewMode === "split" && (
            <motion.div
              className="hidden lg:flex flex-col items-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="w-px h-32 bg-gradient-to-b from-transparent via-border to-transparent" />
              <span className="text-muted-foreground text-sm font-medium px-3 py-1 rounded-full bg-muted/50">ou</span>
              <div className="w-px h-32 bg-gradient-to-b from-transparent via-border to-transparent" />
            </motion.div>
          )}

          {/* Plans Section */}
          <AnimatePresence mode="wait">
            {(viewMode === "split" || viewMode === "plans") && (
              <motion.div
                key="plans-section"
                className={cn("w-full transition-all duration-500", viewMode === "split" ? "lg:w-5/12" : "max-w-4xl")}
                initial={{ opacity: 0, x: 50 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  scale: viewMode === "plans" ? 1.02 : 1,
                }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <motion.div
                  className={cn(
                    "bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl overflow-hidden p-6",
                    viewMode === "plans" && "ring-2 ring-primary/20",
                  )}
                  onMouseEnter={() => setViewMode("plans")}
                >
                  {/* Plans Header */}
                  <div className="text-center mb-6">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                      className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4"
                    >
                      <Crown className="w-8 h-8 text-primary" />
                    </motion.div>
                    <h2 className="text-2xl font-bold text-foreground">Quero me cadastrar</h2>
                    <p className="text-muted-foreground text-sm mt-2">
                      Escolha o plano perfeito e comece a assistir agora!
                    </p>
                  </div>

                  {/* Device Icons */}
                  <motion.div
                    className="flex flex-wrap justify-center gap-3 mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    {deviceIcons.map((device, index) => (
                      <motion.div
                        key={device.label}
                        className="flex flex-col items-center gap-1"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 + index * 0.05 }}
                        whileHover={{ scale: 1.1, y: -2 }}
                      >
                        <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                          <device.icon className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{device.label}</span>
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Plans Grid */}
                  {plansLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {plans.map((plan, index) => (
                        <motion.div
                          key={plan.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + index * 0.1 }}
                          whileHover={{ scale: 1.02, y: -4 }}
                          onHoverStart={() => setHoveredPlan(plan.id)}
                          onHoverEnd={() => setHoveredPlan(null)}
                          onClick={() => handlePlanSelect(plan)}
                          className={cn(
                            "relative cursor-pointer rounded-xl border-2 p-3 transition-all duration-300",
                            plan.is_highlighted
                              ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                              : "border-border/50 bg-background/30 hover:border-primary/50",
                            hoveredPlan === plan.id && "ring-2 ring-primary/20",
                          )}
                        >
                          {/* Highlighted Badge */}
                          {plan.is_highlighted && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="absolute -top-3 left-1/2 -translate-x-1/2"
                            >
                              <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                MAIS POPULAR
                              </span>
                            </motion.div>
                          )}

                          {/* Savings Badge */}
                          {plan.savings_percent && plan.savings_percent > 0 && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full"
                            >
                              -{plan.savings_percent}%
                            </motion.div>
                          )}

                          <div className="text-center">
                            <h3 className="text-base font-bold text-foreground mb-1">{plan.name}</h3>
                            <div className="flex items-baseline justify-center gap-1">
                              <span className="text-2xl font-extrabold text-primary">{formatPrice(plan.price)}</span>
                              <span className="text-xs text-muted-foreground">/{plan.period}</span>
                            </div>

                            {plan.savings_amount && plan.savings_amount > 0 && (
                              <p className="text-[10px] text-green-500 mt-1">
                                Economize {formatPrice(plan.savings_amount)}
                              </p>
                            )}
                          </div>

                          {/* Features (show in expanded mode) */}
                          {viewMode === "plans" && (
                            <motion.ul
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="mt-3 space-y-1"
                            >
                              {plan.features.slice(0, 3).map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                                  <span className="line-clamp-1">{feature}</span>
                                </li>
                              ))}
                            </motion.ul>
                          )}

                          {/* CTA Button */}
                          <Button
                            size="sm"
                            className={cn(
                              "w-full mt-3 rounded-lg text-sm",
                              plan.is_highlighted ? "bg-primary hover:bg-primary/90" : "bg-muted hover:bg-muted/80",
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlanSelect(plan);
                            }}
                          >
                            <Zap className="w-4 h-4 mr-2" />
                            {plan.cta_text || "Assinar agora"}
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Benefits Banner (expanded mode) */}
                  {viewMode === "plans" && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                          <Play className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-foreground">Liberação imediata!</h4>
                          <p className="text-sm text-muted-foreground">
                            Assine agora e comece a assistir em segundos. O player mais rápido do mercado!
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Switch to Login */}
                  {viewMode === "plans" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 pt-4 border-t border-border/50"
                    >
                      <Button
                        variant="ghost"
                        onClick={() => setViewMode("split")}
                        className="w-full text-muted-foreground hover:text-foreground"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Já tenho uma conta
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <motion.footer
          className="p-4 text-center"
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
    </div>
  );
}
