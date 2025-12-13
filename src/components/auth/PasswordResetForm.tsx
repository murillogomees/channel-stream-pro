/**
 * PasswordResetForm Component - Request password reset email
 */

import { useState } from 'react';
import { usePasswordManagement } from '@/hooks/useCustomAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PasswordResetFormProps {
  redirectTo?: string;
}

export function PasswordResetForm({ redirectTo }: PasswordResetFormProps) {
  const { loading, requestPasswordReset } = usePasswordManagement();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) return;
    
    try {
      await requestPasswordReset(email, redirectTo);
      setSent(true);
    } catch (error) {
      // Error is already handled by the hook
    }
  };

  if (sent) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Email enviado!</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Se existe uma conta com o email <strong>{email}</strong>, você receberá um link para redefinir sua senha.
              </p>
            </div>
            <div className="pt-4 space-y-2">
              <Button
                variant="outline"
                onClick={() => setSent(false)}
                className="w-full"
              >
                Enviar novamente
              </Button>
              <Link to="/login">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao login
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Recuperar Senha</CardTitle>
        <CardDescription>
          Digite seu email para receber o link de recuperação
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !email}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar link de recuperação'
            )}
          </Button>

          <div className="text-center">
            <Link 
              to="/login" 
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="inline h-4 w-4 mr-1" />
              Voltar ao login
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
