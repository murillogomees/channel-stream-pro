import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Helper to log security events
async function logSecurityEvent(
  supabase: any,
  eventType: string,
  severity: string,
  ipAddress: string,
  details: any
) {
  try {
    await supabase.from('security_events').insert({
      event_type: eventType,
      severity,
      ip_address: ipAddress,
      event_details: details
    });
  } catch (error) {
    console.error('[Security] Failed to log event:', error);
  }
}

// Helper to check if IP is blocked
async function checkIPBlocked(supabase: any, ipAddress: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('ip_blacklist')
      .select('id')
      .eq('ip_address', ipAddress)
      .is('unblocked_at', null)
      .or('expires_at.is.null,expires_at.gt.now()')
      .maybeSingle();

    return !error && !!data;
  } catch {
    return false;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const prospectSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(200, "Nome muito longo"),
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  celular: z.string().trim().regex(/^\+?[1-9]\d{1,14}$/, "Formato de telefone inválido"),
  mac: z.string().trim().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, "MAC address inválido"),
});

const adminPhoneSchema = z.object({
  phone: z.string().trim().regex(/^\+?[1-9]\d{1,14}$/),
  name: z.string().trim().min(1).max(100),
});

const requestSchema = z.object({
  prospectData: prospectSchema,
  adminPhones: z.array(adminPhoneSchema).max(10, "Máximo 10 administradores"),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestId = crypto.randomUUID();
    console.log(`[notify-prospect] Request ID: ${requestId}`);

    // Get client IP
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if IP is blocked
    const isBlocked = await checkIPBlocked(supabaseService, clientIp);
    if (isBlocked) {
      await logSecurityEvent(
        supabaseService,
        'unauthorized_access',
        'warning',
        clientIp,
        { endpoint: 'notify-prospect', reason: 'blocked_ip', requestId }
      );

      return new Response(
        JSON.stringify({ error: 'Acesso negado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 10 requests per minute per IP

    const windowStart = new Date();
    windowStart.setSeconds(0, 0); // Start of current minute
    
    const { data: existing, error: rateLimitError } = await supabaseService
      .from('rate_limit_tracking')
      .select('request_count')
      .eq('identifier', clientIp)
      .eq('endpoint', 'notify-prospect')
      .gte('window_start', windowStart.toISOString())
      .maybeSingle();

    if (rateLimitError) {
      console.error('[notify-prospect] Rate limit check error:', rateLimitError);
    }

    const currentCount = existing?.request_count || 0;
    const rateLimit = 10; // requests per minute

    if (currentCount >= rateLimit) {
      console.warn(`[notify-prospect] Rate limit exceeded for IP: ${clientIp.substring(0, 8)}...`);
      return new Response(
        JSON.stringify({ 
          error: 'Taxa de requisições excedida. Tente novamente em alguns minutos.',
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

    // Update rate limit counter
    await supabaseService
      .from('rate_limit_tracking')
      .upsert({
        identifier: clientIp,
        endpoint: 'notify-prospect',
        request_count: currentCount + 1,
        window_start: windowStart.toISOString()
      }, {
        onConflict: 'identifier,endpoint,window_start'
      });

    // Validate input
    const body = await req.json();
    const validated = requestSchema.parse(body);
    const { prospectData, adminPhones } = validated;

    // Get WhatsApp credentials from environment (not from client!)
    const whatsappAppkey = Deno.env.get('WHATSAPP_APPKEY');
    const whatsappAuthkey = Deno.env.get('WHATSAPP_AUTHKEY');

    if (!whatsappAppkey || !whatsappAuthkey) {
      console.error('[notify-prospect] WhatsApp credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Configuração do WhatsApp não disponível' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toLocaleString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    // Mensagem de boas-vindas ao prospecto
    const welcomeMessage = `🎉 *Olá, ${prospectData.nome}!*

Obrigado por se cadastrar na IPTV LINK!

Recebemos seus dados e em breve nossa equipe entrará em contato com você para concluir sua ativação.

📺 *Prepare-se para ter acesso a:*
• Mais de 10.000 canais em Full HD e 4K
• Filmes e séries ilimitados
• Suporte técnico dedicado

Aguarde nosso contato! 🚀`;

    // Mensagem para os administradores
    const adminMessage = `🔔 *NOVO CADASTRO NO TUTORIAL*

📅 *Data/Hora:* ${now}

👤 *Dados do Prospecto:*
• *Nome:* ${prospectData.nome}
• *Email:* ${prospectData.email}
• *WhatsApp:* ${prospectData.celular}
• *MAC Address:* ${prospectData.mac}

Entre em contato com o cliente para concluir o processo! 📞`;

    const results = [];

    // Enviar mensagem de boas-vindas ao prospecto
    try {
      const welcomeResponse = await fetch('https://api.botbot.com.br/waboxapp/api/send/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appkey: whatsappAppkey,
          authkey: whatsappAuthkey,
          to: prospectData.celular,
          message: welcomeMessage,
          typing_time: 2000,
        }),
      });

      const welcomeData = await welcomeResponse.json();
      results.push({
        type: 'welcome',
        to: prospectData.celular,
        status: welcomeResponse.ok ? 'success' : 'error',
        response: welcomeData,
      });
      console.log(`[notify-prospect] Welcome message status: ${welcomeResponse.ok ? 'success' : 'failed'}`);
    } catch (error) {
      console.error('[notify-prospect] Error sending welcome message:', error);
      results.push({
        type: 'welcome',
        to: prospectData.celular,
        status: 'error',
        error: error.message,
      });
    }

    // Enviar notificações para os administradores
    for (const admin of adminPhones) {
      try {
        const adminResponse = await fetch('https://api.botbot.com.br/waboxapp/api/send/text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appkey: whatsappAppkey,
            authkey: whatsappAuthkey,
            to: admin.phone,
            message: adminMessage,
            typing_time: 2000,
          }),
        });

        const adminData = await adminResponse.json();
        results.push({
          type: 'admin_notification',
          to: admin.phone,
          name: admin.name,
          status: adminResponse.ok ? 'success' : 'error',
          response: adminData,
        });
        console.log(`[notify-prospect] Admin notification status: ${adminResponse.ok ? 'success' : 'failed'}`);
      } catch (error) {
        console.error(`[notify-prospect] Error notifying admin:`, error.message);
        results.push({
          type: 'admin_notification',
          to: admin.phone,
          name: admin.name,
          status: 'error',
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notificações enviadas',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[notify-prospect] Error:', error);
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: 'Dados inválidos',
          details: error.errors.map(e => e.message)
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
