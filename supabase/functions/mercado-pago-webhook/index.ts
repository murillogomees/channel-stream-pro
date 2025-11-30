import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

interface MercadoPagoWebhookPayload {
  id?: string;
  action: string;
  api_version: string;
  data: {
    id: string;
  };
  date_created: string;
  live_mode: boolean;
  type: string;
  user_id: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const mercadoPagoAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")!;
const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");

function verifySignature(payload: string, signature: string | null): boolean {
  if (!webhookSecret || !signature) {
    console.log("[MP-Webhook] No secret configured or no signature provided, skipping verification");
    return true; // Skip verification in sandbox mode
  }
  
  try {
    const parts = signature.split(",");
    const tsMatch = parts.find(p => p.startsWith("ts="));
    const v1Match = parts.find(p => p.startsWith("v1="));
    
    if (!tsMatch || !v1Match) return false;
    
    const ts = tsMatch.split("=")[1];
    const v1 = v1Match.split("=")[1];
    
    const signedPayload = `id:;request-id:;ts:${ts};${payload}`;
    const expectedSig = createHmac("sha256", webhookSecret)
      .update(signedPayload)
      .digest("hex");
    
    return expectedSig === v1;
  } catch (error) {
    console.error("[MP-Webhook] Signature verification error:", error);
    return false;
  }
}

async function getPaymentDetails(paymentId: string) {
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${mercadoPagoAccessToken}`,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch payment: ${response.status}`);
  }
  
  return response.json();
}

async function processPayment(supabase: any, paymentData: any) {
  const externalReference = paymentData.external_reference;
  const status = paymentData.status;
  
  console.log(`[MP-Webhook] Processing payment ${paymentData.id} with status ${status}`);
  
  // Map Mercado Pago status to our status
  const statusMap: Record<string, string> = {
    approved: "approved",
    pending: "pending",
    in_process: "in_process",
    rejected: "rejected",
    refunded: "refunded",
    cancelled: "cancelled",
  };
  
  const mappedStatus = statusMap[status] || "pending";
  
  // Extract user_id from external_reference (format: user_id:plan_id)
  let userId: string | null = null;
  let planId: string | null = null;
  
  if (externalReference) {
    const parts = externalReference.split(":");
    userId = parts[0];
    planId = parts[1] || null;
  }
  
  if (!userId) {
    console.error("[MP-Webhook] No user_id in external_reference");
    return { success: false, error: "Missing user reference" };
  }
  
  // Upsert payment record
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .upsert({
      mercado_pago_payment_id: paymentData.id.toString(),
      user_id: userId,
      amount: paymentData.transaction_amount,
      currency: paymentData.currency_id,
      status: mappedStatus,
      payment_method: paymentData.payment_method_id,
      payment_type: paymentData.payment_type_id,
      description: paymentData.description,
      external_reference: externalReference,
      payer_email: paymentData.payer?.email,
      metadata: {
        mercado_pago_data: paymentData,
      },
      paid_at: status === "approved" ? new Date().toISOString() : null,
    }, {
      onConflict: "mercado_pago_payment_id",
    })
    .select()
    .single();
  
  if (paymentError) {
    console.error("[MP-Webhook] Payment upsert error:", paymentError);
    return { success: false, error: paymentError.message };
  }
  
  // If payment approved, update subscription
  if (status === "approved" && planId) {
    // Get plan details
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();
    
    // Calculate period based on plan duration
    let periodDays = 30; // Default monthly
    if (plan) {
      if (plan.name?.toLowerCase().includes("trimestral")) periodDays = 90;
      else if (plan.name?.toLowerCase().includes("semestral")) periodDays = 180;
      else if (plan.name?.toLowerCase().includes("anual")) periodDays = 365;
    }
    
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + periodDays);
    
    // Upsert subscription
    const { error: subError } = await supabase
      .from("user_subscriptions")
      .upsert({
        user_id: userId,
        plan_id: planId,
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        trial_end: null,
      }, {
        onConflict: "user_id",
      });
    
    if (subError) {
      console.error("[MP-Webhook] Subscription update error:", subError);
    } else {
      console.log(`[MP-Webhook] Subscription activated for user ${userId}`);
      
      // Update user role to ensure they have client role
      await supabase
        .from("user_roles")
        .upsert({
          user_id: userId,
          role: "client",
        }, {
          onConflict: "user_id,role",
        });
      
      // Update clientes table if exists
      await supabase
        .from("clientes")
        .update({
          situacao: "Ativo",
          data_ultimo_pagamento: new Date().toISOString(),
          valor_pago: paymentData.transaction_amount,
          forma_ultimo_pagamento: paymentData.payment_method_id,
          plano: plan?.name || "Mensal",
        })
        .eq("user_id", userId);
    }
  }
  
  // If payment rejected/cancelled, check if subscription should be updated
  if (["rejected", "cancelled", "refunded"].includes(status)) {
    console.log(`[MP-Webhook] Payment ${status} for user ${userId}`);
  }
  
  return { success: true, payment };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const body = await req.text();
    const signature = req.headers.get("x-signature");
    
    console.log("[MP-Webhook] Received webhook");
    
    // Verify signature (optional in sandbox)
    if (webhookSecret && !verifySignature(body, signature)) {
      console.error("[MP-Webhook] Invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const payload: MercadoPagoWebhookPayload = JSON.parse(body);
    
    // Log webhook for debugging
    await supabase.from("mercado_pago_webhooks").insert({
      event_id: payload.id,
      event_type: payload.type,
      action: payload.action,
      data_id: payload.data?.id,
      raw_payload: payload,
    });
    
    console.log(`[MP-Webhook] Event type: ${payload.type}, action: ${payload.action}`);
    
    // Process payment events
    if (payload.type === "payment") {
      const paymentId = payload.data.id;
      
      // Fetch full payment details
      const paymentData = await getPaymentDetails(paymentId);
      const result = await processPayment(supabase, paymentData);
      
      // Mark webhook as processed
      await supabase
        .from("mercado_pago_webhooks")
        .update({ processed: true })
        .eq("event_id", payload.id);
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Handle subscription events
    if (payload.type === "subscription_preapproval" || payload.type === "subscription_authorized_payment") {
      console.log(`[MP-Webhook] Subscription event: ${payload.type}`);
      // Handle recurring subscription events
    }
    
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("[MP-Webhook] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
