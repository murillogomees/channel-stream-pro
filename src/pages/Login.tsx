/**
 * PÁGINA DE LOGIN RESPONSIVA
 *
 * Mobile: Uma coluna por vez com botões de navegação
 * Desktop/TV: Duas colunas lado a lado sempre visíveis
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, LogIn, Loader2, Wifi, Zap, Crown, Star, ArrowRight, ArrowLeft, Check } from "lucide-react";
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

type ViewMode = "login" | "plans";

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
  const [viewMode, setViewMode] = useState<ViewMode>("login");
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Desktop hover/lock states
  const [hoveredSide, setHoveredSide] = useState<"login" | "plans" | null>(null);
  const [lockedSide, setLockedSide] = useState<"login" | "plans" | null>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle mouse movement for desktop - disabled when locked
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // When a side is locked, disable all hover animations
    if (isMobile || lockedSide) {
      setHoveredSide(null);
      return;
    }
    const midPoint = window.innerWidth / 2;
    if (e.clientX < midPoint) {
      setHoveredSide("login");
    } else {
      setHoveredSide("plans");
    }
  };

  // Handle click to lock
  const handleSideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile) return;
    const midPoint = window.innerWidth / 2;
    const clickedSide = e.clientX < midPoint ? "login" : "plans";
    setLockedSide(clickedSide);
    setHoveredSide(null);
  };

  // Unlock and switch to other side
  const switchToOtherSide = (side: "login" | "plans") => {
    setLockedSide(side);
  };

  // Get the active side (locked takes priority, then hovered)
  const activeSide = lockedSide || hoveredSide;

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
    navigate(`/checkout?plan=${plan.id}`);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(price);
  };

  const switchToPlans = () => setViewMode("plans");
  const switchToLogin = () => setViewMode("login");

  // Login Card Component
  const LoginCard = () => (
    <motion.div
      className={cn(
        "bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl p-6 w-full max-w-md mx-4"
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Card Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4">
          <Crown className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Já sou cliente!</h2>
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

      {/* Switch Button - Only on Mobile or when locked */}
      {(isMobile || lockedSide === "login") && (
        <div className="mt-6 pt-4 border-t border-border/50">
          <Button
            variant="ghost"
            onClick={() => isMobile ? switchToPlans() : switchToOtherSide("plans")}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            Ainda não sou cliente
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </motion.div>
  );

  // Plans Card Component - Expanded when locked on desktop
  const isExpanded = !isMobile && lockedSide === "plans";
  
  const PlansCard = () => (
    <motion.div
      className={cn(
        "bg-card/95 backdrop-blur-xl border border-border/30 rounded-3xl shadow-2xl",
        "mx-2 sm:mx-4 transition-all duration-500",
        isExpanded 
          ? "p-8 sm:p-10 lg:p-12 w-[95vw] max-w-[1400px]" 
          : "p-4 sm:p-5 w-full max-w-[320px] sm:max-w-md"
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      layout
    >
      {/* Plans Header */}
      <div className={cn(
        "text-center",
        isExpanded ? "mb-8 lg:mb-10" : "mb-4 sm:mb-6"
      )}>
        <h2 className={cn(
          "font-bold text-foreground",
          isExpanded ? "text-3xl sm:text-4xl lg:text-5xl" : "text-lg sm:text-xl"
        )}>
          Quero me cadastrar
        </h2>
        {isExpanded && (
          <p className="text-muted-foreground mt-3 sm:mt-4 text-base sm:text-lg lg:text-xl">
            Escolha o plano ideal para você e sua família
          </p>
        )}
      </div>

      {/* Devices Banner */}
      <div className={cn(
        "bg-primary/10 border border-primary/20 rounded-2xl text-center",
        isExpanded ? "px-8 py-5 mb-8 lg:mb-10" : "px-3 py-2 mb-4"
      )}>
        <p className={cn(
          "text-primary font-medium",
          isExpanded ? "text-base sm:text-lg" : "text-[10px] sm:text-xs"
        )}>
          📱 Celular • 💻 PC • 📺 Smart TV • 🎮 Video Game • Fire Stick
        </p>
      </div>

      {/* Plans Grid */}
      {plansLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className={cn(
          "grid gap-3 sm:gap-4",
          isExpanded 
            ? "grid-cols-8 gap-5 lg:gap-8" 
            : "grid-cols-2"
        )}>
          {plans.map(plan => (
            <motion.div
              key={plan.id}
              layout
              onClick={(e) => {
                e.stopPropagation();
                handlePlanSelect(plan);
              }}
              onMouseEnter={() => setHoveredPlan(plan.id)}
              onMouseLeave={() => setHoveredPlan(null)}
              className={cn(
                "relative cursor-pointer rounded-2xl border-2 transition-all duration-200",
                "hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98]",
                isExpanded ? "col-span-2 p-6 sm:p-8 min-h-[420px] flex flex-col" : "p-2.5 sm:p-3",
                plan.is_highlighted
                  ? "border-primary bg-primary/10 shadow-xl shadow-primary/20 ring-1 ring-primary/30"
                  : "border-border/50 bg-background/60 hover:border-primary/40 hover:bg-background/80",
                hoveredPlan === plan.id && "ring-2 ring-primary/40"
              )}
            >
              {/* Highlighted Badge */}
              {plan.is_highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <span className={cn(
                    "bg-primary text-primary-foreground font-bold rounded-full flex items-center gap-1.5 whitespace-nowrap shadow-lg",
                    isExpanded ? "text-base px-5 py-2" : "text-[9px] sm:text-[10px] px-2 py-0.5"
                  )}>
                    <Star className={cn(isExpanded ? "w-5 h-5" : "w-2.5 h-2.5")} fill="currentColor" />
                    MAIS POPULAR
                  </span>
                </div>
              )}

              {/* Savings Badge */}
              {plan.savings_percent && plan.savings_percent > 0 && (
                <div className={cn(
                  "absolute bg-emerald-500 text-white font-bold rounded-full shadow-lg",
                  isExpanded 
                    ? "-top-3 -right-3 text-base px-4 py-2" 
                    : "-top-1.5 -right-1.5 text-[9px] sm:text-[10px] px-1.5 py-0.5"
                )}>
                  -{plan.savings_percent}%
                </div>
              )}

              <div className={cn(
                "text-center flex-1 flex flex-col", 
                plan.is_highlighted && isExpanded && "pt-4",
                plan.is_highlighted && !isExpanded && "pt-2"
              )}>
                <h3 className={cn(
                  "font-bold text-foreground leading-tight",
                  isExpanded ? "text-2xl sm:text-3xl" : "text-sm sm:text-base"
                )}>
                  {plan.name}
                </h3>
                
                <div className={cn(
                  "flex items-baseline justify-center gap-1.5",
                  isExpanded ? "mt-6" : "mt-2"
                )}>
                  <span className={cn(
                    "font-extrabold text-primary",
                    isExpanded ? "text-4xl sm:text-5xl" : "text-lg sm:text-xl"
                  )}>
                    {formatPrice(plan.price)}
                  </span>
                  <span className={cn(
                    "text-muted-foreground font-medium",
                    isExpanded ? "text-lg" : "text-[10px] sm:text-xs"
                  )}>
                    /{plan.period}
                  </span>
                </div>

                {/* Price per month for multi-month plans */}
                {isExpanded && plan.period_months > 1 && (
                  <p className="text-base text-muted-foreground mt-2">
                    {formatPrice(plan.price / plan.period_months)}/mês
                  </p>
                )}

                {plan.savings_amount && plan.savings_amount > 0 && (
                  <p className={cn(
                    "text-emerald-500 font-semibold",
                    isExpanded ? "text-lg mt-3" : "text-[9px] sm:text-[10px] mt-0.5"
                  )}>
                    Economize {formatPrice(plan.savings_amount)}
                  </p>
                )}

                {/* Features - Only show when expanded */}
                {isExpanded && plan.features && plan.features.length > 0 && (
                  <motion.div 
                    className="mt-6 pt-6 border-t border-border/30 flex-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <ul className="space-y-3 text-left">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3 text-base text-foreground/80">
                          <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </div>

              {/* CTA Button */}
              <Button
                size={isExpanded ? "lg" : "sm"}
                className={cn(
                  "w-full rounded-xl font-semibold transition-all",
                  isExpanded ? "mt-auto h-14 text-lg" : "mt-2 sm:mt-2.5 h-8 sm:h-9 text-xs sm:text-sm",
                  plan.is_highlighted 
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30" 
                    : "bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 hover:border-primary/50"
                )}
                onClick={e => {
                  e.stopPropagation();
                  handlePlanSelect(plan);
                }}
              >
                <Zap className={cn(
                  "mr-2",
                  isExpanded ? "w-6 h-6" : "w-3.5 h-3.5"
                )} />
                {plan.cta_text || "Assinar Agora"}
              </Button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Switch Button - Only on Mobile or when locked */}
      {(isMobile || lockedSide === "plans") && (
        <div className={cn(
          "border-t border-border/30",
          isExpanded ? "mt-10 pt-8" : "mt-4 pt-3"
        )}>
          <Button
            variant="ghost"
            onClick={() => isMobile ? switchToLogin() : switchToOtherSide("login")}
            className={cn(
              "w-full text-muted-foreground hover:text-foreground",
              isExpanded ? "h-16 text-xl" : "h-10 text-sm"
            )}
          >
            <ArrowLeft className={cn("mr-2", isExpanded ? "w-6 h-6" : "w-4 h-4")} />
            Já sou cliente
          </Button>
        </div>
      )}
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
      <div 
        className="relative z-10 h-screen flex items-center justify-center"
        onMouseMove={handleMouseMove}
        onClick={handleSideClick}
      >
        {isMobile ? (
          /* Mobile: One card at a time with animation */
          <AnimatePresence mode="wait">
            {viewMode === "login" ? (
              <LoginCard key="login" />
            ) : (
              <PlansCard key="plans" />
            )}
          </AnimatePresence>
        ) : (
          /* Desktop/TV: Show only active card, hide the other */
          <div className="relative w-full h-full flex items-center justify-center">
            <AnimatePresence mode="wait">
              {activeSide === "login" || !activeSide ? (
                <motion.div
                  key="login-card"
                  className="absolute"
                  initial={{ opacity: 0, scale: 0.9, x: activeSide ? 0 : "-15vw" }}
                  animate={{ 
                    opacity: 1, 
                    scale: activeSide === "login" ? 1 : 0.95,
                    x: activeSide === "login" ? 0 : "-15vw"
                  }}
                  exit={{ opacity: 0, scale: 0.9, x: "-30vw" }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <LoginCard />
                </motion.div>
              ) : null}

              {activeSide === "plans" || !activeSide ? (
                <motion.div
                  key="plans-card"
                  className="absolute"
                  initial={{ opacity: 0, scale: 0.9, x: activeSide ? 0 : "15vw" }}
                  animate={{ 
                    opacity: 1, 
                    scale: activeSide === "plans" ? 1 : 0.95,
                    x: activeSide === "plans" ? 0 : "15vw"
                  }}
                  exit={{ opacity: 0, scale: 0.9, x: "30vw" }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <PlansCard />
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Hint text when not active */}
            {!activeSide && (
              <motion.p
                className="absolute bottom-32 text-muted-foreground text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                transition={{ delay: 1 }}
              >
                Mova o mouse ou clique para selecionar
              </motion.p>
            )}
          </div>
        )}
      </div>

      {/* Footer - Fixed at bottom */}
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
