import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://sdvyxdghxqmntyoweqbd.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Hash password using SHA-1 for HIBP API
async function sha1Hash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Check password against HIBP using k-anonymity
async function checkPasswordCompromised(password: string): Promise<boolean> {
  try {
    const hash = await sha1Hash(password);
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    console.log(`[HIBP] Checking password hash prefix: ${prefix}`);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'User-Agent': 'Supabase-Edge-Function' }
    });

    if (!response.ok) {
      console.error(`[HIBP] API error: ${response.status}`);
      return false; // Fail open - don't block if API is down
    }

    const text = await response.text();
    const hashes = text.split('\n');
    
    for (const line of hashes) {
      const [hashSuffix] = line.split(':');
      if (hashSuffix === suffix) {
        console.log('[HIBP] Password found in breach database');
        return true;
      }
    }

    console.log('[HIBP] Password is safe');
    return false;
  } catch (error) {
    console.error('[HIBP] Error checking password:', error);
    return false; // Fail open
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Create service client for security checks
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
        { endpoint: 'validate-password-signup', reason: 'blocked_ip' }
      );

      return new Response(
        JSON.stringify({ error: 'Acesso negado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 5 requests per minute per IP (strict to prevent brute force)

    const windowStart = new Date();
    windowStart.setSeconds(0, 0);
    
    const { data: existing } = await supabaseService
      .from('rate_limit_tracking')
      .select('request_count')
      .eq('identifier', clientIp)
      .eq('endpoint', 'validate-password-signup')
      .gte('window_start', windowStart.toISOString())
      .maybeSingle();

    const currentCount = existing?.request_count || 0;
    const rateLimit = 5;

    if (currentCount >= rateLimit) {
      console.warn(`[Auth] Rate limit exceeded for IP: ${clientIp.substring(0, 8)}...`);
      return new Response(
        JSON.stringify({ 
          error: 'Muitas tentativas de cadastro. Tente novamente em alguns minutos.',
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
        endpoint: 'validate-password-signup',
        request_count: currentCount + 1,
        window_start: windowStart.toISOString()
      }, {
        onConflict: 'identifier,endpoint,window_start'
      });

    const { email, password, nome, telefone } = await req.json();

    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email e senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check password strength
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter no mínimo 8 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if password is compromised
    const isCompromised = await checkPasswordCompromised(password);
    if (isCompromised) {
      console.log('[Auth] Blocking compromised password');
      return new Response(
        JSON.stringify({ 
          error: 'Esta senha foi encontrada em vazamentos de dados. Por favor, escolha uma senha diferente.',
          code: 'auth/compromised_password'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome: nome || email,
        telefone: telefone || null
      }
    });

    if (authError) {
      console.error('[Auth] Error creating user:', authError.message);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Auth] User created successfully: ${authData.user.id}`);

    // Sign in the user to get session
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (sessionError) {
      console.error('[Auth] Error creating session:', sessionError.message);
      return new Response(
        JSON.stringify({ error: sessionError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        user: authData.user,
        session: sessionData.session,
        message: 'Cadastro realizado com sucesso!'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Auth] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao processar cadastro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
