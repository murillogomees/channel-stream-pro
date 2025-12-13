/**
 * Mercado Pago Integration Service - Simplified
 * Handles checkout and subscription management
 */

import { supabase } from "@/integrations/supabase/client";

export interface CheckoutResponse {
  preference_id: string;
  init_point: string;
  sandbox_init_point: string;
}

export interface SubscriptionStatus {
  has_subscription: boolean;
  status: "trial" | "active" | "canceled" | "expired" | "past_due" | null;
  plan_name: string | null;
  expires_at: string | null;
  can_play: boolean;
}

export interface Payment {
  id: string;
  amount: number;
  status: string | null;
  payment_method: string | null;
  created_at: string | null;
  paid_at: string | null;
}

class MercadoPagoService {
  /**
   * Create a checkout session for a subscription plan
   */
  async createCheckout(planId: string, options?: {
    couponCode?: string;
    successUrl?: string;
    failureUrl?: string;
    pendingUrl?: string;
  }): Promise<CheckoutResponse & { original_price?: number; final_price?: number; discount_applied?: number }> {
    const { data, error } = await supabase.functions.invoke('mercado-pago-checkout', {
      body: {
        plan_id: planId,
        coupon_code: options?.couponCode,
        success_url: options?.successUrl || `${window.location.origin}/checkout/success`,
        failure_url: options?.failureUrl || `${window.location.origin}/checkout/failure`,
        pending_url: options?.pendingUrl || `${window.location.origin}/checkout/pending`,
      },
    });

    if (error) {
      throw new Error(error.message || "Failed to create checkout");
    }

    return data;
  }

  /**
   * Get current user's subscription status from profiles table
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus | null> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('plano, situacao, data_vencimento')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) {
      console.error("[MercadoPago] Error getting subscription status:", error);
      return null;
    }

    const now = new Date();
    const expiresAt = data.data_vencimento ? new Date(data.data_vencimento) : null;
    const isExpired = expiresAt ? expiresAt < now : true;

    return {
      has_subscription: !!data.plano && !isExpired,
      status: data.situacao === 'Testando' ? 'trial' : 
              data.situacao === 'Ativo' ? 'active' : 
              data.situacao === 'Inadimplente' ? 'expired' : null,
      plan_name: data.plano,
      expires_at: data.data_vencimento,
      can_play: !isExpired && (data.situacao === 'Ativo' || data.situacao === 'Testando'),
    };
  }

  /**
   * Get current user's subscription details
   */
  async getSubscription() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data, error } = await supabase
      .from("user_subscriptions")
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[MercadoPago] Error getting subscription:", error);
      return null;
    }

    return data;
  }

  /**
   * Get user's payment history
   */
  async getPaymentHistory(): Promise<Payment[]> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return [];

    const { data, error } = await supabase
      .from("payments")
      .select("id, amount, status, payment_method, created_at, paid_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[MercadoPago] Error getting payments:", error);
      return [];
    }

    return (data || []) as Payment[];
  }

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return false;

    const { error } = await supabase
      .from("user_subscriptions")
      .update({
        cancel_at_period_end: true,
      })
      .eq("user_id", user.id);

    if (error) {
      console.error("[MercadoPago] Error canceling subscription:", error);
      return false;
    }

    return true;
  }

  /**
   * Reactivate canceled subscription
   */
  async reactivateSubscription(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return false;

    const { error } = await supabase
      .from("user_subscriptions")
      .update({
        cancel_at_period_end: false,
      })
      .eq("user_id", user.id);

    if (error) {
      console.error("[MercadoPago] Error reactivating subscription:", error);
      return false;
    }

    return true;
  }

  /**
   * Redirect to Mercado Pago checkout (production mode)
   */
  redirectToCheckout(checkoutUrl: string): void {
    window.location.href = checkoutUrl;
  }
}

export const mercadoPagoService = new MercadoPagoService();
export default mercadoPagoService;
