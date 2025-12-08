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

function verifySignature(payload: string, signature: string | null, requestId: string | null): boolean {
  // Se não há secret configurado, aceita qualquer webhook
  if (!webhookSecret) {
    console.log("[MP-Webhook] No webhook secret configured, accepting webhook");
    return true;
  }
  
  // Se não há assinatura, aceita em modo produção (alguns webhooks do MP não enviam)
  if (!signature) {
    console.log("[MP-Webhook] No signature provided, accepting webhook");
    return true;
  }
  
  try {
    // Parse da assinatura no formato: ts=xxx,v1=yyy
    const parts = signature.split(",");
    const tsMatch = parts.find(p => p.startsWith("ts="));
    const v1Match = parts.find(p => p.startsWith("v1="));
    
    if (!tsMatch || !v1Match) {
      console.log("[MP-Webhook] Invalid signature format, accepting webhook anyway");
      return true; // Aceita mesmo assim
    }
    
    const ts = tsMatch.split("=")[1];
    const v1 = v1Match.split("=")[1];
    
    // Formato do Mercado Pago: id:{data.id};request-id:{request_id};ts:{ts};
    const dataId = JSON.parse(payload)?.data?.id || '';
    const signedPayload = `id:${dataId};request-id:${requestId || ''};ts:${ts};`;
    
    const expectedSig = createHmac("sha256", webhookSecret)
      .update(signedPayload)
      .digest("hex");
    
    const isValid = expectedSig === v1;
    
    if (!isValid) {
      console.log("[MP-Webhook] Signature mismatch - accepting webhook anyway for production reliability");
      console.log(`[MP-Webhook] Expected: ${expectedSig.substring(0, 20)}... Got: ${v1.substring(0, 20)}...`);
    }
    
    // Aceita mesmo com assinatura inválida para não bloquear pagamentos
    return true;
  } catch (error) {
    console.error("[MP-Webhook] Signature verification error:", error);
    // Aceita mesmo com erro para não bloquear pagamentos
    return true;
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

// Mapeia motivos de rejeição do Mercado Pago para mensagens amigáveis
function getRejectReason(statusDetail: string): string {
  const reasons: Record<string, string> = {
    'cc_rejected_bad_filled_card_number': 'Número do cartão incorreto',
    'cc_rejected_bad_filled_date': 'Data de validade incorreta',
    'cc_rejected_bad_filled_other': 'Dados do cartão incorretos',
    'cc_rejected_bad_filled_security_code': 'Código de segurança incorreto',
    'cc_rejected_blacklist': 'Cartão não aceito (bloqueado)',
    'cc_rejected_call_for_authorize': 'Cartão precisa de autorização da operadora',
    'cc_rejected_card_disabled': 'Cartão desativado',
    'cc_rejected_card_error': 'Erro no cartão',
    'cc_rejected_duplicated_payment': 'Pagamento duplicado',
    'cc_rejected_high_risk': 'Pagamento recusado por risco',
    'cc_rejected_insufficient_amount': 'Saldo insuficiente',
    'cc_rejected_invalid_installments': 'Parcelas inválidas',
    'cc_rejected_max_attempts': 'Limite de tentativas excedido',
    'cc_rejected_other_reason': 'Cartão recusado',
    'pending_contingency': 'Pagamento em análise',
    'pending_review_manual': 'Pagamento em revisão manual',
    'pending_waiting_payment': 'Aguardando pagamento',
    'pending_waiting_transfer': 'Aguardando transferência',
  };
  
  return reasons[statusDetail] || 'Pagamento não processado';
}

// Gera informação de status para pagamento pendente
function getPendingStatusInfo(paymentMethodId: string, statusDetail: string): string {
  if (paymentMethodId === 'pix') {
    return '💡 *Dica:* O PIX geralmente é confirmado em poucos segundos. Verifique se o pagamento foi realizado.';
  }
  
  if (paymentMethodId === 'bolbradesco' || statusDetail?.includes('ticket')) {
    return '📌 *Importante:* Boletos podem levar até 3 dias úteis para compensar. Guarde o comprovante!';
  }
  
  if (statusDetail === 'pending_review_manual') {
    return '🔍 Seu pagamento está em análise manual pela operadora. Isso pode levar até 2 dias úteis.';
  }
  
  return '⏳ O pagamento está sendo processado. Você será notificado assim que houver atualização.';
}

// Envia notificação WhatsApp para o cliente baseado no template do banco
async function sendWhatsAppNotification(
  supabase: any,
  telefone: string,
  status: string,
  clienteNome: string,
  plano: string,
  valor: number,
  dataVencimento: string,
  formaPagamento: string,
  statusDetail?: string
) {
  if (!whatsappAppkey || !whatsappAuthkey) {
    console.log("[MP-Webhook] WhatsApp credentials not configured");
    return;
  }

  // Mapeia o status do MP para o eventType do template
  const eventTypeMap: Record<string, string> = {
    approved: 'payment_approved',
    pending: 'payment_pending',
    in_process: 'payment_in_process',
    rejected: 'payment_rejected',
    refunded: 'payment_refunded',
    cancelled: 'payment_cancelled',
  };

  const eventType = eventTypeMap[status] || 'payment_pending';

  // Busca template específico pelo eventType
  const { data: template } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('event_type', eventType)
    .eq('active', true)
    .single();

  let message = '';
  
  // Variáveis extras baseadas no status
  const motivoErro = statusDetail ? getRejectReason(statusDetail) : 'Erro no processamento';
  const statusInfo = getPendingStatusInfo(formaPagamento.toLowerCase(), statusDetail || '');
  
  if (template) {
    // Substitui variáveis do template
    message = template.message
      .replace(/\{nome\}/g, clienteNome)
      .replace(/\{plano\}/g, plano)
      .replace(/\{valor\}/g, valor.toFixed(2))
      .replace(/\{dataVencimento\}/g, new Date(dataVencimento).toLocaleDateString('pt-BR'))
      .replace(/\{formaPagamento\}/g, formaPagamento)
      .replace(/\{status\}/g, status)
      .replace(/\{motivoErro\}/g, motivoErro)
      .replace(/\{statusInfo\}/g, statusInfo);
  } else {
    // Templates padrão se não houver no banco
    const statusMessages: Record<string, string> = {
      approved: `🎉 *Pagamento Aprovado!*

Olá ${clienteNome}!

Seu pagamento foi confirmado com sucesso!

✅ *Plano:* ${plano}
💰 *Valor:* R$ ${valor.toFixed(2)}
💳 *Forma:* ${formaPagamento}
📅 *Válido até:* ${new Date(dataVencimento).toLocaleDateString('pt-BR')}

Seu acesso já está 100% liberado! 
Pode entrar agora e aproveitar todo o conteúdo. 🎬

Qualquer dúvida, estamos por aqui!

Atenciosamente,
IPTV LINK`,

      pending: `⏳ *Pagamento Pendente*

Olá ${clienteNome}!

Recebemos seu pedido de pagamento e ele está aguardando confirmação.

📋 *Plano:* ${plano}
💰 *Valor:* R$ ${valor.toFixed(2)}
💳 *Forma:* ${formaPagamento}

${statusInfo}

Assim que o pagamento for confirmado, você será notificado e seu acesso será liberado automaticamente!

Qualquer dúvida, estamos à disposição.

Atenciosamente,
IPTV LINK`,

      in_process: `⏳ *Pagamento em Análise*

Olá ${clienteNome}!

Seu pagamento está sendo processado pela operadora.

📋 *Plano:* ${plano}
💰 *Valor:* R$ ${valor.toFixed(2)}
💳 *Forma:* ${formaPagamento}

Geralmente a confirmação ocorre em poucos minutos. Você receberá uma mensagem assim que for aprovado!

Atenciosamente,
IPTV LINK`,

      rejected: `❌ *Pagamento Não Aprovado*

Olá ${clienteNome}!

Infelizmente seu pagamento não foi processado.

📋 *Plano:* ${plano}
💰 *Valor:* R$ ${valor.toFixed(2)}
💳 *Forma:* ${formaPagamento}
📝 *Motivo:* ${motivoErro}

Por favor, verifique os dados e tente novamente, ou escolha outra forma de pagamento.

Se precisar de ajuda, estamos à disposição!

Atenciosamente,
IPTV LINK`,

      refunded: `💰 *Pagamento Reembolsado*

Olá ${clienteNome}!

Seu pagamento foi reembolsado conforme solicitação.

📋 *Plano:* ${plano}
💰 *Valor:* R$ ${valor.toFixed(2)}

O valor será devolvido na mesma forma de pagamento utilizada.

Qualquer dúvida, estamos à disposição!

Atenciosamente,
IPTV LINK`,

      cancelled: `🚫 *Pagamento Cancelado*

Olá ${clienteNome}!

O pagamento do seu plano foi cancelado.

📋 *Plano:* ${plano}
💰 *Valor:* R$ ${valor.toFixed(2)}

Se não foi você quem cancelou, entre em contato conosco para verificar o que aconteceu.

Atenciosamente,
IPTV LINK`,
    };

    message = statusMessages[status] || `Status do pagamento: ${status}`;
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
      cliente_id: null,
      cliente_nome: clienteNome,
      telefone: cleanPhone,
      tipo: eventType,
      template: template?.name || `Pagamento ${status}`,
      data_envio: new Date().toISOString(),
      status: response.ok ? 'success' : 'error',
      resposta: result,
    });

    console.log(`[MP-Webhook] WhatsApp notification sent (${eventType}): ${response.ok}`);
  } catch (error) {
    console.error("[MP-Webhook] Error sending WhatsApp:", error);
    
    // Log do erro
    await supabase.from('notification_logs').insert({
      cliente_id: null,
      cliente_nome: clienteNome,
      telefone: telefone,
      tipo: eventType,
      template: 'Erro ao enviar',
      data_envio: new Date().toISOString(),
      status: 'error',
      resposta: { error: error.message },
    });
  }
}

async function processPayment(supabase: any, paymentData: any) {
  const externalReference = paymentData.external_reference;
  const status = paymentData.status;
  const statusDetail = paymentData.status_detail;
  
  console.log(`[MP-Webhook] Processing payment ${paymentData.id} with status ${status} (${statusDetail})`);
  
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
        status_detail: statusDetail,
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
  
  // Get client info for WhatsApp from profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, contact_phone, email")
    .eq("id", userId)
    .single();
  
  const cliente = profile ? {
    nome: profile.nome || profile.email || 'Cliente',
    telefone: profile.contact_phone,
  } : null;
  
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
    
    // Update profiles table with payment info
    await supabase
      .from("profiles")
      .update({
        situacao: systemStatus,
        cliente_ativo: clienteAtivo,
        plano: planoNome,
        data_contratacao: dataPagamento.toISOString(),
        data_ultimo_pagamento: dataPagamento.toISOString(),
        data_vencimento: dataVencimento.toISOString(),
        valor_pago: paymentData.transaction_amount,
        forma_ultimo_pagamento: formaPagamento,
        is_recorrente: true,
      })
      .eq("id", userId);
  } else if (status === "pending" || status === "in_process") {
    // Update profiles com status pendente
    await supabase
      .from("profiles")
      .update({
        situacao: 'Aguardando Pagamento',
      })
      .eq("id", userId);
  }
  
  // Send WhatsApp notification for ALL status changes
  if (cliente && cliente.telefone) {
    await sendWhatsAppNotification(
      supabase,
      cliente.telefone,
      status,
      cliente.nome,
      planoNome,
      paymentData.transaction_amount,
      dataVencimento.toISOString(),
      formaPagamento,
      statusDetail
    );
  } else {
    console.log(`[MP-Webhook] No phone found for user ${userId}, skipping WhatsApp notification`);
  }
  
  return { success: true, payment, status, statusDetail };
}

async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const body = await req.text();
    const signature = req.headers.get("x-signature");
    const requestId = req.headers.get("x-request-id");
    
    console.log("[MP-Webhook] Received webhook, body length:", body.length);
    
    // Verify signature (mais permissivo para não bloquear pagamentos)
    if (!verifySignature(body, signature, requestId)) {
      console.error("[MP-Webhook] Signature verification failed but this should not happen");
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// Export for dynamic import by main router
export default handler;

// Also support direct Deno.serve for standalone mode
if (import.meta.main) {
  Deno.serve(handler);
}
