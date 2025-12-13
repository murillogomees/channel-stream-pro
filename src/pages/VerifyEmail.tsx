/**
 * PÁGINA DE VERIFICAÇÃO DE EMAIL
 * @version 1.0.0
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { customAuthService } from '@/services/customAuthService';
import { toast } from 'sonner';

type VerificationStatus = 'verifying' | 'success' | 'error' | 'expired';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      const { error } = await customAuthService.verifyEmail(token!);

      if (error) {
        if (error.message.includes('expired')) {
          setStatus('expired');
        } else {
          setStatus('error');
        }
        return;
      }

      setStatus('success');
      toast.success('Email verificado com sucesso!');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      setStatus('error');
    }
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    
    try {
      // User needs to provide email - redirect to forgot password which handles this
      toast.info('Faça login para reenviar a verificação de email');
      navigate('/login');
    } catch (error) {
      toast.error('Erro ao reenviar email');
    } finally {
      setIsResending(false);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return (
          <>
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Verificando Email...</h1>
            <p className="text-muted-foreground">
              Aguarde enquanto confirmamos seu email.
            </p>
          </>
        );

      case 'success':
        return (
          <>
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Email Verificado!</h1>
            <p className="text-muted-foreground mb-6">
              Sua conta foi verificada com sucesso. Redirecionando para o login...
            </p>
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
          </>
        );

      case 'expired':
        return (
          <>
            <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
              <RefreshCw className="w-10 h-10 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Link Expirado</h1>
            <p className="text-muted-foreground mb-6">
              O link de verificação expirou. Solicite um novo email.
            </p>
            <Button
              onClick={handleResendVerification}
              disabled={isResending}
              className="w-full"
            >
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Reenviando...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Reenviar email de verificação
                </>
              )}
            </Button>
          </>
        );

      case 'error':
      default:
        return (
          <>
            <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Erro na Verificação</h1>
            <p className="text-muted-foreground mb-6">
              Não foi possível verificar seu email. O link pode ser inválido.
            </p>
            <div className="space-y-3">
              <Button
                onClick={handleResendVerification}
                disabled={isResending}
                className="w-full"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Reenviando...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Solicitar novo email
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/login')}
                className="w-full"
              >
                Voltar ao login
              </Button>
            </div>
          </>
        );
    }
  };

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
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-card/90 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl p-8 w-full max-w-md text-center"
      >
        {renderContent()}
      </motion.div>
    </div>
  );
}
