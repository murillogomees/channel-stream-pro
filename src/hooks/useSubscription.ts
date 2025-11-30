/**
 * useSubscription - Hook for managing user subscription state
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { mercadoPagoService, type SubscriptionStatus, type Payment } from "@/services/mercadoPagoService";
import { playbackTokenService } from "@/services/playbackTokenService";

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
      const [status, subscription, payments, canPlay] = await Promise.all([
        mercadoPagoService.getSubscriptionStatus(),
        mercadoPagoService.getSubscription(),
        mercadoPagoService.getPaymentHistory(),
        playbackTokenService.canPlay(),
      ]);

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

  const createCheckout = useCallback(async (planId: string) => {
    const checkout = await mercadoPagoService.createCheckout(planId);
    
    // Redirect to sandbox URL in development
    const isDev = window.location.hostname === "localhost" || 
                  window.location.hostname.includes("lovable");
    
    mercadoPagoService.redirectToCheckout(
      isDev ? checkout.sandbox_init_point : checkout.init_point
    );
    
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

  const getPlaybackToken = useCallback(async (contentId?: string, contentType?: "live" | "vod") => {
    return playbackTokenService.generateToken(contentId, contentType);
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
