import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://sdvyxdghxqmntyoweqbd.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-smartone-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    // Rate limiting: 100 requests per minute per IP (webhooks can be frequent)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const windowStart = new Date();
    windowStart.setSeconds(0, 0);
    
    const { data: existing } = await supabaseService
      .from('rate_limit_tracking')
      .select('request_count')
      .eq('identifier', clientIp)
      .eq('endpoint', 'smartone-webhook')
      .gte('window_start', windowStart.toISOString())
      .maybeSingle();

    const currentCount = existing?.request_count || 0;
    const rateLimit = 100;

    if (currentCount >= rateLimit) {
      console.warn(`[smartone-webhook] Rate limit exceeded for IP: ${clientIp.substring(0, 8)}...`);
      return new Response(
        JSON.stringify({ 
          error: 'Taxa de requisições excedida',
          retryAfter: 60 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '60'
          } 
        }
      );
    }

    await supabaseService
      .from('rate_limit_tracking')
      .upsert({
        identifier: clientIp,
        endpoint: 'smartone-webhook',
        request_count: currentCount + 1,
        window_start: windowStart.toISOString()
      }, {
        onConflict: 'identifier,endpoint,window_start'
      });

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
  // Hash MAC address for logging
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(payload.mac));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const macHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 8);
  
  console.log(`[smartone-webhook] Processing ${payload.event} for MAC hash: ${macHash}`);
  
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
