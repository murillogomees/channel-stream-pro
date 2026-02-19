/**
 * useSubscription - Hook for managing user subscription state
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { mercadoPagoService, type SubscriptionStatus, type Payment } from "@/services/mercadoPagoService";
// playbackTokenService removed with IPTV structure

export interface SubscriptionState {
  status: SubscriptionStatus | null;
  subscription: any | null;
  payments: Payment[];
  loading: boolean;
  canPlay: boolean;
}

export function useSubscription() {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    status: null,
    subscription: null,
    payments: [],
    loading: true,
    canPlay: false,
  });

  const loadSubscriptionData = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const [status, subscription, payments] = await Promise.all([
        mercadoPagoService.getSubscriptionStatus(),
        mercadoPagoService.getSubscription(),
        mercadoPagoService.getPaymentHistory(),
      ]);
      const canPlay = status === 'active' as any || status === 'authorized' as any;

      setState({
        status,
        subscription,
        payments,
        loading: false,
        canPlay,
      });
    } catch (error) {
      console.error("[useSubscription] Error loading data:", error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    loadSubscriptionData();
  }, [loadSubscriptionData]);

  const createCheckout = useCallback(async (planId: string, couponCode?: string) => {
    const checkout = await mercadoPagoService.createCheckout(planId, { couponCode });
    
    // Always use production URL (init_point) for real payments
    mercadoPagoService.redirectToCheckout(checkout.init_point);
    
    return checkout;
  }, []);

  const cancelSubscription = useCallback(async () => {
    const success = await mercadoPagoService.cancelSubscription();
    if (success) {
      await loadSubscriptionData();
    }
    return success;
  }, [loadSubscriptionData]);

  const reactivateSubscription = useCallback(async () => {
    const success = await mercadoPagoService.reactivateSubscription();
    if (success) {
      await loadSubscriptionData();
    }
    return success;
  }, [loadSubscriptionData]);

  const getPlaybackToken = useCallback(async (_contentId?: string, _contentType?: "live" | "vod") => {
    return null;
  }, []);

  return {
    ...state,
    refresh: loadSubscriptionData,
    createCheckout,
    cancelSubscription,
    reactivateSubscription,
    getPlaybackToken,
  };
}

export default useSubscription;
