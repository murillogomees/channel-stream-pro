/**
 * Mercado Pago Integration Service
 * Handles checkout and subscription management
 */

import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_FUNCTIONS_URL } from "@/config/supabase";

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
  status: string;
  payment_method: string;
  created_at: string;
  paid_at: string | null;
}

class MercadoPagoService {
  private functionUrl = SUPABASE_FUNCTIONS_URL;

  /**
   * Create a checkout session for a subscription plan
   * @param planId - The subscription plan ID
   * @param options - Checkout options including coupon code and redirect URLs
   */
  async createCheckout(planId: string, options?: {
    couponCode?: string;
    successUrl?: string;
    failureUrl?: string;
    pendingUrl?: string;
  }): Promise<CheckoutResponse & { original_price?: number; final_price?: number; discount_applied?: number }> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${this.functionUrl}/mercado-pago-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        plan_id: planId,
        coupon_code: options?.couponCode,
        success_url: options?.successUrl || `${window.location.origin}/checkout/success`,
        failure_url: options?.failureUrl || `${window.location.origin}/checkout/failure`,
        pending_url: options?.pendingUrl || `${window.location.origin}/checkout/pending`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create checkout");
    }

    return response.json();
  }

  /**
   * Get current user's subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus | null> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data, error } = await supabase
      .rpc("get_subscription_status", { p_user_id: user.id });

    if (error) {
      console.error("[MercadoPago] Error getting subscription status:", error);
      return null;
    }

    return data?.[0] || null;
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
      .single();

    if (error && error.code !== "PGRST116") {
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
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[MercadoPago] Error getting payments:", error);
      return [];
    }

    return data || [];
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
        canceled_at: new Date().toISOString(),
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
        canceled_at: null,
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
