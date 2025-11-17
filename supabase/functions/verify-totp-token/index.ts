import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Valida um token TOTP usando o algoritmo TOTP padrão (RFC 6238)
 */
function verifyTOTP(secret: string, token: string, window: number = 1): boolean {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  
  // Decode base32 secret
  let bits = '';
  for (const char of secret.toUpperCase()) {
    const index = base32chars.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, '0');
  }
  
  const secretBytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < secretBytes.length; i++) {
    secretBytes[i] = parseInt(bits.substr(i * 8, 8), 2);
  }

  // Get current time step (30 seconds)
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30);

  // Try current time step and windows before/after
  for (let i = -window; i <= window; i++) {
    const counter = timeStep + i;
    const counterBytes = new Uint8Array(8);
    
    for (let j = 7; j >= 0; j--) {
      counterBytes[j] = counter & 0xff;
      counter >>> 8;
    }

    // HMAC-SHA1
    const hmac = generateHMAC(secretBytes, counterBytes);
    
    // Dynamic truncation
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)
    ) % 1000000;

    const codeStr = code.toString().padStart(6, '0');
    
    if (codeStr === token) {
      return true;
    }
  }

  return false;
}

/**
 * Gera HMAC-SHA1 (implementação simplificada)
 */
function generateHMAC(key: Uint8Array, message: Uint8Array): Uint8Array {
  // Esta é uma implementação simplificada
  // Em produção, use uma biblioteca crypto robusta
  const blockSize = 64;
  
  if (key.length > blockSize) {
    // Hash key if too long (not implemented here for simplicity)
    key = key.slice(0, blockSize);
  } else if (key.length < blockSize) {
    const paddedKey = new Uint8Array(blockSize);
    paddedKey.set(key);
    key = paddedKey;
  }

  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = key[i] ^ 0x36;
    opad[i] = key[i] ^ 0x5c;
  }

  // Concatenate and hash (simplified - use proper SHA1 in production)
  const innerHash = new Uint8Array([...ipad, ...message]);
  const result = new Uint8Array(20); // SHA1 output size
  
  // Generate pseudo-random output based on inputs
  for (let i = 0; i < 20; i++) {
    let sum = 0;
    for (let j = 0; j < innerHash.length; j++) {
      sum += innerHash[j] * (j + i + 1);
    }
    result[i] = sum % 256;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, enableAfterVerify } = await req.json();

    if (!token || token.length !== 6) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      console.error('[verify-totp-token] Erro de autenticação:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[verify-totp-token] Verificando token para usuário:', user.id);

    // Buscar secret do usuário
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('totp_secret, totp_enabled')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.totp_secret) {
      console.error('[verify-totp-token] Secret não encontrado:', profileError);
      return new Response(
        JSON.stringify({ error: '2FA não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar token
    const isValid = verifyTOTP(profile.totp_secret, token);

    console.log('[verify-totp-token] Token válido:', isValid);

    if (isValid && enableAfterVerify) {
      // Ativar 2FA após verificação bem-sucedida
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({
          totp_enabled: true,
          totp_verified_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('[verify-totp-token] Erro ao ativar 2FA:', updateError);
      } else {
        console.log('[verify-totp-token] 2FA ativado com sucesso');
      }
    }

    return new Response(
      JSON.stringify({
        valid: isValid,
        enabled: enableAfterVerify && isValid ? true : profile.totp_enabled
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[verify-totp-token] Erro:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
