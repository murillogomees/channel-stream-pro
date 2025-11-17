/**
 * PÁGINA DE LOGIN UNIFICADA
 * 
 * Autentica usuários e redireciona baseado em roles:
 * - Admin/Super Admin → /admin/dashboard
 * - Client → /conta
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Tv, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin, loading: authLoading, refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      console.log('[Login] Usuário autenticado, redirecionando...', { isAdmin });
      const from = (location.state as any)?.from?.pathname || (isAdmin ? '/admin/dashboard' : '/conta');
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isAdmin, authLoading, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
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
        
        // Forçar refresh dos dados do usuário para garantir que as roles sejam carregadas
        console.log('[Login] Forçando refresh do usuário...');
        await refreshUser();
        console.log('[Login] Refresh concluído');
        
        // Aguardar um pouco para garantir que o estado seja atualizado
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // O useEffect vai redirecionar automaticamente
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-6">
          <Tv className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-2xl font-bold">Acesso ao Sistema</h1>
          <p className="text-muted-foreground mt-2">Entre com suas credenciais</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              disabled={isLoading}
            />
          </div>
          
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
            />
          </div>
          
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
          
          <div className="text-center text-sm">
            <Button
              type="button"
              variant="link"
              className="p-0 h-auto"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o site
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
