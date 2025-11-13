import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SmartOneWebhookPayload {
  event: 'playlist.created' | 'playlist.updated' | 'playlist.deleted' | 'playlist.error';
  playlist_id: string;
  mac: string;
  status: 'active' | 'inactive' | 'error' | 'pending';
  error_message?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: {
    user_id?: string;
    m3u_url?: string;
    [key: string]: any;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('SmartOne webhook received');

    // Validar método HTTP
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Only POST is accepted.' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Buscar chave de webhook dos secrets
    const WEBHOOK_SECRET = Deno.env.get('SMARTONE_WEBHOOK_SECRET');
    
    // Validar assinatura do webhook se configurada
    if (WEBHOOK_SECRET) {
      const signature = req.headers.get('x-smartone-signature');
      
      if (!signature) {
        console.error('Missing webhook signature');
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Missing signature' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Validar assinatura
      const body = await req.text();
      const encoder = new TextEncoder();
      const data = encoder.encode(body + WEBHOOK_SECRET);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Invalid signature' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Parse payload novamente (já lemos como texto para validar)
      const payload: SmartOneWebhookPayload = JSON.parse(body);
      
      console.log('Webhook payload:', JSON.stringify(payload, null, 2));

      // Processar o webhook de acordo com o tipo de evento
      await processWebhook(payload);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook processed successfully',
          event: payload.event 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      // Sem validação de assinatura (modo de desenvolvimento)
      console.warn('⚠️ SMARTONE_WEBHOOK_SECRET not configured - webhook validation disabled');
      
      const payload: SmartOneWebhookPayload = await req.json();
      
      console.log('Webhook payload (no validation):', JSON.stringify(payload, null, 2));

      await processWebhook(payload);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook processed successfully (no validation)',
          event: payload.event 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error: any) {
    console.error('Error in smartone-webhook function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function processWebhook(payload: SmartOneWebhookPayload) {
  console.log(`Processing webhook event: ${payload.event}`);
  
  // Aqui você pode adicionar lógica para:
  // 1. Atualizar o status do cliente no localStorage/banco de dados
  // 2. Enviar notificações para administradores
  // 3. Registrar logs do evento
  // 4. Disparar outras ações baseadas no evento

  switch (payload.event) {
    case 'playlist.created':
      console.log(`✅ Playlist ${payload.playlist_id} created for MAC ${payload.mac}`);
      // Atualizar status do cliente para 'criado'
      await updateClientStatus(payload.mac, 'criado', payload.playlist_id);
      break;

    case 'playlist.updated':
      console.log(`🔄 Playlist ${payload.playlist_id} updated for MAC ${payload.mac}`);
      // Atualizar timestamp de última sincronização
      await updateClientStatus(payload.mac, 'criado', payload.playlist_id);
      break;

    case 'playlist.deleted':
      console.log(`🗑️ Playlist ${payload.playlist_id} deleted for MAC ${payload.mac}`);
      // Marcar cliente como não enviado
      await updateClientStatus(payload.mac, 'nao_enviado', null);
      break;

    case 'playlist.error':
      console.error(`❌ Playlist error for MAC ${payload.mac}: ${payload.error_message}`);
      // Atualizar status para erro
      await updateClientStatus(payload.mac, 'erro', null, payload.error_message);
      break;

    default:
      console.warn(`Unknown event type: ${payload.event}`);
  }
}

async function updateClientStatus(
  mac: string, 
  status: string, 
  playlistId: string | null,
  errorMessage?: string
) {
  // Esta função seria responsável por atualizar o cliente
  // Como estamos usando localStorage no frontend, você poderia:
  // 1. Armazenar os webhooks em uma tabela do Supabase
  // 2. O frontend consulta essa tabela periodicamente
  // 3. Ou usar Supabase Realtime para notificar mudanças
  
  console.log('Client status update:', {
    mac,
    status,
    playlistId,
    errorMessage,
    timestamp: new Date().toISOString()
  });

  // Por enquanto, apenas logamos. Você pode implementar:
  // - Gravar em tabela do Supabase
  // - Enviar para um serviço de notificação
  // - Broadcast via Supabase Realtime
}
