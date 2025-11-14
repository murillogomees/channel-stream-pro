import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schema for webhook payload
const webhookSchema = z.object({
  event: z.enum(['playlist.created', 'playlist.updated', 'playlist.deleted', 'playlist.error']),
  playlist_id: z.string().trim().max(255),
  mac: z.string().trim().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, "MAC address inválido"),
  status: z.enum(['active', 'inactive', 'error', 'pending']),
  error_message: z.string().max(1000).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  metadata: z.object({
    user_id: z.string().uuid().optional(),
    m3u_url: z.string().url().max(2048).optional(),
  }).catchall(z.any()).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[smartone-webhook] Webhook received');

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Only POST is accepted.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const WEBHOOK_SECRET = Deno.env.get('SMARTONE_WEBHOOK_SECRET');
    const body = await req.text();
    
    if (WEBHOOK_SECRET) {
      const signature = req.headers.get('x-smartone-signature');
      
      if (!signature) {
        console.error('[smartone-webhook] Missing signature');
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Missing signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(body + WEBHOOK_SECRET);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (signature !== expectedSignature) {
        console.error('[smartone-webhook] Invalid signature');
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.warn('[smartone-webhook] ⚠️ SMARTONE_WEBHOOK_SECRET not configured');
    }

    const rawPayload = JSON.parse(body);
    const payload = webhookSchema.parse(rawPayload);
    
    console.log('[smartone-webhook] Validated payload:', payload.event);

    await processWebhook(payload);

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed', event: payload.event }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[smartone-webhook] Error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Dados inválidos', details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processWebhook(payload: z.infer<typeof webhookSchema>) {
  console.log(`[smartone-webhook] Processing ${payload.event} for MAC: ${payload.mac}`);
  
  switch (payload.event) {
    case 'playlist.created':
      console.log(`[smartone-webhook] Playlist created: ${payload.playlist_id}`);
      break;
    case 'playlist.updated':
      console.log(`[smartone-webhook] Playlist updated: ${payload.playlist_id}`);
      break;
    case 'playlist.deleted':
      console.log(`[smartone-webhook] Playlist deleted: ${payload.playlist_id}`);
      break;
    case 'playlist.error':
      console.log(`[smartone-webhook] Playlist error: ${payload.error_message}`);
      break;
  }
}
