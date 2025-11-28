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
import { Eye, EyeOff, LogIn, Loader2, Wifi, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin, loading: authLoading, refreshUser, user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      const isAdminRole = isAdmin || user.roles?.includes('admin');
      console.log('[Login] Usuário autenticado, redirecionando...', { isAdmin: isAdminRole });
      const from = (location.state as any)?.from?.pathname || (isAdminRole ? '/dashboard' : '/conta');
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isAdmin, authLoading, navigate, location, user]);

  const logFailedLogin = async (email: string) => {
    try {
      const { securityMonitoringService } = await import('@/services/securityMonitoringService');
      await securityMonitoringService.logFailedLogin(
        email,
        undefined,
        navigator.userAgent,
        true
      );
      
      // Check suspicious IP
      fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => {
          import('@/services/suspiciousLoginService').then(module => {
            module.suspiciousLoginService.checkLogin(data.ip, email);
          });
        })
        .catch(() => {});
    } catch (err) {
      console.error('Erro ao registrar tentativa de login:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validatedData = loginSchema.parse({ email, password });

      console.log('[Login] Tentando fazer login com:', validatedData.email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
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

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl"
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: 60,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        {/* Logo Section */}
        <motion.div
          className="mb-8 flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.8, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 20,
            delay: 0.1,
          }}
        >
          <motion.div
            className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-sm border border-primary/20 flex items-center justify-center mb-4 shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <img 
              src="/logo.png" 
              alt="IPTV Link" 
              className="w-16 h-16 object-contain"
            />
          </motion.div>
          
          <motion.h1
            className="text-3xl font-bold bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            IPTV Link
          </motion.h1>
          
          <motion.div
            className="h-0.5 w-16 bg-gradient-to-r from-transparent via-primary to-transparent mt-2"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          />
          
          <motion.p
            className="text-muted-foreground text-sm mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            TV Online em Alta Definição
          </motion.p>
        </motion.div>

        {/* Login Card with Glassmorphism */}
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 150,
            damping: 20,
            delay: 0.2,
          }}
        >
          <div className="backdrop-blur-xl bg-card/70 border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
            {/* Card Header */}
            <div className="p-6 pb-2">
              <motion.h2
                className="text-xl font-semibold text-center text-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                Bem-vindo de volta
              </motion.h2>
              <motion.p
                className="text-muted-foreground text-center text-sm mt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Entre com suas credenciais
              </motion.p>
            </div>

            {/* Card Content */}
            <div className="p-6 pt-4">
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email Input */}
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
                    Email
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedInput('email')}
                      onBlur={() => setFocusedInput(null)}
                      disabled={isLoading}
                      autoComplete="email"
                      autoCapitalize="none"
                      className={`
                        bg-background/50 border-border/50 h-12 rounded-xl
                        transition-all duration-300
                        ${focusedInput === 'email' ? 'border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10' : ''}
                      `}
                    />
                    {focusedInput === 'email' && (
                      <motion.div
                        className="absolute inset-0 rounded-xl border-2 border-primary/50 pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        layoutId="input-glow"
                      />
                    )}
                  </div>
                </motion.div>

                {/* Password Input */}
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                    Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                      disabled={isLoading}
                      autoComplete="current-password"
                      className={`
                        bg-background/50 border-border/50 h-12 rounded-xl pr-12
                        transition-all duration-300
                        ${focusedInput === 'password' ? 'border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10' : ''}
                      `}
                    />
                    <motion.button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent/50 transition-colors"
                      whileTap={{ scale: 0.9 }}
                      animate={{ rotate: showPassword ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </motion.button>
                  </div>
                </motion.div>

                {/* Submit Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl text-base font-semibold relative overflow-hidden group"
                    disabled={isLoading}
                  >
                    {/* Button Glow Effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary-foreground/20 to-primary/0"
                      animate={{
                        x: ['-100%', '100%'],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 1,
                        ease: "easeInOut",
                      }}
                    />
                    
                    <span className="relative flex items-center justify-center gap-2">
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Entrando...
                        </>
                      ) : (
                        <>
                          <LogIn className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                          Entrar
                        </>
                      )}
                    </span>
                  </Button>
                </motion.div>
              </form>

              {/* Back to site link */}
              <motion.div
                className="mt-4 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para o site
                </Button>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Connection Status */}
        <motion.div
          className="mt-6 flex items-center gap-2 text-muted-foreground text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Wifi className="w-4 h-4 text-green-500" />
          </motion.div>
          <span>Conectado</span>
        </motion.div>

        {/* Footer */}
        <motion.p
          className="mt-8 text-xs text-muted-foreground text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          © 2024 IPTV Link. Todos os direitos reservados.
        </motion.p>
      </div>
    </div>
  );
}
