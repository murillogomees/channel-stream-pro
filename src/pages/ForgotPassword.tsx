/**
 * PÁGINA DE RECUPERAÇÃO DE SENHA
 * @version 1.0.0
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Loader2, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { customAuthService } from '@/services/customAuthService';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Digite seu email');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await customAuthService.requestPasswordReset(email);
      
      if (error) {
        toast.error(error.message || 'Erro ao enviar email');
        return;
      }

      setSent(true);
      toast.success('Email enviado com sucesso!');
    } catch (error) {
      toast.error('Erro ao enviar email de recuperação');
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card/90 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl p-8 w-full max-w-md text-center"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-2">Email Enviado!</h1>
          <p className="text-muted-foreground mb-6">
            Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
          </p>

          <Button
            variant="outline"
            onClick={() => navigate('/login')}
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao login
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative bg-card/90 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl p-8 w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-5">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Esqueceu a Senha?</h1>
          <p className="text-muted-foreground mt-2">
            Digite seu email para receber o link de recuperação
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
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
              className="bg-background/50 border-border h-12 rounded-xl"
            />
          </div>

          <Button 
            type="submit" 
            disabled={isLoading} 
            className="w-full h-12 rounded-xl text-base font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              <>
                <Mail className="w-5 h-5 mr-2" />
                Enviar email de recuperação
              </>
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border/50">
          <Button
            variant="ghost"
            onClick={() => navigate('/login')}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao login
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
