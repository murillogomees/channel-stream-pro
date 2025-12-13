/**
 * PÁGINA DE VERIFICAÇÃO DE EMAIL
 * @version 2.0.0 - Usa Supabase GoTrue
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type VerificationStatus = 'verifying' | 'success' | 'error' | 'expired';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<VerificationStatus>('verifying');

  useEffect(() => {
    // Supabase handles email verification via URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');

    if (type === 'signup' || type === 'email' || accessToken) {
      // Session should be set automatically by Supabase
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setStatus('success');
          toast.success('Email verificado com sucesso!');
          setTimeout(() => navigate('/app/home'), 3000);
        } else {
          setStatus('error');
        }
      });
    } else {
      setStatus('error');
    }
  }, [navigate]);

  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return (
          <>
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Verificando Email...</h1>
            <p className="text-muted-foreground">Aguarde enquanto confirmamos seu email.</p>
          </>
        );

      case 'success':
        return (
          <>
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Email Verificado!</h1>
            <p className="text-muted-foreground mb-6">Redirecionando...</p>
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
          </>
        );

      default:
        return (
          <>
            <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Erro na Verificação</h1>
            <p className="text-muted-foreground mb-6">Link inválido ou expirado.</p>
            <Button onClick={() => navigate('/login')} className="w-full">Voltar ao login</Button>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
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
