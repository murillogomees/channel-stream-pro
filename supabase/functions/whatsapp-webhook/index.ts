import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface WhatsAppWebhookEvent {
  action?: string;
  event?: string;
  phone: string;
  message?: string;
  message_id?: string;
  timestamp?: string;
  status?: string;
  error?: string;
  button_id?: string;
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

async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ✅ SECURITY: Validate webhook with HMAC signature
    const webhookSecret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET');
    
    if (webhookSecret) {
      const signature = req.headers.get('x-webhook-signature');
      const authHeader = req.headers.get('authorization');
      
      let isAuthenticated = false;
      
      if (signature) {
        const rawBody = await req.clone().text();
        const encoder = new TextEncoder();
        const keyData = encoder.encode(webhookSecret);
        const messageData = encoder.encode(rawBody);
        
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        
        const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
        const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        isAuthenticated = signature === expectedSignature;
      } else if (authHeader === `Bearer ${webhookSecret}`) {
        isAuthenticated = true;
      }
      
      if (!isAuthenticated) {
        console.log('[WhatsAppWebhook] Invalid signature or token');
        return new Response(
          JSON.stringify({ error: 'Unauthorized - Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const event: WhatsAppWebhookEvent = await req.json();
    console.log('[WhatsAppWebhook] Received request:', JSON.stringify(event));

    if (event.action === 'send_admin_alert') {
      await handleSendAdminAlert(event);
      return new Response(
        JSON.stringify({ success: true, message: 'Alert sent' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
}

async function handleMessageRead(supabase: any, event: WhatsAppWebhookEvent) {
  console.log('[WhatsAppWebhook] Processing message read event');

  const { data: deliveries, error: fetchError } = await supabase
    .from('security_alert_deliveries')
    .select(`id, security_event_id, admin_phone_id, admin_phones!inner(phone)`)
    .eq('admin_phones.phone', event.phone)
    .is('confirmed_at', null)
    .order('sent_at', { ascending: false })
    .limit(1);

  if (fetchError || !deliveries?.length) {
    console.log('[WhatsAppWebhook] No pending delivery found for phone:', event.phone);
    return;
  }

  const { error: updateError } = await supabase
    .from('security_alert_deliveries')
    .update({ confirmed_at: new Date().toISOString(), delivery_status: 'confirmed' })
    .eq('id', deliveries[0].id);

  if (updateError) {
    console.error('[WhatsAppWebhook] Error updating delivery:', updateError);
  } else {
    console.log(`[WhatsAppWebhook] Delivery ${deliveries[0].id} marked as confirmed`);
  }
}

async function handleMessageDelivered(supabase: any, event: WhatsAppWebhookEvent) {
  console.log('[WhatsAppWebhook] Processing message delivered event');

  const { data: deliveries } = await supabase
    .from('security_alert_deliveries')
    .select(`id, admin_phones!inner(phone)`)
    .eq('admin_phones.phone', event.phone)
    .eq('delivery_status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1);

  if (!deliveries?.length) return;

  await supabase
    .from('security_alert_deliveries')
    .update({ delivery_status: 'delivered' })
    .eq('id', deliveries[0].id);

  console.log(`[WhatsAppWebhook] Delivery ${deliveries[0].id} marked as delivered`);
}

async function handleMessageFailed(supabase: any, event: WhatsAppWebhookEvent) {
  console.log('[WhatsAppWebhook] Processing message failed event');

  const { data: deliveries } = await supabase
    .from('security_alert_deliveries')
    .select(`id, admin_phones!inner(phone)`)
    .eq('admin_phones.phone', event.phone)
    .order('sent_at', { ascending: false })
    .limit(1);

  if (!deliveries?.length) return;

  await supabase
    .from('security_alert_deliveries')
    .update({ delivery_status: 'failed', error_message: event.error || 'Message delivery failed' })
    .eq('id', deliveries[0].id);

  console.log(`[WhatsAppWebhook] Delivery ${deliveries[0].id} marked as failed`);
}

async function handleButtonResponse(supabase: any, event: WhatsAppWebhookEvent) {
  console.log('[WhatsAppWebhook] Processing button response:', event.button_id);
  // Button response handling logic here
}

async function handleSendAdminAlert(event: WhatsAppWebhookEvent) {
  console.log('[WhatsAppWebhook] Sending admin alert via WhatsApp');

  const WHATSAPP_APPKEY = Deno.env.get('WHATSAPP_APPKEY');
  const WHATSAPP_AUTHKEY = Deno.env.get('WHATSAPP_AUTHKEY');

  if (!WHATSAPP_APPKEY || !WHATSAPP_AUTHKEY) {
    throw new Error('WhatsApp credentials not configured');
  }

  if (!event.phone || !event.message) {
    throw new Error('Phone and message are required');
  }

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
    throw new Error(`BotBot API error: ${response.status}`);
  }

  console.log('[WhatsAppWebhook] Message sent successfully');
}

// Export for dynamic import by main router
export default handler;

// Also support direct Deno.serve for standalone mode
if (import.meta.main) {
  Deno.serve(handler);
}
