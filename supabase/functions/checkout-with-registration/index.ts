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
  user_data: {
    nome: string;
    email: string;
    telefone: string;
    senha: string;
    origem: string;
  };
  payment_method?: string; // pix, credit_card, debit_card, boleto
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
    const body: CheckoutRequest = await req.json();
    const { plan_id, user_data, payment_method, coupon_code, success_url, failure_url, pending_url } = body;

    console.log("[Checkout] Starting registration for:", user_data.email);

    // Validate required fields
    if (!plan_id || !user_data.nome || !user_data.email || !user_data.telefone || !user_data.senha) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate password strength
    if (user_data.senha.length < 6) {
      return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", user_data.email)
      .single();

    if (existingUser) {
      return new Response(JSON.stringify({ error: "Este email já está cadastrado. Faça login." }), {
        status: 409,
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
      console.error("[Checkout] Plan not found:", planError);
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate discount if coupon provided
    let finalPrice = plan.price;
    let couponData = null;

    if (coupon_code) {
      const { data: coupon } = await supabase
        .from("discount_coupons")
        .select("*")
        .eq("code", coupon_code.toUpperCase())
        .eq("active", true)
        .gte("valid_until", new Date().toISOString())
        .lte("valid_from", new Date().toISOString())
        .single();

      if (coupon) {
        if (coupon.max_uses === null || coupon.current_uses < coupon.max_uses) {
          couponData = coupon;
          if (coupon.discount_type === "percentage") {
            finalPrice = plan.price - (plan.price * coupon.discount_value / 100);
          } else {
            finalPrice = Math.max(0, plan.price - coupon.discount_value);
          }
        }
      }
    }

    // 1. Create user in auth
    console.log("[Checkout] Creating auth user...");
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user_data.email,
      password: user_data.senha,
      email_confirm: true, // Auto-confirm email for checkout flow
      user_metadata: {
        nome: user_data.nome,
        telefone: user_data.telefone,
        origem_cadastro: user_data.origem,
      },
    });

    if (authError || !authData.user) {
      console.error("[Checkout] Auth creation error:", authError);
      return new Response(JSON.stringify({ 
        error: authError?.message || "Erro ao criar usuário" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    console.log("[Checkout] User created:", userId);

    // 2. Create profile (trigger should create it, but let's ensure it exists)
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        nome: user_data.nome,
        email: user_data.email,
        telefone: user_data.telefone,
        telefone_whatsapp: user_data.telefone,
        origem_cadastro: user_data.origem,
      }, { onConflict: "id" });

    if (profileError) {
      console.error("[Checkout] Profile creation error:", profileError);
    }

    // 3. Create user role (client)
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "client",
      });

    if (roleError && !roleError.message.includes("duplicate")) {
      console.error("[Checkout] Role creation error:", roleError);
    }

    // 4. Map plan period to plano enum
    const planMapping: Record<number, string> = {
      1: "Mensal",
      3: "Trimestral",
      6: "Semestral",
      12: "Anual",
    };
    const planoEnum = planMapping[plan.period_months] || "Mensal";

    // 5. Calculate expiration date
    const now = new Date();
    const expirationDate = new Date(now);
    expirationDate.setMonth(expirationDate.getMonth() + plan.period_months);

    // 6. Update profile with subscription data (profiles is source of truth)
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        situacao: "Testando", // Will be updated to "Ativo" after payment
        plano: planoEnum,
        valor_pago: finalPrice,
        data_contratacao: now.toISOString(),
        data_vencimento: expirationDate.toISOString(),
        origem_cadastro: user_data.origem || "Website",
        cliente_ativo: true,
        contact_phone: user_data.telefone,
      })
      .eq("id", userId);

    if (profileUpdateError) {
      console.error("[Checkout] Profile update error:", profileUpdateError);
    }

    // 7. Create Mercado Pago preference
    const baseUrl = success_url?.split("/checkout")[0] || "https://iptvlink.com.br";

    // Configure payment methods based on selection
    let paymentMethods = {};
    if (payment_method) {
      const excludedTypes: string[] = [];
      if (payment_method === "pix") {
        excludedTypes.push("credit_card", "debit_card", "ticket");
      } else if (payment_method === "credit_card") {
        excludedTypes.push("debit_card", "bank_transfer", "ticket");
      } else if (payment_method === "debit_card") {
        excludedTypes.push("credit_card", "bank_transfer", "ticket");
      } else if (payment_method === "boleto") {
        excludedTypes.push("credit_card", "debit_card", "bank_transfer");
      }
      
      if (excludedTypes.length > 0) {
        paymentMethods = {
          excluded_payment_types: excludedTypes.map(t => ({ id: t })),
        };
      }
    }

    const preferenceData = {
      items: [
        {
          id: plan.id,
          title: `IPTV Link - ${plan.name}`,
          description: plan.description || `Assinatura ${plan.name}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(finalPrice),
        },
      ],
      payer: {
        email: user_data.email,
        name: user_data.nome,
        phone: {
          number: user_data.telefone.replace(/\D/g, ""),
        },
      },
      back_urls: {
        success: success_url || `${baseUrl}/checkout/success`,
        failure: failure_url || `${baseUrl}/checkout/failure`,
        pending: pending_url || `${baseUrl}/checkout/pending`,
      },
      auto_return: "approved",
      external_reference: `${userId}:${plan.id}:${userId}`,
      notification_url: `${supabaseUrl}/functions/v1/mercado-pago-webhook`,
      statement_descriptor: "IPTVLINK",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      ...paymentMethods,
    };

    console.log("[Checkout] Creating Mercado Pago preference...");

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
      console.error("[Checkout] Mercado Pago error:", errorData);
      return new Response(JSON.stringify({ error: "Erro ao criar pagamento" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const preference = await response.json();
    console.log("[Checkout] Preference created:", preference.id);

    // 8. Create payment record
    await supabase.from("payments").insert({
      user_id: userId,
      mercado_pago_preference_id: preference.id,
      amount: finalPrice,
      description: `Assinatura ${plan.name}`,
      external_reference: `${userId}:${plan.id}:${userId}`,
      status: "pending",
      payment_method: payment_method || null,
      payer_email: user_data.email,
      metadata: {
        plan_id: plan.id,
        plan_name: plan.name,
        period_months: plan.period_months,
        profile_id: userId,
        coupon_code: coupon_code || null,
        original_price: plan.price,
        discount: couponData ? plan.price - finalPrice : 0,
      },
    });

    // 9. Update coupon usage if applied
    if (couponData) {
      await supabase
        .from("discount_coupons")
        .update({ current_uses: couponData.current_uses + 1 })
        .eq("id", couponData.id);

      await supabase.from("coupon_usage").insert({
        coupon_id: couponData.id,
        client_id: userId, // Using profile id
        order_value: finalPrice,
        discount_applied: plan.price - finalPrice,
      });
    }

    // 10. Create user subscription record (pending)
    await supabase.from("user_subscriptions").insert({
      user_id: userId,
      plan_id: plan.id,
      status: "trial",
      current_period_start: now.toISOString(),
      current_period_end: expirationDate.toISOString(),
    });

    console.log("[Checkout] Registration and checkout complete for:", user_data.email);

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      profile_id: userId,
      preference_id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Checkout] Unexpected error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
