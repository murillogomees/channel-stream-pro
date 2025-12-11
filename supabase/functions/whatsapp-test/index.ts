/**
 * WhatsApp Test Message Edge Function
 * Sends a test message using secrets stored in Supabase
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOTBOT_API_URL = 'https://botbot.chat/api/create-message';

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const appkey = Deno.env.get('WHATSAPP_APPKEY');
    const authkey = Deno.env.get('WHATSAPP_AUTHKEY');

    if (!appkey || !authkey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciais WhatsApp não configuradas nos secrets do Supabase' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone, message } = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Telefone e mensagem são obrigatórios' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    const formData = new FormData();
    formData.append('appkey', appkey);
    formData.append('authkey', authkey);
    formData.append('to', formattedPhone);
    formData.append('message', message);
    formData.append('typingDelay', '3');

    const response = await fetch(BOTBOT_API_URL, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error || 'Erro ao enviar mensagem',
          details: result
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem enviada com sucesso',
        result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[whatsapp-test] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

export { handler };

if (import.meta.main) {
  Deno.serve(handler);
}
