import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://sdvyxdghxqmntyoweqbd.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Gera um secret TOTP aleatório para autenticação de dois fatores
 */
function generateTOTPSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // Base32
  let secret = '';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  
  for (let i = 0; i < 32; i++) {
    secret += chars[array[i] % chars.length];
  }
  
  return secret;
}

/**
 * Gera URI otpauth para QR code
 */
function generateOTPAuthURL(secret: string, email: string, issuer: string = 'IPTV LINK'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('[generate-totp-secret] Erro de autenticação:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[generate-totp-secret] Gerando secret para usuário:', user.id);

    // Gerar secret TOTP
    const secret = generateTOTPSecret();
    
    // Buscar email do perfil
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[generate-totp-secret] Erro ao buscar perfil:', profileError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar perfil do usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const email = profile.email || user.email;
    
    // Gerar URL para QR code
    const otpAuthURL = generateOTPAuthURL(secret, email);

    // Salvar secret no perfil (ainda não verificado)
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        totp_secret: secret,
        totp_enabled: false, // Só ativa após verificação
        totp_verified_at: null
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[generate-totp-secret] Erro ao salvar secret:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar configuração 2FA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[generate-totp-secret] Secret gerado com sucesso');

    return new Response(
      JSON.stringify({
        secret,
        otpAuthURL,
        email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-totp-secret] Erro:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
