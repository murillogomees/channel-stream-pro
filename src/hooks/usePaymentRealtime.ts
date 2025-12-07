/**
 * usePaymentRealtime - Hook para atualização em tempo real quando pagamento é aprovado
 * Escuta mudanças na tabela payments e atualiza os dados do usuário automaticamente
 */

import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function usePaymentRealtime() {
  const { user, refreshUser } = useAuth();

  const handlePaymentUpdate = useCallback(async (payload: any) => {
    const { new: newPayment, old: oldPayment } = payload;
    
    // Verificar se é o usuário atual
    if (newPayment?.user_id !== user?.id) return;
    
    // Verificar se status mudou para approved
    if (newPayment?.status === 'approved' && oldPayment?.status !== 'approved') {
      console.log('[PaymentRealtime] Pagamento aprovado detectado:', newPayment.id);
      
      // Atualizar dados do usuário
      await refreshUser();
      
      // Notificar usuário
      toast.success('Pagamento aprovado! Seu plano foi ativado.', {
        duration: 5000,
        description: 'Aproveite todos os recursos do seu novo plano.',
      });
    }
  }, [user?.id, refreshUser]);

  useEffect(() => {
    if (!user?.id) return;

    // Criar channel para escutar mudanças na tabela payments
    const channel = supabase
      .channel('payment-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: `user_id=eq.${user.id}`,
        },
        handlePaymentUpdate
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async (payload) => {
          // Atualizar quando profile mudar (plano, situacao, etc)
          console.log('[PaymentRealtime] Profile atualizado:', payload);
          await refreshUser();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const { new: newSub, old: oldSub } = payload;
          // Se subscription mudou de trial/pending para active
          if (newSub?.status === 'active' && oldSub?.status !== 'active') {
            console.log('[PaymentRealtime] Subscription ativada:', newSub.id);
            await refreshUser();
            toast.success('Sua assinatura foi ativada!', { duration: 5000 });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, handlePaymentUpdate, refreshUser]);
}

export default usePaymentRealtime;
