import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const clientSchema = z.object({
  user_id: z.string().uuid(),
  cliente_id: z.string().uuid(),
  nome: z.string().trim().min(2).max(200),
  telefone: z.string().trim().regex(/^\+?[1-9]\d{1,14}$/),
  email: z.string().trim().email().max(255),
  mac_smart_one: z.string().trim().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).optional(),
  usuario_m3u: z.string().trim().max(100).optional(),
  senha_m3u: z.string().trim().max(100).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação e permissão de admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Cliente para verificar autenticação
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é admin
    const { data: isAdmin, error: roleError } = await supabaseAuth
      .rpc('is_admin', { _user_id: user.id });

    if (roleError || !isAdmin) {
      console.error('[sync-new-client] Permission denied for user:', user.id);
      return new Response(
        JSON.stringify({ error: 'Permissão negada. Apenas administradores.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 30 requests per minute per user (higher for admins)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const windowStart = new Date();
    windowStart.setSeconds(0, 0);
    
    const { data: existing } = await supabase
      .from('rate_limit_tracking')
      .select('request_count')
      .eq('identifier', user.id)
      .eq('endpoint', 'sync-new-client')
      .gte('window_start', windowStart.toISOString())
      .maybeSingle();

    const currentCount = existing?.request_count || 0;
    const rateLimit = 30;

    if (currentCount >= rateLimit) {
      console.warn(`[sync-new-client] Rate limit exceeded for user: ${user.id}`);
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

    await supabase
      .from('rate_limit_tracking')
      .upsert({
        identifier: user.id,
        endpoint: 'sync-new-client',
        request_count: currentCount + 1,
        window_start: windowStart.toISOString()
      }, {
        onConflict: 'identifier,endpoint,window_start'
      });

    const smartoneApiBase = Deno.env.get('SMARTONE_API_BASE_URL')!;
    const smartoneClientApi = Deno.env.get('SMARTONE_CLIENT_API')!;
    const smartoneKeyApi = Deno.env.get('SMARTONE_KEY_API')!;
    
    const body = await req.json();
    const validated = clientSchema.parse(body);
    const { user_id, cliente_id, nome, telefone, email, mac_smart_one, usuario_m3u, senha_m3u } = validated;

    console.log('[sync-new-client] Starting:', { user_id, cliente_id, nome });

    if (!mac_smart_one) {
      console.log('[sync-new-client] No MAC, skipping');
      return new Response(JSON.stringify({ success: false, message: 'MAC required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { data: defaultM3U, error: m3uError } = await supabase
      .from('m3u_lists')
      .select('file_url')
      .eq('is_default', true)
      .eq('status', 'active')
      .single();

    if (m3uError || !defaultM3U) {
      console.error('[sync-new-client] M3U error:', m3uError);
      throw new Error('Lista M3U não encontrada');
    }

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

    console.log('[sync-new-client] Calling SmartOne');

    const smartoneResponse = await fetch(`${smartoneApiBase}/create-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(smartonePayload),
    });

    const smartoneData = await smartoneResponse.json();
    console.log('[sync-new-client] SmartOne response:', { ok: smartoneResponse.ok });

    let updateData: any = {
      smartone_last_sync_at: new Date().toISOString(),
      smartone_raw_response: JSON.stringify(smartoneData),
    };

    if (smartoneResponse.ok && smartoneData.success) {
      updateData.smartone_status = 'criado';
      updateData.smartone_playlist_id = smartoneData.playlist_id || null;
      
      if (smartonePayload.username && !usuario_m3u) updateData.usuario_m3u = smartonePayload.username;
      if (smartonePayload.password && !senha_m3u) updateData.senha_m3u = smartonePayload.password;
    } else {
      updateData.smartone_status = 'erro';
    }

    const { error: updateError } = await supabase
      .from('clientes')
      .update(updateData)
      .eq('id', cliente_id);

    if (updateError) {
      console.error('[sync-new-client] Update error:', updateError);
      throw updateError;
    }

    console.log('[sync-new-client] Success');

    if (smartoneResponse.ok && smartoneData.success) {
      try {
        const whatsappAuthKey = Deno.env.get('WHATSAPP_AUTHKEY');
        const whatsappAppKey = Deno.env.get('WHATSAPP_APPKEY');

        if (whatsappAuthKey && whatsappAppKey) {
          const mensagem = `🎉 *Ativação Confirmada!*

Olá ${nome}! Seu acesso ao SmartOne IPTV foi ativado!

📺 *Suas Credenciais:*
• Usuário: ${smartonePayload.username}
• Senha: ${smartonePayload.password}
• MAC: ${mac_smart_one}

✅ Seu SmartOne está pronto para uso!`;

          await fetch('https://api.textmebot.com/send.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              authkey: whatsappAuthKey,
              appkey: whatsappAppKey,
              to: telefone.replace(/\D/g, ''),
              message: mensagem,
            }),
          });

          console.log('[sync-new-client] WhatsApp sent');
        }
      } catch (whatsappError) {
        console.error('[sync-new-client] WhatsApp error:', whatsappError);
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
    console.error('[sync-new-client] Error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ success: false, error: 'Dados inválidos', details: error.errors.map(e => e.message) }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
