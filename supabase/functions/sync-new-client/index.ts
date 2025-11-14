import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClientData {
  user_id: string;
  cliente_id: string;
  nome: string;
  telefone: string;
  email: string;
  mac_smart_one?: string;
  usuario_m3u?: string;
  senha_m3u?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const smartoneApiBase = Deno.env.get('SMARTONE_API_BASE_URL')!;
    const smartoneClientApi = Deno.env.get('SMARTONE_CLIENT_API')!;
    const smartoneKeyApi = Deno.env.get('SMARTONE_KEY_API')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { user_id, cliente_id, nome, telefone, email, mac_smart_one, usuario_m3u, senha_m3u } = await req.json() as ClientData;

    console.log('Starting SmartOne sync for client:', { user_id, cliente_id, nome });

    // Se não tiver MAC address, não podemos sincronizar ainda
    if (!mac_smart_one) {
      console.log('No MAC address provided, skipping SmartOne sync');
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'MAC address required for SmartOne sync' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Buscar lista M3U padrão
    const { data: defaultM3U, error: m3uError } = await supabase
      .from('m3u_lists')
      .select('file_url')
      .eq('is_default', true)
      .eq('status', 'active')
      .single();

    if (m3uError || !defaultM3U) {
      console.error('Error fetching default M3U:', m3uError);
      throw new Error('Lista M3U padrão não encontrada');
    }

    // Preparar dados para SmartOne
    const smartonePayload = {
      client_api: smartoneClientApi,
      key_api: smartoneKeyApi,
      mac: mac_smart_one,
      name: nome,
      email: email,
      phone: telefone,
      playlist_url: defaultM3U.file_url,
      username: usuario_m3u || `user_${Date.now()}`,
      password: senha_m3u || Math.random().toString(36).slice(-8),
    };

    console.log('Sending request to SmartOne API...');

    // Fazer requisição para SmartOne
    const smartoneResponse = await fetch(`${smartoneApiBase}/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(smartonePayload),
    });

    const smartoneData = await smartoneResponse.json();
    console.log('SmartOne API response:', smartoneData);

    // Atualizar status do cliente no banco
    let updateData: any = {
      smartone_last_sync_at: new Date().toISOString(),
      smartone_raw_response: JSON.stringify(smartoneData),
    };

    if (smartoneResponse.ok && smartoneData.success) {
      updateData.smartone_status = 'criado';
      updateData.smartone_playlist_id = smartoneData.playlist_id || null;
      
      // Atualizar usuário e senha se foram gerados
      if (smartonePayload.username && !usuario_m3u) {
        updateData.usuario_m3u = smartonePayload.username;
      }
      if (smartonePayload.password && !senha_m3u) {
        updateData.senha_m3u = smartonePayload.password;
      }
    } else {
      updateData.smartone_status = 'erro';
    }

    const { error: updateError } = await supabase
      .from('clientes')
      .update(updateData)
      .eq('id', cliente_id);

    if (updateError) {
      console.error('Error updating client:', updateError);
      throw updateError;
    }

    console.log('Client sync completed successfully');

    // Enviar notificação WhatsApp se sincronização bem-sucedida
    if (smartoneResponse.ok && smartoneData.success) {
      try {
        const whatsappAuthKey = Deno.env.get('WHATSAPP_AUTHKEY');
        const whatsappAppKey = Deno.env.get('WHATSAPP_APPKEY');

        if (whatsappAuthKey && whatsappAppKey) {
          const mensagem = `🎉 *Ativação Confirmada!*

Olá ${nome}! Seu acesso ao SmartOne IPTV foi ativado com sucesso!

📺 *Suas Credenciais:*
• Usuário: ${smartonePayload.username}
• Senha: ${smartonePayload.password}
• MAC: ${mac_smart_one}

✅ Seu SmartOne já está configurado e pronto para uso!

📱 Qualquer dúvida, estamos à disposição!`;

          const whatsappPayload = {
            authkey: whatsappAuthKey,
            appkey: whatsappAppKey,
            to: telefone.replace(/\D/g, ''),
            message: mensagem,
          };

          await fetch('https://api.textmebot.com/send.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(whatsappPayload),
          });

          console.log('WhatsApp notification sent successfully');
        }
      } catch (whatsappError) {
        console.error('Error sending WhatsApp notification:', whatsappError);
        // Não falha a sincronização se WhatsApp falhar
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      smartone_status: smartoneResponse.ok ? 'criado' : 'erro',
      smartone_data: smartoneData,
      credentials: {
        username: smartonePayload.username,
        password: smartonePayload.password,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in sync-new-client function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
