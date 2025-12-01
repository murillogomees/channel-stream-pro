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
const whatsappAppkey = Deno.env.get("WHATSAPP_APPKEY");
const whatsappAuthkey = Deno.env.get("WHATSAPP_AUTHKEY");

function verifySignature(payload: string, signature: string | null): boolean {
  if (!webhookSecret || !signature) {
    console.log("[MP-Webhook] No secret configured or no signature provided, skipping verification");
    return true;
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

// Mapeia payment_method_id do Mercado Pago para formas de pagamento do sistema
function mapPaymentMethod(paymentMethodId: string, paymentTypeId: string): string {
  const methodMap: Record<string, string> = {
    'pix': 'PIX',
    'bolbradesco': 'Boleto',
    'account_money': 'Saldo Mercado Pago',
    'credit_card': 'Cartão de Crédito',
    'debit_card': 'Cartão de Débito',
    'bank_transfer': 'TED',
  };
  
  // Tenta mapear pelo payment_method_id específico
  if (methodMap[paymentMethodId]) {
    return methodMap[paymentMethodId];
  }
  
  // Fallback para payment_type_id
  if (paymentTypeId === 'credit_card') return 'Cartão de Crédito';
  if (paymentTypeId === 'debit_card') return 'Cartão de Débito';
  if (paymentTypeId === 'ticket') return 'Boleto';
  if (paymentTypeId === 'bank_transfer') return 'TED';
  
  return paymentMethodId || 'Outro';
}

// Mapeia status do Mercado Pago para status do sistema
function mapPaymentStatus(mpStatus: string): { systemStatus: string; clienteAtivo: boolean } {
  const statusMap: Record<string, { systemStatus: string; clienteAtivo: boolean }> = {
    approved: { systemStatus: 'Ativo', clienteAtivo: true },
    pending: { systemStatus: 'Testando', clienteAtivo: false },
    in_process: { systemStatus: 'Testando', clienteAtivo: false },
    rejected: { systemStatus: 'Inativo', clienteAtivo: false },
    refunded: { systemStatus: 'Inativo', clienteAtivo: false },
    cancelled: { systemStatus: 'Inativo', clienteAtivo: false },
  };
  
  return statusMap[mpStatus] || { systemStatus: 'Inativo', clienteAtivo: false };
}

// Envia notificação WhatsApp para o cliente
async function sendWhatsAppNotification(
  supabase: any,
  telefone: string,
  status: string,
  clienteNome: string,
  plano: string,
  valor: number,
  dataVencimento: string,
  formaPagamento: string
) {
  if (!whatsappAppkey || !whatsappAuthkey) {
    console.log("[MP-Webhook] WhatsApp credentials not configured");
    return;
  }

  // Busca template específico para o status
  const { data: template } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('event_type', 'mercado_pago_status')
    .eq('active', true)
    .ilike('name', `%${status}%`)
    .single();

  let message = '';
  
  if (template) {
    // Substitui variáveis do template
    message = template.message
      .replace(/\{\{nome\}\}/g, clienteNome)
      .replace(/\{\{plano\}\}/g, plano)
      .replace(/\{\{valor\}\}/g, `R$ ${valor.toFixed(2)}`)
      .replace(/\{\{dataVencimento\}\}/g, new Date(dataVencimento).toLocaleDateString('pt-BR'))
      .replace(/\{\{formaPagamento\}\}/g, formaPagamento)
      .replace(/\{\{status\}\}/g, status);
  } else {
    // Template padrão se não houver específico
    const statusMessages: Record<string, string> = {
      approved: `🎉 *Pagamento Aprovado!*\n\nOlá ${clienteNome}!\n\nSeu pagamento de *R$ ${valor.toFixed(2)}* foi aprovado!\n\n✅ Plano: ${plano}\n💳 Forma: ${formaPagamento}\n📅 Válido até: ${new Date(dataVencimento).toLocaleDateString('pt-BR')}\n\nSeu acesso já está ativo! Aproveite! 🎬`,
      pending: `⏳ *Pagamento Pendente*\n\nOlá ${clienteNome}!\n\nSeu pagamento de *R$ ${valor.toFixed(2)}* está em análise.\n\n📋 Plano: ${plano}\n💳 Forma: ${formaPagamento}\n\nAssim que for aprovado, você será notificado!`,
      in_process: `⏳ *Pagamento em Processamento*\n\nOlá ${clienteNome}!\n\nSeu pagamento de *R$ ${valor.toFixed(2)}* está sendo processado.\n\n📋 Plano: ${plano}\n💳 Forma: ${formaPagamento}\n\nEm breve você receberá a confirmação!`,
      rejected: `❌ *Pagamento Recusado*\n\nOlá ${clienteNome}!\n\nInfelizmente seu pagamento de *R$ ${valor.toFixed(2)}* foi recusado.\n\n📋 Plano: ${plano}\n💳 Forma: ${formaPagamento}\n\nPor favor, tente novamente ou entre em contato conosco!`,
      refunded: `💰 *Pagamento Reembolsado*\n\nOlá ${clienteNome}!\n\nSeu pagamento de *R$ ${valor.toFixed(2)}* foi reembolsado.\n\n📋 Plano: ${plano}\n\nQualquer dúvida, estamos à disposição!`,
      cancelled: `🚫 *Pagamento Cancelado*\n\nOlá ${clienteNome}!\n\nSeu pagamento de *R$ ${valor.toFixed(2)}* foi cancelado.\n\n📋 Plano: ${plano}\n\nSe precisar de ajuda, entre em contato conosco!`,
    };

    message = statusMessages[status] || `Status: ${status}`;
  }

  try {
    // Remove caracteres especiais do telefone
    const cleanPhone = telefone.replace(/\D/g, '');
    
    const response = await fetch('https://api.botbot.com.br/waboxapp/send-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appkey: whatsappAppkey,
        authkey: whatsappAuthkey,
        to: cleanPhone,
        message: message,
        priority: 1,
      }),
    });

    const result = await response.json();
    
    // Log da notificação
    await supabase.from('notification_logs').insert({
      cliente_id: null, // Será preenchido depois se necessário
      cliente_nome: clienteNome,
      telefone: cleanPhone,
      tipo: `mercado_pago_${status}`,
      template: template?.name || 'Template Padrão',
      data_envio: new Date().toISOString(),
      status: response.ok ? 'success' : 'error',
      resposta: result,
    });

    console.log(`[MP-Webhook] WhatsApp notification sent: ${response.ok}`);
  } catch (error) {
    console.error("[MP-Webhook] Error sending WhatsApp:", error);
  }
}

async function processPayment(supabase: any, paymentData: any) {
  const externalReference = paymentData.external_reference;
  const status = paymentData.status;
  
  console.log(`[MP-Webhook] Processing payment ${paymentData.id} with status ${status}`);
  
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
  
  // Get plan details
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .single();
  
  // Calculate period based on plan duration
  let periodDays = 30; // Default monthly
  let planoNome = 'Mensal';
  
  if (plan) {
    periodDays = plan.period_months * 30;
    planoNome = plan.name;
  }
  
  const dataPagamento = new Date();
  const dataVencimento = new Date();
  dataVencimento.setDate(dataVencimento.getDate() + periodDays);
  
  // Map payment method
  const formaPagamento = mapPaymentMethod(
    paymentData.payment_method_id,
    paymentData.payment_type_id
  );
  
  // Map status
  const { systemStatus, clienteAtivo } = mapPaymentStatus(status);
  
  // Get client info for WhatsApp
  const { data: cliente } = await supabase
    .from("clientes")
    .select("nome, telefone")
    .eq("user_id", userId)
    .single();
  
  // Update subscription based on status
  if (status === "approved") {
    // Upsert subscription
    const { error: subError } = await supabase
      .from("user_subscriptions")
      .upsert({
        user_id: userId,
        plan_id: planId,
        status: "active",
        current_period_start: dataPagamento.toISOString(),
        current_period_end: dataVencimento.toISOString(),
        cancel_at_period_end: false,
        trial_end: null,
      }, {
        onConflict: "user_id",
      });
    
    if (subError) {
      console.error("[MP-Webhook] Subscription update error:", subError);
    } else {
      console.log(`[MP-Webhook] Subscription activated for user ${userId}`);
    }
    
    // Update user role
    await supabase
      .from("user_roles")
      .upsert({
        user_id: userId,
        role: "client",
      }, {
        onConflict: "user_id,role",
      });
  }
  
  // Update clientes table with all payment info
  await supabase
    .from("clientes")
    .update({
      situacao: systemStatus,
      cliente_ativo: clienteAtivo,
      plano: planoNome,
      data_contratacao: status === "approved" ? dataPagamento.toISOString() : undefined,
      data_ultimo_pagamento: status === "approved" ? dataPagamento.toISOString() : undefined,
      data_vencimento: status === "approved" ? dataVencimento.toISOString() : undefined,
      valor_pago: paymentData.transaction_amount,
      forma_ultimo_pagamento: formaPagamento,
      is_recorrente: status === "approved",
    })
    .eq("user_id", userId);
  
  // Send WhatsApp notification
  if (cliente) {
    await sendWhatsAppNotification(
      supabase,
      cliente.telefone,
      status,
      cliente.nome,
      planoNome,
      paymentData.transaction_amount,
      dataVencimento.toISOString(),
      formaPagamento
    );
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
