/**
 * PÁGINA DE LOGIN UNIFICADA
 * 
 * Design moderno com animações + funcionalidades completas:
 * - Validação com Zod
 * - Redirecionamento por roles (Admin/Client)
 * - Log de segurança em tentativas falhas
 * - Auto-redirect se já autenticado
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Loader2, Wifi } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { z } from 'zod';
const REMEMBER_ME_KEY = 'iptv_remember_me';
const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres')
});
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      const isAdminRole = isAdmin || user.roles?.includes('admin');
      const isClientRole = user.roles?.includes('client');
      console.log('[Login] Usuário autenticado, redirecionando...', {
        isAdmin: isAdminRole,
        isClient: isClientRole
      });
      let redirectTo: string;

      // Admins SEMPRE vão para o dashboard (ignorar state.from)
      if (isAdminRole) {
        redirectTo = '/dashboard';
      } else {
        // Para clientes, usar state.from se existir, senão /app/player
        const stateFrom = (location.state as any)?.from?.pathname;
        if (isClientRole) {
          redirectTo = stateFrom || '/app/player';
        } else {
          redirectTo = stateFrom || '/';
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
      } = await import('@/services/securityMonitoringService');
      await securityMonitoringService.logFailedLogin(email, undefined, navigator.userAgent, true);

      // Check suspicious IP
      fetch('https://api.ipify.org?format=json').then(res => res.json()).then(data => {
        import('@/services/suspiciousLoginService').then(module => {
          module.suspiciousLoginService.checkLogin(data.ip, email);
        });
      }).catch(() => {});
    } catch (err) {
      console.error('Erro ao registrar tentativa de login:', err);
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
      console.log('[Login] Tentando fazer login com:', validatedData.email);
      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password
      });
      if (error) {
        console.error('[Login] Erro no login:', error);
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Email ou senha incorretos');
          setTimeout(() => logFailedLogin(validatedData.email), 0);
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Por favor, confirme seu email antes de fazer login');
        } else {
          toast.error(error.message);
        }
        return;
      }
      if (data.user) {
        console.log('[Login] Login bem-sucedido:', data.user.id);
        toast.success('Login realizado com sucesso!');

        // Save remember me preference
        if (rememberMe) {
          localStorage.setItem(REMEMBER_ME_KEY, JSON.stringify({
            expires: Date.now() + REMEMBER_ME_DURATION,
            userId: data.user.id
          }));
        } else {
          localStorage.removeItem(REMEMBER_ME_KEY);
        }

        // Force user refresh to load roles
        console.log('[Login] Forçando refresh do usuário...');
        await refreshUser();
        console.log('[Login] Refresh concluído');

        // Wait for state update
        await new Promise(resolve => setTimeout(resolve, 300));
        // useEffect will handle redirect
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('Login error:', error);
        toast.error('Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Simplified Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl opacity-40" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl opacity-30" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        {/* Logo Section */}
        <div className="mb-8 flex flex-col items-center">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-4 shadow-lg">
            <img src="/logo.png" alt="IPTV Link" className="w-16 h-16 object-contain" />
          </div>
          
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
            IPTV Link
          </h1>
          
          <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-primary to-transparent mt-2" />
          
          <p className="text-muted-foreground text-sm mt-2">
            TV Online em Alta Definição
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
            {/* Card Header with Logo */}
            <div className="p-6 pb-2 flex flex-col items-center">
              <img src="/logo.png" alt="IPTV LINK" className="w-40 h-20 object-contain mb-3" />
              
              <p className="text-muted-foreground text-center text-sm mt-1">
                TV Online em Alta Definição
              </p>
            </div>

            {/* Card Content */}
            <div className="p-6 pt-4">
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email Input */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
                    Email
                  </Label>
                  <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading} autoComplete="email" autoCapitalize="none" className="bg-background border-border h-12 rounded-xl" />
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                    Senha
                  </Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} autoComplete="current-password" className="bg-background border-border h-12 rounded-xl pr-12" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent/50 transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember-me" checked={rememberMe} onCheckedChange={checked => setRememberMe(checked === true)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                  <Label htmlFor="remember-me" className="text-sm font-normal text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    Continuar conectado por 30 dias
                  </Label>
                </div>

                {/* Submit Button */}
                <div>
                  <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl text-base font-semibold text-white">
                    <span className="flex items-center justify-center gap-2">
                      {isLoading ? <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Entrando...
                        </> : <>
                          <LogIn className="w-5 h-5" />
                          Entrar
                        </>}
                    </span>
                  </Button>
                </div>
              </form>

            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="mt-6 flex items-center gap-2 text-muted-foreground text-sm">
          <Wifi className="w-4 h-4 text-green-500" />
          <span>Conectado</span>
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-muted-foreground text-center">
          © 2025 IPTV LINK. Todos os direitos reservados.
        </p>
      </div>
    </div>;
}