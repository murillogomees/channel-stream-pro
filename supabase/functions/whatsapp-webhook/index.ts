import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppWebhookEvent {
  action?: string; // 'send_admin_alert'
  event?: string; // 'message_read', 'message_delivered', 'message_sent', 'message_failed', 'button_response'
  phone: string;
  message?: string;
  message_id?: string;
  timestamp?: string;
  status?: string;
  error?: string;
  button_id?: string; // 'investigate', 'resolve', 'escalate'
  delivery_id?: string;
  admin_phone_id?: string;
  notes?: string;
  metadata?: {
    delivery_id?: string;
    admin_phone_id?: string;
    security_event_id?: string;
    alert_type?: string;
    admin_name?: string;
    cliente_id?: string;
    cliente_nome?: string;
    timestamp?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validar webhook do WhatsApp (BotBot)
    const authHeader = req.headers.get('authorization');
    const webhookSecret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET');
    
    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      console.log('[WhatsAppWebhook] Unauthorized webhook attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event: WhatsAppWebhookEvent = await req.json();
    console.log('[WhatsAppWebhook] Received request:', JSON.stringify(event));

    // Se for uma ação de envio de alerta, processar separadamente
    if (event.action === 'send_admin_alert') {
      await handleSendAdminAlert(supabase, event);
      return new Response(
        JSON.stringify({ success: true, message: 'Alert sent' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar diferentes tipos de eventos de webhook
    switch (event.event) {
      case 'message_read':
        await handleMessageRead(supabase, event);
        break;
      case 'message_delivered':
        await handleMessageDelivered(supabase, event);
        break;
      case 'message_failed':
        await handleMessageFailed(supabase, event);
        break;
      case 'button_response':
        await handleButtonResponse(supabase, event);
        break;
      default:
        console.log('[WhatsAppWebhook] Unhandled event type:', event.event);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[WhatsAppWebhook] Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleMessageRead(supabase: any, event: WhatsAppWebhookEvent) {
  console.log('[WhatsAppWebhook] Processing message read event');

  // Buscar delivery pelo telefone e evento recente
  const { data: deliveries, error: fetchError } = await supabase
    .from('security_alert_deliveries')
    .select(`
      id,
      security_event_id,
      admin_phone_id,
      admin_phones!inner(phone)
    `)
    .eq('admin_phones.phone', event.phone)
    .is('confirmed_at', null)
    .order('sent_at', { ascending: false })
    .limit(1);

  if (fetchError) {
    console.error('[WhatsAppWebhook] Error fetching deliveries:', fetchError);
    return;
  }

  if (!deliveries || deliveries.length === 0) {
    console.log('[WhatsAppWebhook] No pending delivery found for phone:', event.phone);
    return;
  }

  const delivery = deliveries[0];

  // Atualizar status para confirmado
  const { error: updateError } = await supabase
    .from('security_alert_deliveries')
    .update({
      confirmed_at: new Date().toISOString(),
      delivery_status: 'confirmed'
    })
    .eq('id', delivery.id);

  if (updateError) {
    console.error('[WhatsAppWebhook] Error updating delivery:', updateError);
    return;
  }

  console.log(`[WhatsAppWebhook] Delivery ${delivery.id} marked as confirmed via read receipt`);
}

async function handleMessageDelivered(supabase: any, event: WhatsAppWebhookEvent) {
  console.log('[WhatsAppWebhook] Processing message delivered event');

  // Buscar delivery pelo telefone
  const { data: deliveries, error: fetchError } = await supabase
    .from('security_alert_deliveries')
    .select(`
      id,
      admin_phones!inner(phone)
    `)
    .eq('admin_phones.phone', event.phone)
    .eq('delivery_status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1);

  if (fetchError || !deliveries || deliveries.length === 0) {
    console.log('[WhatsAppWebhook] No delivery found for delivered message');
    return;
  }

  // Atualizar status para entregue (mas não lido ainda)
  const { error: updateError } = await supabase
    .from('security_alert_deliveries')
    .update({
      delivery_status: 'delivered'
    })
    .eq('id', deliveries[0].id);

  if (updateError) {
    console.error('[WhatsAppWebhook] Error updating delivery status:', updateError);
    return;
  }

  console.log(`[WhatsAppWebhook] Delivery ${deliveries[0].id} marked as delivered`);
}

async function handleMessageFailed(supabase: any, event: WhatsAppWebhookEvent) {
  console.log('[WhatsAppWebhook] Processing message failed event');

  // Buscar delivery pelo telefone
  const { data: deliveries, error: fetchError } = await supabase
    .from('security_alert_deliveries')
    .select(`
      id,
      admin_phones!inner(phone)
    `)
    .eq('admin_phones.phone', event.phone)
    .order('sent_at', { ascending: false })
    .limit(1);

  if (fetchError || !deliveries || deliveries.length === 0) {
    console.log('[WhatsAppWebhook] No delivery found for failed message');
    return;
  }

  // Atualizar status para falho
  const { error: updateError } = await supabase
    .from('security_alert_deliveries')
    .update({
      delivery_status: 'failed',
      error_message: event.error || 'Message delivery failed'
    })
    .eq('id', deliveries[0].id);

  if (updateError) {
    console.error('[WhatsAppWebhook] Error updating delivery status:', updateError);
    return;
  }

  console.log(`[WhatsAppWebhook] Delivery ${deliveries[0].id} marked as failed`);
}

async function handleSendAdminAlert(supabase: any, event: WhatsAppWebhookEvent) {
  console.log('[WhatsAppWebhook] Sending admin alert via WhatsApp');

  const WHATSAPP_APPKEY = Deno.env.get('WHATSAPP_APPKEY');
  const WHATSAPP_AUTHKEY = Deno.env.get('WHATSAPP_AUTHKEY');

  if (!WHATSAPP_APPKEY || !WHATSAPP_AUTHKEY) {
    console.error('[WhatsAppWebhook] Missing WhatsApp credentials');
    throw new Error('WhatsApp credentials not configured');
  }

  if (!event.phone || !event.message) {
    console.error('[WhatsAppWebhook] Missing phone or message in request');
    throw new Error('Phone and message are required');
  }

  try {
    // Enviar mensagem via BotBot API
    const formData = new FormData();
    formData.append('appkey', WHATSAPP_APPKEY);
    formData.append('authkey', WHATSAPP_AUTHKEY);
    formData.append('to', event.phone);
    formData.append('message', event.message);
    formData.append('typingDelay', '3');

    const response = await fetch('https://botbot.chat/api/create-message', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[WhatsAppWebhook] BotBot API error:', errorText);
      throw new Error(`BotBot API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('[WhatsAppWebhook] Message sent successfully:', result);

    return result;
  } catch (error) {
    console.error('[WhatsAppWebhook] Error sending WhatsApp message:', error);
    throw error;
  }
}

