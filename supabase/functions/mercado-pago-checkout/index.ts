import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const mercadoPagoAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")!;

interface CheckoutRequest {
  plan_id: string;
  coupon_code?: string;
  success_url?: string;
  failure_url?: string;
  pending_url?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const { plan_id, coupon_code, success_url, failure_url, pending_url }: CheckoutRequest = await req.json();
    
    if (!plan_id) {
      return new Response(JSON.stringify({ error: "plan_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .eq("is_active", true)
      .single();
    
    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Calculate price with coupon discount
    let finalPrice = Number(plan.price);
    let discountApplied = 0;
    let couponId: string | null = null;
    
    if (coupon_code) {
      console.log("[MP-Checkout] Validating coupon:", coupon_code);
      
      const { data: coupon, error: couponError } = await supabase
        .from("discount_coupons")
        .select("*")
        .eq("code", coupon_code.toUpperCase())
        .eq("active", true)
        .single();
      
      if (!couponError && coupon) {
        const now = new Date();
        const validFrom = new Date(coupon.valid_from);
        const validUntil = new Date(coupon.valid_until);
        
        // Check if coupon is valid
        const isValid = now >= validFrom && now <= validUntil && 
          (coupon.max_uses === null || coupon.current_uses < coupon.max_uses);
        
        if (isValid) {
          couponId = coupon.id;
          
          if (coupon.discount_type === 'percentage') {
            discountApplied = finalPrice * (coupon.discount_value / 100);
          } else {
            discountApplied = Math.min(coupon.discount_value, finalPrice);
          }
          
          finalPrice = Math.max(0, finalPrice - discountApplied);
          
          console.log(`[MP-Checkout] Coupon applied: ${coupon.code}, discount: R$${discountApplied.toFixed(2)}, final: R$${finalPrice.toFixed(2)}`);
        } else {
          console.log("[MP-Checkout] Coupon invalid or expired:", coupon_code);
        }
      } else {
        console.log("[MP-Checkout] Coupon not found:", coupon_code);
      }
    }
    
    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    
    const baseUrl = success_url?.split("/checkout")[0] || "https://iptvlink.com.br";
    
    // Build item description with discount info
    let itemTitle = `IPTV Link - ${plan.name}`;
    let itemDescription = plan.description || `Assinatura ${plan.name}`;
    
    if (discountApplied > 0) {
      itemDescription += ` (Desconto: R$${discountApplied.toFixed(2)})`;
    }
    
    // Create Mercado Pago preference with discounted price
    const preferenceData = {
      items: [
        {
          id: plan.id,
          title: itemTitle,
          description: itemDescription,
          quantity: 1,
          currency_id: "BRL",
          unit_price: finalPrice, // Use discounted price
        },
      ],
      payer: {
        email: user.email,
        name: profile?.nome || user.email,
        phone: profile?.contact_phone ? {
          number: profile.contact_phone.replace(/\D/g, ""),
        } : undefined,
      },
      back_urls: {
        success: success_url || `${baseUrl}/checkout/success`,
        failure: failure_url || `${baseUrl}/checkout/failure`,
        pending: pending_url || `${baseUrl}/checkout/pending`,
      },
      auto_return: "approved",
      // Include coupon info in external_reference: user_id:plan_id:coupon_id
      external_reference: couponId 
        ? `${user.id}:${plan.id}:${couponId}`
        : `${user.id}:${plan.id}`,
      notification_url: `${supabaseUrl}/functions/v1/mercado-pago-webhook`,
      statement_descriptor: "IPTVLINK",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };
    
    console.log("[MP-Checkout] Creating preference for user:", user.id, "price:", finalPrice);
    console.log("[MP-Checkout] Notification URL:", preferenceData.notification_url);
    
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mercadoPagoAccessToken}`,
      },
      body: JSON.stringify(preferenceData),
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error("[MP-Checkout] Mercado Pago error:", errorData);
      return new Response(JSON.stringify({ error: "Failed to create checkout" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const preference = await response.json();
    
    console.log("[MP-Checkout] Preference created:", preference.id);
    
    // Store preference reference in payments table with coupon info
    await supabase.from("payments").insert({
      user_id: user.id,
      mercado_pago_preference_id: preference.id,
      amount: finalPrice, // Store discounted amount
      description: `Assinatura ${plan.name}${discountApplied > 0 ? ` (Desconto: R$${discountApplied.toFixed(2)})` : ''}`,
      external_reference: preferenceData.external_reference,
      status: "pending",
      metadata: {
        original_price: Number(plan.price),
        discount_applied: discountApplied,
        coupon_id: couponId,
        coupon_code: coupon_code || null,
      },
    });
    
    return new Response(JSON.stringify({
      preference_id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
      original_price: Number(plan.price),
      final_price: finalPrice,
      discount_applied: discountApplied,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("[MP-Checkout] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
