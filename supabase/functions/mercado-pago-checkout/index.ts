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
    
    const { plan_id, success_url, failure_url, pending_url }: CheckoutRequest = await req.json();
    
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
    
    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    
    const baseUrl = success_url?.split("/checkout")[0] || "https://iptvlink.com.br";
    
    // Create Mercado Pago preference
    const preferenceData = {
      items: [
        {
          id: plan.id,
          title: `IPTV Link - ${plan.name}`,
          description: plan.description || `Assinatura ${plan.name}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(plan.price),
        },
      ],
      payer: {
        email: user.email,
        name: profile?.nome || user.email,
        phone: profile?.telefone ? {
          number: profile.telefone.replace(/\D/g, ""),
        } : undefined,
      },
      back_urls: {
        success: success_url || `${baseUrl}/checkout/success`,
        failure: failure_url || `${baseUrl}/checkout/failure`,
        pending: pending_url || `${baseUrl}/checkout/pending`,
      },
      auto_return: "approved",
      external_reference: `${user.id}:${plan.id}`,
      notification_url: `${supabaseUrl}/functions/v1/mercado-pago-webhook`,
      statement_descriptor: "IPTVLINK",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };
    
    console.log("[MP-Checkout] Creating preference for user:", user.id);
    
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
    
    // Store preference reference in payments table
    await supabase.from("payments").insert({
      user_id: user.id,
      mercado_pago_preference_id: preference.id,
      amount: plan.price,
      description: `Assinatura ${plan.name}`,
      external_reference: `${user.id}:${plan.id}`,
      status: "pending",
    });
    
    return new Response(JSON.stringify({
      preference_id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
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
