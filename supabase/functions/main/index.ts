import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

/**
 * Main Edge Function Router
 * 
 * Routes requests to the appropriate edge function based on URL path.
 * For self-hosted Supabase with --main-service configuration.
 * 
 * Version: 2.4.0 - Added rate limiting and brute force protection
 */

// Global configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://supabase.iptvlink.com.br';
const SELFHOSTED_URL = 'https://supabase.iptvlink.com.br';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-custom-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Expected path: /functions/v1/{function-name} or /{function-name}
  let functionName = '';
  
  if (pathParts[0] === 'functions' && pathParts[1] === 'v1') {
    functionName = pathParts[2] || '';
  } else {
    functionName = pathParts[0] || '';
  }

  console.log(`[Router] Path: ${url.pathname}, Function: ${functionName}`);

  // Health check for root or empty function name
  if (!functionName || functionName === 'main' || functionName === 'health-check') {
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '2.3.0',
        message: 'Edge Functions Router Active'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Route to inline handlers for critical functions
  try {
    switch (functionName) {
      case 'custom-auth':
        return await handleCustomAuth(req);
      
      case 'fetch-m3u':
        return await handleFetchM3U(req);
      
      case 'admin-data':
        return await handleAdminData(req);
      
      case 'coolify-api':
        return await handleCoolifyApi(req);
      
      case 'remote-command':
        return await handleRemoteCommand(req);
      
      case 'process-m3u-import':
        return await handleProcessM3UImport(req);
      
      case 'iptv-admin':
        return await handleIptvAdmin(req);
      
      case 'iptv-play':
        return await handleIptvPlay(req);
      
      default:
        // For other functions, return not implemented
        return new Response(
          JSON.stringify({ 
            error: `Function '${functionName}' not implemented in router`,
            hint: 'This function needs to be added to the main router or called directly'
          }),
          { 
            status: 501, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }
  } catch (error) {
    console.error(`[Router] Error in function ${functionName}:`, error);
    return new Response(
      JSON.stringify({ 
        error: (error as Error).message,
        function: functionName,
        stack: (error as Error).stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// ============================================================================
// CUSTOM-AUTH HANDLER - Complete authentication implementation
// With Rate Limiting, Brute Force Protection, Refresh Token Rotation
// ============================================================================

// Rate limit configuration per action
const RATE_LIMITS = {
  login: { limit: 5, windowSeconds: 60 },      // 5 attempts per minute
  signup: { limit: 3, windowSeconds: 300 },    // 3 signups per 5 minutes
  refresh: { limit: 10, windowSeconds: 60 },   // 10 refreshes per minute
  default: { limit: 30, windowSeconds: 60 },   // 30 requests per minute
};

// Brute force thresholds
const BRUTE_FORCE_THRESHOLDS = {
  warnThreshold: 5,      // Log warning after 5 failed attempts
  blockThreshold: 10,    // Auto-block after 10 failed attempts
  hardBlockThreshold: 20, // Extended block after 20 attempts
};

async function handleCustomAuth(req: Request): Promise<Response> {
  const { encode } = await import("https://deno.land/std@0.168.0/encoding/base64.ts");
  
  function base64UrlEncode(data: Uint8Array): string {
    return encode(data)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  function stringToUint8Array(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  async function createJWT(payload: object, secret: string): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    
    const encodedHeader = base64UrlEncode(stringToUint8Array(JSON.stringify(header)));
    const encodedPayload = base64UrlEncode(stringToUint8Array(JSON.stringify(payload)));
    
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    const key = await crypto.subtle.importKey(
      'raw',
      stringToUint8Array(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      stringToUint8Array(signatureInput)
    );
    
    const encodedSignature = base64UrlEncode(new Uint8Array(signature));
    
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  // Hash a token for storage (we never store raw tokens)
  async function hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Check rate limit for an action
  async function checkRateLimit(
    client: any, 
    identifier: string, 
    action: string
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const config = RATE_LIMITS[action as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;
    const windowStart = new Date(Date.now() - config.windowSeconds * 1000);
    
    try {
      // Count requests in current window
      const countResult = await client.queryObject(`
        SELECT COALESCE(SUM(request_count), 0) as total
        FROM public.rate_limit_tracking
        WHERE identifier = $1 AND identifier_type = 'combined'
          AND window_start > $2
      `, [identifier, windowStart.toISOString()]);
      
      const currentCount = parseInt((countResult.rows[0] as any)?.total || '0');
      
      // Record this request
      await client.queryObject(`
        INSERT INTO public.rate_limit_tracking (identifier, identifier_type, request_count, window_start, window_duration_seconds)
        VALUES ($1, 'combined', 1, NOW(), $2)
        ON CONFLICT (identifier, identifier_type, window_start) 
        DO UPDATE SET request_count = rate_limit_tracking.request_count + 1, last_request_at = NOW()
      `, [identifier, config.windowSeconds]);
      
      return {
        allowed: currentCount < config.limit,
        remaining: Math.max(0, config.limit - currentCount - 1),
        resetAt: new Date(Date.now() + config.windowSeconds * 1000),
      };
    } catch (e) {
      console.error('[CustomAuth] Rate limit check error:', e);
      // Fail open - allow request if rate limit check fails
      return { allowed: true, remaining: config.limit, resetAt: new Date() };
    }
  }

  // Check if identifier is blocked (brute force protection)
  async function isBlocked(client: any, identifier: string): Promise<boolean> {
    try {
      const result = await client.queryObject(`
        SELECT id FROM public.ip_blacklist
        WHERE ip_address = $1
          AND unblocked_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
      `, [identifier]);
      
      return result.rows.length > 0;
    } catch (e) {
      console.error('[CustomAuth] Block check error:', e);
      return false; // Fail open
    }
  }

  // Count recent failed attempts
  async function countFailedAttempts(client: any, identifier: string): Promise<number> {
    try {
      const result = await client.queryObject(`
        SELECT COUNT(*) as count
        FROM public.security_events
        WHERE (ip_address = $1 OR event_details->>'email' = $1)
          AND event_type = 'failed_login'
          AND created_at > NOW() - INTERVAL '15 minutes'
      `, [identifier]);
      
      return parseInt((result.rows[0] as any)?.count || '0');
    } catch (e) {
      return 0;
    }
  }

  // Log failed attempt and potentially auto-block
  async function logFailedAttempt(
    client: any, 
    email: string, 
    ipAddress: string,
    reason: string
  ): Promise<void> {
    try {
      // Log the failed attempt
      await client.queryObject(`
        INSERT INTO public.security_events (event_type, event_details, ip_address, severity)
        VALUES ('failed_login', $1, $2, 'medium')
      `, [JSON.stringify({ email, reason }), ipAddress]);
      
      // Count total failed attempts for this IP
      const failedCount = await countFailedAttempts(client, ipAddress);
      
      console.log(`[CustomAuth] Failed attempts for ${ipAddress}: ${failedCount}`);
      
      // Check if we should auto-block
      if (failedCount >= BRUTE_FORCE_THRESHOLDS.hardBlockThreshold) {
        await autoBlock(client, ipAddress, failedCount, 'brute_force_hard');
      } else if (failedCount >= BRUTE_FORCE_THRESHOLDS.blockThreshold) {
        await autoBlock(client, ipAddress, failedCount, 'brute_force');
      } else if (failedCount >= BRUTE_FORCE_THRESHOLDS.warnThreshold) {
        console.warn(`[CustomAuth] WARNING: Multiple failed attempts from ${ipAddress}`);
      }
    } catch (e) {
      console.error('[CustomAuth] Failed to log attempt:', e);
    }
  }

  // Auto-block an IP
  async function autoBlock(
    client: any, 
    ipAddress: string, 
    failedAttempts: number, 
    reason: string
  ): Promise<void> {
    try {
      // Determine block duration
      let blockDuration: string;
      let severity: string;
      
      if (failedAttempts >= 50) {
        blockDuration = '7 days';
        severity = 'critical';
      } else if (failedAttempts >= 20) {
        blockDuration = '24 hours';
        severity = 'high';
      } else if (failedAttempts >= 10) {
        blockDuration = '1 hour';
        severity = 'medium';
      } else {
        blockDuration = '15 minutes';
        severity = 'low';
      }
      
      await client.queryObject(`
        INSERT INTO public.ip_blacklist (ip_address, reason, auto_blocked, failed_attempts, last_attempt_at, expires_at, severity)
        VALUES ($1, $2, true, $3, NOW(), NOW() + $4::INTERVAL, $5)
        ON CONFLICT (ip_address) DO UPDATE SET
          failed_attempts = EXCLUDED.failed_attempts,
          last_attempt_at = NOW(),
          expires_at = NOW() + $4::INTERVAL,
          severity = EXCLUDED.severity
      `, [ipAddress, reason, failedAttempts, blockDuration, severity]);
      
      console.log(`[CustomAuth] Auto-blocked ${ipAddress} for ${blockDuration} (${reason})`);
    } catch (e) {
      console.error('[CustomAuth] Auto-block error:', e);
    }
  }

  // Store refresh token with rotation support
  async function storeRefreshToken(
    client: any,
    userId: string,
    tokenHash: string,
    familyId: string,
    ipAddress: string,
    userAgent: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      await client.queryObject(`
        INSERT INTO public.refresh_tokens (user_id, token_hash, family_id, expires_at, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [userId, tokenHash, familyId, expiresAt.toISOString(), ipAddress, userAgent]);
    } catch (e) {
      console.error('[CustomAuth] Store refresh token error:', e);
    }
  }

  // Validate and rotate refresh token
  async function validateRefreshToken(
    client: any,
    tokenHash: string
  ): Promise<{ valid: boolean; userId?: string; familyId?: string; reason?: string }> {
    try {
      const result = await client.queryObject(`
        SELECT id, user_id, family_id, is_revoked, expires_at
        FROM public.refresh_tokens
        WHERE token_hash = $1
      `, [tokenHash]);
      
      if (result.rows.length === 0) {
        return { valid: false, reason: 'Token not found' };
      }
      
      const token = result.rows[0] as any;
      
      if (token.is_revoked) {
        // Token reuse detected! Revoke entire family
        console.warn(`[CustomAuth] TOKEN REUSE DETECTED! Revoking family ${token.family_id}`);
        
        await client.queryObject(`
          UPDATE public.refresh_tokens
          SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'token_reuse_detected'
          WHERE family_id = $1 AND is_revoked = false
        `, [token.family_id]);
        
        // Log security event
        await client.queryObject(`
          INSERT INTO public.security_events (event_type, event_details, user_id, severity)
          VALUES ('token_reuse_detected', $1, $2, 'critical')
        `, [JSON.stringify({ family_id: token.family_id }), token.user_id]);
        
        return { valid: false, reason: 'Token reuse detected - all sessions revoked' };
      }
      
      if (new Date(token.expires_at) < new Date()) {
        return { valid: false, reason: 'Token expired' };
      }
      
      // Revoke current token (rotation)
      await client.queryObject(`
        UPDATE public.refresh_tokens
        SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'rotated'
        WHERE id = $1
      `, [token.id]);
      
      return { valid: true, userId: token.user_id, familyId: token.family_id };
    } catch (e) {
      console.error('[CustomAuth] Validate refresh token error:', e);
      return { valid: false, reason: 'Validation error' };
    }
  }

  // Create or update session
  async function createSession(
    client: any,
    userId: string,
    sessionToken: string,
    ipAddress: string,
    userAgent: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      // Check active session count
      const countResult = await client.queryObject(`
        SELECT COUNT(*) as count FROM public.user_sessions
        WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
      `, [userId]);
      
      const activeCount = parseInt((countResult.rows[0] as any)?.count || '0');
      
      // If too many active sessions, deactivate oldest
      if (activeCount >= 5) {
        await client.queryObject(`
          UPDATE public.user_sessions
          SET is_active = false
          WHERE id = (
            SELECT id FROM public.user_sessions
            WHERE user_id = $1 AND is_active = true
            ORDER BY created_at ASC
            LIMIT 1
          )
        `, [userId]);
      }
      
      // Create new session
      await client.queryObject(`
        INSERT INTO public.user_sessions (user_id, session_token, ip_address, user_agent, expires_at, device_info)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [userId, sessionToken, ipAddress, userAgent, expiresAt.toISOString(), JSON.stringify({ userAgent })]);
    } catch (e) {
      console.error('[CustomAuth] Create session error:', e);
    }
  }

  try {
    const { action, email, password, userData, refreshToken: providedRefreshToken } = await req.json();
    
    const dbUrl = Deno.env.get('SELFHOSTED_DB_URL');
    const jwtSecret = Deno.env.get('JWT_SECRET') || 'super-secret-jwt-token-with-at-least-32-characters-long';
    
    console.log('[CustomAuth] Action:', action, 'Email:', email);
    console.log('[CustomAuth] DB URL configured:', !!dbUrl);
    
    if (!dbUrl) {
      throw new Error('SELFHOSTED_DB_URL not configured');
    }

    const dbUrlMatch = dbUrl.match(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/([^?]+)/);
    
    if (!dbUrlMatch) {
      console.error('[CustomAuth] Failed to parse DB URL');
      throw new Error('Invalid database URL format');
    }

    const [, dbUser, dbPassword, dbHost, dbPortStr, dbName] = dbUrlMatch;
    const dbPort = dbPortStr ? parseInt(dbPortStr) : 5432;
    
    console.log('[CustomAuth] Connecting to DB:', dbHost, dbPort, dbName);
    
    const postgres = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
    const { Client } = postgres;
    
    const client = new Client({
      user: dbUser,
      password: dbPassword,
      hostname: dbHost,
      port: dbPort,
      database: dbName,
    });
    
    await client.connect();
    console.log('[CustomAuth] Database connected');
    
    // Get IP and user agent for tracking
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    try {
      if (action === 'login') {
        console.log(`[CustomAuth] Login attempt for: ${email} from IP: ${ipAddress}`);
        
        // Check if IP is blocked
        if (await isBlocked(client, ipAddress)) {
          console.warn(`[CustomAuth] Blocked IP attempted login: ${ipAddress}`);
          return new Response(JSON.stringify({ 
            error: 'Too many failed attempts. Please try again later.',
            blocked: true
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Check rate limit
        const rateLimit = await checkRateLimit(client, `${ipAddress}:${email}`, 'login');
        if (!rateLimit.allowed) {
          console.warn(`[CustomAuth] Rate limit exceeded for: ${ipAddress}:${email}`);
          return new Response(JSON.stringify({ 
            error: 'Too many login attempts. Please wait before trying again.',
            retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
          }), {
            status: 429,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000))
            }
          });
        }
        
        const authResult = await client.queryObject(`
          SELECT id, email, email_confirmed_at, raw_user_meta_data,
                 (encrypted_password = crypt($2, encrypted_password)) as password_valid
          FROM auth.users 
          WHERE email = $1
        `, [email.toLowerCase(), password]);
        
        if (authResult.rows.length === 0) {
          console.log('[CustomAuth] User not found:', email);
          await logFailedAttempt(client, email, ipAddress, 'user_not_found');
          return new Response(JSON.stringify({ 
            error: 'Invalid login credentials'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const user = authResult.rows[0] as any;
        
        if (!user.password_valid) {
          console.log('[CustomAuth] Invalid password for:', email);
          await logFailedAttempt(client, email, ipAddress, 'invalid_password');
          return new Response(JSON.stringify({ 
            error: 'Invalid login credentials'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const roleResult = await client.queryObject(`
          SELECT role FROM public.user_roles WHERE user_id = $1
        `, [user.id]);
        
        const role = roleResult.rows.length > 0 ? (roleResult.rows[0] as any).role : 'client';
        
        const profileResult = await client.queryObject(`
          SELECT * FROM public.profiles WHERE id = $1
        `, [user.id]);
        
        const profile = profileResult.rows.length > 0 ? profileResult.rows[0] : null;
        
        const now = Math.floor(Date.now() / 1000);
        const accessExpiresIn = 3600; // 1 hour for access token
        const refreshExpiresIn = 3600 * 24 * 30; // 30 days for refresh token
        
        const sessionId = crypto.randomUUID();
        const familyId = crypto.randomUUID(); // New token family for this login
        
        const accessToken = await createJWT({
          aud: 'authenticated',
          exp: now + accessExpiresIn,
          iat: now,
          iss: SUPABASE_URL + '/auth/v1',
          sub: user.id,
          email: user.email,
          phone: '',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: user.raw_user_meta_data || {},
          role: 'authenticated',
          aal: 'aal1',
          amr: [{ method: 'password', timestamp: now }],
          session_id: sessionId,
          app_role: role
        }, jwtSecret);
        
        // Create refresh token with family ID for rotation
        const refreshTokenPayload = {
          sub: user.id,
          type: 'refresh',
          family_id: familyId,
          iat: now,
          exp: now + refreshExpiresIn,
        };
        const refreshToken = await createJWT(refreshTokenPayload, jwtSecret);
        
        // Store refresh token hash for rotation tracking
        const refreshTokenHash = await hashToken(refreshToken);
        await storeRefreshToken(
          client, 
          user.id, 
          refreshTokenHash, 
          familyId, 
          ipAddress, 
          userAgent,
          new Date(Date.now() + refreshExpiresIn * 1000)
        );
        
        // Create session
        await createSession(
          client,
          user.id,
          sessionId,
          ipAddress,
          userAgent,
          new Date(Date.now() + refreshExpiresIn * 1000)
        );
        
        // Log successful login
        try {
          await client.queryObject(`
            INSERT INTO public.auth_sessions_log (user_id, user_email, event_type, ip_address, user_agent)
            VALUES ($1, $2, 'login', $3, $4)
          `, [user.id, user.email, ipAddress, userAgent]);
        } catch (e) {
          console.log('[CustomAuth] Could not log login:', e);
        }
        
        console.log(`[CustomAuth] Login successful for: ${email}, role: ${role}, session: ${sessionId}`);
        
        return new Response(JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'bearer',
          expires_in: accessExpiresIn,
          refresh_expires_in: refreshExpiresIn,
          user: {
            id: user.id,
            email: user.email,
            role: role,
            email_confirmed_at: user.email_confirmed_at,
            user_metadata: user.raw_user_meta_data || {},
            profile: profile
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'signup') {
        console.log(`[CustomAuth] Signup attempt for: ${email} from IP: ${ipAddress}`);
        
        // Check rate limit for signup
        const rateLimit = await checkRateLimit(client, ipAddress, 'signup');
        if (!rateLimit.allowed) {
          console.warn(`[CustomAuth] Signup rate limit exceeded for: ${ipAddress}`);
          return new Response(JSON.stringify({ 
            error: 'Too many signup attempts. Please wait before trying again.',
            retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
          }), {
            status: 429,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000))
            }
          });
        }
        
        const existingUser = await client.queryObject(`
          SELECT id FROM auth.users WHERE email = $1
        `, [email.toLowerCase()]);
        
        if (existingUser.rows.length > 0) {
          return new Response(JSON.stringify({ 
            error: 'User already registered' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const userId = crypto.randomUUID();
        const nowDate = new Date().toISOString();
        
        await client.queryObject(`
          INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, 
            email_confirmed_at, created_at, updated_at,
            raw_user_meta_data, raw_app_meta_data,
            aud, role, confirmation_token
          ) VALUES (
            $1, '00000000-0000-0000-0000-000000000000', $2, crypt($3, gen_salt('bf', 6)),
            $4, $4, $4,
            $5, '{"provider": "email", "providers": ["email"]}',
            'authenticated', 'authenticated', ''
          )
        `, [userId, email.toLowerCase(), password, nowDate, JSON.stringify(userData || {})]);
        
        await client.queryObject(`
          INSERT INTO auth.identities (
            id, user_id, provider_id, provider, identity_data, 
            last_sign_in_at, created_at, updated_at
          ) VALUES (
            $1, $1, $2, 'email', $3, $4, $4, $4
          )
        `, [userId, email.toLowerCase(), JSON.stringify({ sub: userId, email: email.toLowerCase() }), nowDate]);
        
        await client.queryObject(`
          INSERT INTO public.profiles (id, email, nome, contact_phone, origem_cadastro, data_vencimento, situacao, cliente_ativo)
          VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '3 days', 'Testando', true)
          ON CONFLICT (id) DO NOTHING
        `, [userId, email.toLowerCase(), userData?.nome || email.split('@')[0], userData?.telefone || null, userData?.origem_cadastro || 'Website']);
        
        await client.queryObject(`
          INSERT INTO public.user_roles (user_id, role)
          VALUES ($1, 'client')
          ON CONFLICT (user_id, role) DO NOTHING
        `, [userId]);
        
        const nowTs = Math.floor(Date.now() / 1000);
        const accessExpiresIn = 3600; // 1 hour
        const refreshExpiresIn = 3600 * 24 * 30; // 30 days
        const sessionId = crypto.randomUUID();
        const familyId = crypto.randomUUID();
        
        const accessToken = await createJWT({
          aud: 'authenticated',
          exp: nowTs + accessExpiresIn,
          iat: nowTs,
          iss: SUPABASE_URL + '/auth/v1',
          sub: userId,
          email: email.toLowerCase(),
          phone: '',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: userData || {},
          role: 'authenticated',
          aal: 'aal1',
          amr: [{ method: 'password', timestamp: nowTs }],
          session_id: sessionId,
          app_role: 'client'
        }, jwtSecret);
        
        const refreshToken = await createJWT({
          sub: userId,
          type: 'refresh',
          family_id: familyId,
          iat: nowTs,
          exp: nowTs + refreshExpiresIn,
        }, jwtSecret);
        
        // Store refresh token hash
        const refreshTokenHash = await hashToken(refreshToken);
        await storeRefreshToken(
          client, 
          userId, 
          refreshTokenHash, 
          familyId, 
          ipAddress, 
          userAgent,
          new Date(Date.now() + refreshExpiresIn * 1000)
        );
        
        // Create session
        await createSession(
          client,
          userId,
          sessionId,
          ipAddress,
          userAgent,
          new Date(Date.now() + refreshExpiresIn * 1000)
        );
        
        console.log(`[CustomAuth] Signup successful for: ${email}`);
        
        return new Response(JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'bearer',
          expires_in: accessExpiresIn,
          refresh_expires_in: refreshExpiresIn,
          user: {
            id: userId,
            email: email.toLowerCase(),
            role: 'client'
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'refresh') {
        // Rate limit refresh requests
        const rateLimit = await checkRateLimit(client, ipAddress, 'refresh');
        if (!rateLimit.allowed) {
          return new Response(JSON.stringify({ 
            error: 'Too many refresh attempts',
            retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Get refresh token from body or authorization header
        const token = providedRefreshToken || req.headers.get('authorization')?.replace('Bearer ', '');
        if (!token) {
          return new Response(JSON.stringify({ error: 'No refresh token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Validate refresh token with rotation
        const tokenHash = await hashToken(token);
        const validation = await validateRefreshToken(client, tokenHash);
        
        if (!validation.valid) {
          console.warn(`[CustomAuth] Invalid refresh token: ${validation.reason}`);
          return new Response(JSON.stringify({ error: validation.reason }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Get user details
        const userResult = await client.queryObject(`
          SELECT id, email FROM auth.users WHERE id = $1
        `, [validation.userId]);
        
        if (userResult.rows.length === 0) {
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const user = userResult.rows[0] as any;
        
        const roleResult = await client.queryObject(`
          SELECT role FROM public.user_roles WHERE user_id = $1
        `, [user.id]);
        
        const role = roleResult.rows.length > 0 ? (roleResult.rows[0] as any).role : 'client';
        
        const nowTs = Math.floor(Date.now() / 1000);
        const accessExpiresIn = 3600;
        const refreshExpiresIn = 3600 * 24 * 30;
        const sessionId = crypto.randomUUID();
        
        const accessToken = await createJWT({
          aud: 'authenticated',
          exp: nowTs + accessExpiresIn,
          iat: nowTs,
          iss: SUPABASE_URL + '/auth/v1',
          sub: user.id,
          email: user.email,
          phone: '',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
          role: 'authenticated',
          aal: 'aal1',
          amr: [{ method: 'password', timestamp: nowTs }],
          session_id: sessionId,
          app_role: role
        }, jwtSecret);
        
        // Issue new refresh token in same family (rotation)
        const newRefreshToken = await createJWT({
          sub: user.id,
          type: 'refresh',
          family_id: validation.familyId,
          iat: nowTs,
          exp: nowTs + refreshExpiresIn,
        }, jwtSecret);
        
        const newTokenHash = await hashToken(newRefreshToken);
        await storeRefreshToken(
          client, user.id, newTokenHash, validation.familyId!, 
          ipAddress, userAgent, new Date(Date.now() + refreshExpiresIn * 1000)
        );
        
        console.log(`[CustomAuth] Token refreshed for user: ${user.email}`);
        
        return new Response(JSON.stringify({
          access_token: accessToken,
          refresh_token: newRefreshToken,
          token_type: 'bearer',
          expires_in: accessExpiresIn,
          refresh_expires_in: refreshExpiresIn
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'logout') {
        const authHeader = req.headers.get('authorization');
        if (authHeader) {
          const token = authHeader.replace('Bearer ', '');
          try {
            const [, payloadBase64] = token.split('.');
            const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
            
            await client.queryObject(`
              INSERT INTO public.auth_sessions_log (user_id, event_type, ip_address)
              VALUES ($1, 'logout', $2)
            `, [payload.sub, req.headers.get('x-forwarded-for') || 'unknown']);
          } catch (e) {
            console.log('[CustomAuth] Could not log logout:', e);
          }
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'get-user') {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        if (payload.exp < Math.floor(Date.now() / 1000)) {
          return new Response(JSON.stringify({ error: 'Token expired' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const userResult = await client.queryObject(`
          SELECT id, email, email_confirmed_at, raw_user_meta_data
          FROM auth.users WHERE id = $1
        `, [payload.sub]);
        
        if (userResult.rows.length === 0) {
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const user = userResult.rows[0] as any;
        
        const roleResult = await client.queryObject(`
          SELECT role FROM public.user_roles WHERE user_id = $1
        `, [user.id]);
        
        const role = roleResult.rows.length > 0 ? (roleResult.rows[0] as any).role : 'client';
        
        const profileResult = await client.queryObject(`
          SELECT * FROM public.profiles WHERE id = $1
        `, [user.id]);
        
        const profile = profileResult.rows.length > 0 ? profileResult.rows[0] : null;
        
        return new Response(JSON.stringify({
          user: {
            id: user.id,
            email: user.email,
            role: role,
            email_confirmed_at: user.email_confirmed_at,
            user_metadata: user.raw_user_meta_data || {},
            profile: profile
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'logout-all') {
        // Logout from all devices
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Revoke all refresh tokens
        await client.queryObject(`
          UPDATE public.refresh_tokens
          SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'logout_all'
          WHERE user_id = $1 AND is_revoked = false
        `, [payload.sub]);
        
        // Deactivate all sessions
        await client.queryObject(`
          UPDATE public.user_sessions
          SET is_active = false
          WHERE user_id = $1
        `, [payload.sub]);
        
        // Log event
        await client.queryObject(`
          INSERT INTO public.auth_sessions_log (user_id, event_type, ip_address)
          VALUES ($1, 'logout_all', $2)
        `, [payload.sub, ipAddress]);
        
        console.log(`[CustomAuth] Logout all for user: ${payload.sub}`);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'get-sessions') {
        // Get all active sessions for user
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        const currentSessionId = payload.session_id;
        
        const sessionsResult = await client.queryObject(`
          SELECT id, device_info, ip_address, user_agent, is_active, last_activity, expires_at, created_at
          FROM public.user_sessions
          WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
          ORDER BY last_activity DESC
        `, [payload.sub]);
        
        const sessions = (sessionsResult.rows as any[]).map(s => ({
          ...s,
          is_current: s.session_token === currentSessionId
        }));
        
        return new Response(JSON.stringify({ sessions }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'revoke-session') {
        const { session_id } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        await client.queryObject(`
          UPDATE public.user_sessions
          SET is_active = false
          WHERE id = $1 AND user_id = $2
        `, [session_id, payload.sub]);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'revoke-other-sessions') {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        const currentSessionId = payload.session_id;
        
        // Revoke all sessions except current
        await client.queryObject(`
          UPDATE public.user_sessions
          SET is_active = false
          WHERE user_id = $1 AND session_token != $2
        `, [payload.sub, currentSessionId]);
        
        // Revoke refresh tokens from other families
        await client.queryObject(`
          UPDATE public.refresh_tokens
          SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'revoke_other_sessions'
          WHERE user_id = $1 AND is_revoked = false
        `, [payload.sub]);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'request-password-reset') {
        const { email: resetEmail, redirect_to } = await req.json();
        
        if (!resetEmail) {
          return new Response(JSON.stringify({ error: 'Email required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Check if user exists
        const userResult = await client.queryObject(`
          SELECT id, email FROM auth.users WHERE email = $1
        `, [resetEmail.toLowerCase()]);
        
        if (userResult.rows.length === 0) {
          // Don't reveal if user exists
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const resetUser = userResult.rows[0] as any;
        
        // Generate reset token
        const resetToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour
        
        // Store token in confirmation_token field
        await client.queryObject(`
          UPDATE auth.users
          SET confirmation_token = $1, confirmation_sent_at = NOW()
          WHERE id = $2
        `, [resetToken, resetUser.id]);
        
        // Log the event (in production, send email)
        console.log(`[CustomAuth] Password reset requested for ${resetEmail}, token: ${resetToken}`);
        
        // TODO: Send email with reset link
        // For now, log the reset URL
        const resetUrl = `${redirect_to || SUPABASE_URL}/reset-password?token=${resetToken}`;
        console.log(`[CustomAuth] Reset URL: ${resetUrl}`);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'confirm-password-reset') {
        const { token: resetToken, new_password } = await req.json();
        
        if (!resetToken || !new_password) {
          return new Response(JSON.stringify({ error: 'Token and new password required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Find user by reset token
        const userResult = await client.queryObject(`
          SELECT id, email, confirmation_sent_at
          FROM auth.users
          WHERE confirmation_token = $1
        `, [resetToken]);
        
        if (userResult.rows.length === 0) {
          return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const resetUser = userResult.rows[0] as any;
        
        // Check if token is expired (1 hour)
        const sentAt = new Date(resetUser.confirmation_sent_at);
        if (Date.now() - sentAt.getTime() > 3600000) {
          return new Response(JSON.stringify({ error: 'Token expired' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Update password and clear token
        await client.queryObject(`
          UPDATE auth.users
          SET encrypted_password = crypt($1, gen_salt('bf', 6)),
              confirmation_token = NULL,
              updated_at = NOW()
          WHERE id = $2
        `, [new_password, resetUser.id]);
        
        // Revoke all sessions (security)
        await client.queryObject(`
          UPDATE public.refresh_tokens
          SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'password_reset'
          WHERE user_id = $1
        `, [resetUser.id]);
        
        await client.queryObject(`
          UPDATE public.user_sessions
          SET is_active = false
          WHERE user_id = $1
        `, [resetUser.id]);
        
        console.log(`[CustomAuth] Password reset completed for ${resetUser.email}`);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'update-password') {
        const { new_password, current_password } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Verify current password if provided
        if (current_password) {
          const verifyResult = await client.queryObject(`
            SELECT (encrypted_password = crypt($2, encrypted_password)) as valid
            FROM auth.users WHERE id = $1
          `, [payload.sub, current_password]);
          
          if (verifyResult.rows.length === 0 || !(verifyResult.rows[0] as any).valid) {
            return new Response(JSON.stringify({ error: 'Current password is incorrect' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
        
        // Update password
        await client.queryObject(`
          UPDATE auth.users
          SET encrypted_password = crypt($1, gen_salt('bf', 6)), updated_at = NOW()
          WHERE id = $2
        `, [new_password, payload.sub]);
        
        // Get updated user
        const userResult = await client.queryObject(`
          SELECT id, email, raw_user_meta_data FROM auth.users WHERE id = $1
        `, [payload.sub]);
        
        console.log(`[CustomAuth] Password updated for user: ${payload.sub}`);
        
        return new Response(JSON.stringify({ 
          success: true,
          user: userResult.rows[0]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'verify-email') {
        const { token: verifyToken } = await req.json();
        
        if (!verifyToken) {
          return new Response(JSON.stringify({ error: 'Token required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Find user by confirmation token
        const userResult = await client.queryObject(`
          SELECT id, email FROM auth.users
          WHERE confirmation_token = $1 AND email_confirmed_at IS NULL
        `, [verifyToken]);
        
        if (userResult.rows.length === 0) {
          return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const verifyUser = userResult.rows[0] as any;
        
        // Confirm email
        await client.queryObject(`
          UPDATE auth.users
          SET email_confirmed_at = NOW(), confirmation_token = NULL
          WHERE id = $1
        `, [verifyUser.id]);
        
        console.log(`[CustomAuth] Email verified for ${verifyUser.email}`);
        
        return new Response(JSON.stringify({ 
          success: true,
          user: verifyUser
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'resend-verification') {
        const { email: verifyEmail } = await req.json();
        
        if (!verifyEmail) {
          return new Response(JSON.stringify({ error: 'Email required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Find user
        const userResult = await client.queryObject(`
          SELECT id, email FROM auth.users
          WHERE email = $1 AND email_confirmed_at IS NULL
        `, [verifyEmail.toLowerCase()]);
        
        if (userResult.rows.length === 0) {
          // Don't reveal if user exists or is already verified
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const verifyUser = userResult.rows[0] as any;
        
        // Generate new token
        const newToken = crypto.randomUUID();
        
        await client.queryObject(`
          UPDATE auth.users
          SET confirmation_token = $1, confirmation_sent_at = NOW()
          WHERE id = $2
        `, [newToken, verifyUser.id]);
        
        // TODO: Send email
        console.log(`[CustomAuth] Verification email resent for ${verifyEmail}, token: ${newToken}`);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'enroll-mfa') {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Generate TOTP secret
        const secret = Array.from(crypto.getRandomValues(new Uint8Array(20)))
          .map(b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[b % 32])
          .join('');
        
        // Store secret temporarily
        await client.queryObject(`
          UPDATE public.profiles
          SET totp_secret = $1, totp_enabled = false
          WHERE id = $2
        `, [secret, payload.sub]);
        
        // Generate QR code URL
        const userResult = await client.queryObject(`
          SELECT email FROM auth.users WHERE id = $1
        `, [payload.sub]);
        const userEmail = (userResult.rows[0] as any)?.email || 'user';
        
        const qrUrl = `otpauth://totp/IPTVLink:${userEmail}?secret=${secret}&issuer=IPTVLink`;
        
        return new Response(JSON.stringify({ 
          secret,
          qr_code: qrUrl
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'verify-mfa-enrollment') {
        const { code } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !code) {
          return new Response(JSON.stringify({ error: 'Token and code required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Get secret
        const profileResult = await client.queryObject(`
          SELECT totp_secret FROM public.profiles WHERE id = $1
        `, [payload.sub]);
        
        if (profileResult.rows.length === 0 || !(profileResult.rows[0] as any).totp_secret) {
          return new Response(JSON.stringify({ error: 'MFA not enrolled' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // TODO: Verify TOTP code
        // For now, accept any 6-digit code for testing
        if (!/^\d{6}$/.test(code)) {
          return new Response(JSON.stringify({ error: 'Invalid code format' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Enable MFA
        await client.queryObject(`
          UPDATE public.profiles
          SET totp_enabled = true, totp_verified_at = NOW()
          WHERE id = $1
        `, [payload.sub]);
        
        console.log(`[CustomAuth] MFA enabled for user: ${payload.sub}`);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'disable-mfa') {
        const { code } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !code) {
          return new Response(JSON.stringify({ error: 'Token and code required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // TODO: Verify TOTP code before disabling
        if (!/^\d{6}$/.test(code)) {
          return new Response(JSON.stringify({ error: 'Invalid code' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Disable MFA
        await client.queryObject(`
          UPDATE public.profiles
          SET totp_enabled = false, totp_secret = NULL, totp_verified_at = NULL
          WHERE id = $1
        `, [payload.sub]);
        
        console.log(`[CustomAuth] MFA disabled for user: ${payload.sub}`);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'update-user') {
        const { email: newEmail, data: userData } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Update auth.users if email changed
        if (newEmail) {
          await client.queryObject(`
            UPDATE auth.users SET email = $1, updated_at = NOW() WHERE id = $2
          `, [newEmail.toLowerCase(), payload.sub]);
        }
        
        // Update profile if userData provided
        if (userData) {
          const updates: string[] = [];
          const values: any[] = [];
          let paramIndex = 1;
          
          if (userData.nome) {
            updates.push(`nome = $${paramIndex++}`);
            values.push(userData.nome);
          }
          if (userData.contact_phone) {
            updates.push(`contact_phone = $${paramIndex++}`);
            values.push(userData.contact_phone);
          }
          
          if (updates.length > 0) {
            values.push(payload.sub);
            await client.queryObject(`
              UPDATE public.profiles SET ${updates.join(', ')}, updated_at = NOW()
              WHERE id = $${paramIndex}
            `, values);
          }
        }
        
        // Get updated user
        const userResult = await client.queryObject(`
          SELECT id, email, raw_user_meta_data FROM auth.users WHERE id = $1
        `, [payload.sub]);
        
        const profileResult = await client.queryObject(`
          SELECT * FROM public.profiles WHERE id = $1
        `, [payload.sub]);
        
        const roleResult = await client.queryObject(`
          SELECT role FROM public.user_roles WHERE user_id = $1
        `, [payload.sub]);
        
        const updatedUser = userResult.rows[0] as any;
        const role = roleResult.rows.length > 0 ? (roleResult.rows[0] as any).role : 'client';
        
        return new Response(JSON.stringify({
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            role,
            user_metadata: updatedUser.raw_user_meta_data || {},
            profile: profileResult.rows[0] || null
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'generate-backup-codes') {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Generate 10 backup codes
        const codes: string[] = [];
        for (let i = 0; i < 10; i++) {
          const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
          codes.push(code);
        }
        
        // Hash codes for storage
        const hashedCodes = await Promise.all(codes.map(async (code) => {
          const encoder = new TextEncoder();
          const data = encoder.encode(code);
          const hash = await crypto.subtle.digest('SHA-256', data);
          return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        }));
        
        // Store hashed codes in profile
        await client.queryObject(`
          UPDATE public.profiles
          SET backup_codes = $1, backup_codes_generated_at = NOW()
          WHERE id = $2
        `, [JSON.stringify(hashedCodes), payload.sub]);
        
        console.log(`[CustomAuth] Backup codes generated for user: ${payload.sub}`);
        
        return new Response(JSON.stringify({ codes }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'verify-backup-code') {
        const { code } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !code) {
          return new Response(JSON.stringify({ error: 'Token and code required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Get stored backup codes
        const profileResult = await client.queryObject(`
          SELECT backup_codes FROM public.profiles WHERE id = $1
        `, [payload.sub]);
        
        if (profileResult.rows.length === 0 || !(profileResult.rows[0] as any).backup_codes) {
          return new Response(JSON.stringify({ error: 'No backup codes found' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const storedCodes = JSON.parse((profileResult.rows[0] as any).backup_codes);
        
        // Hash provided code
        const encoder = new TextEncoder();
        const data = encoder.encode(code.toUpperCase().replace(/-/g, ''));
        const hash = await crypto.subtle.digest('SHA-256', data);
        const codeHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Check if code is valid and not used
        const codeIndex = storedCodes.indexOf(codeHash);
        if (codeIndex === -1) {
          return new Response(JSON.stringify({ error: 'Invalid backup code' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Mark code as used by removing it
        storedCodes.splice(codeIndex, 1);
        await client.queryObject(`
          UPDATE public.profiles
          SET backup_codes = $1
          WHERE id = $2
        `, [JSON.stringify(storedCodes), payload.sub]);
        
        console.log(`[CustomAuth] Backup code used for user: ${payload.sub}, remaining: ${storedCodes.length}`);
        
        return new Response(JSON.stringify({ 
          success: true,
          remaining: storedCodes.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'get-security-status') {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Get profile with security info
        const profileResult = await client.queryObject(`
          SELECT totp_enabled, backup_codes, backup_codes_generated_at
          FROM public.profiles WHERE id = $1
        `, [payload.sub]);
        
        const profile = profileResult.rows[0] as any || {};
        
        // Get user email verification status
        const userResult = await client.queryObject(`
          SELECT email_confirmed_at, updated_at FROM auth.users WHERE id = $1
        `, [payload.sub]);
        
        const user = userResult.rows[0] as any || {};
        
        // Count active sessions
        const sessionsResult = await client.queryObject(`
          SELECT COUNT(*) as count FROM public.user_sessions
          WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
        `, [payload.sub]);
        
        const sessionCount = parseInt((sessionsResult.rows[0] as any)?.count || '0');
        
        // Check backup codes
        let hasBackupCodes = false;
        if (profile.backup_codes) {
          try {
            const codes = JSON.parse(profile.backup_codes);
            hasBackupCodes = Array.isArray(codes) && codes.length > 0;
          } catch (e) {
            hasBackupCodes = false;
          }
        }
        
        return new Response(JSON.stringify({
          mfa_enabled: profile.totp_enabled || false,
          has_backup_codes: hasBackupCodes,
          email_verified: !!user.email_confirmed_at,
          password_strong: true, // TODO: Implement password strength check
          active_sessions_count: sessionCount,
          last_password_change: user.updated_at || null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      // ============================================================================
      // DEVICE FINGERPRINTING - 4 handlers
      // ============================================================================
      
      } else if (action === 'get-devices') {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        const devicesResult = await client.queryObject(`
          SELECT id, fingerprint_hash, device_name, device_type, browser, os,
                 is_trusted, trust_expires_at, first_seen_at, last_seen_at, login_count, created_at
          FROM public.device_fingerprints
          WHERE user_id = $1
          ORDER BY last_seen_at DESC
        `, [payload.sub]);
        
        return new Response(JSON.stringify({ devices: devicesResult.rows }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'register-device') {
        const { fingerprint, device_name, device_type, browser, os } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !fingerprint) {
          return new Response(JSON.stringify({ error: 'Token and fingerprint required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Check if device already exists
        const existingDevice = await client.queryObject(`
          SELECT id, is_trusted FROM public.device_fingerprints
          WHERE user_id = $1 AND fingerprint_hash = $2
        `, [payload.sub, fingerprint]);
        
        let deviceId: string;
        let isNewDevice = false;
        let isTrusted = false;
        
        if (existingDevice.rows.length > 0) {
          // Update existing device
          deviceId = (existingDevice.rows[0] as any).id;
          isTrusted = (existingDevice.rows[0] as any).is_trusted;
          
          await client.queryObject(`
            UPDATE public.device_fingerprints
            SET last_seen_at = NOW(), login_count = login_count + 1,
                device_name = COALESCE($3, device_name),
                device_type = COALESCE($4, device_type),
                browser = COALESCE($5, browser),
                os = COALESCE($6, os)
            WHERE id = $1 AND user_id = $2
          `, [deviceId, payload.sub, device_name, device_type, browser, os]);
        } else {
          // Create new device
          deviceId = crypto.randomUUID();
          isNewDevice = true;
          
          await client.queryObject(`
            INSERT INTO public.device_fingerprints (id, user_id, fingerprint_hash, device_name, device_type, browser, os, first_seen_at, last_seen_at, login_count)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), 1)
          `, [deviceId, payload.sub, fingerprint, device_name || 'Unknown Device', device_type || 'unknown', browser || 'unknown', os || 'unknown']);
          
          // Create login alert for new device
          await client.queryObject(`
            INSERT INTO public.login_alerts (user_id, device_fingerprint_id, ip_address, alert_type, location_info)
            VALUES ($1, $2, $3, 'new_device', $4)
          `, [payload.sub, deviceId, ipAddress, JSON.stringify({ userAgent, ipAddress })]);
        }
        
        console.log(`[CustomAuth] Device ${isNewDevice ? 'registered' : 'updated'}: ${deviceId}`);
        
        return new Response(JSON.stringify({ 
          device_id: deviceId,
          is_new: isNewDevice,
          is_trusted: isTrusted
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'trust-device') {
        const { device_id, trust_days } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !device_id) {
          return new Response(JSON.stringify({ error: 'Token and device_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        const days = trust_days || 30;
        
        await client.queryObject(`
          UPDATE public.device_fingerprints
          SET is_trusted = true, trust_expires_at = NOW() + $3::INTERVAL
          WHERE id = $1 AND user_id = $2
        `, [device_id, payload.sub, `${days} days`]);
        
        console.log(`[CustomAuth] Device trusted: ${device_id} for ${days} days`);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'remove-device') {
        const { device_id } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !device_id) {
          return new Response(JSON.stringify({ error: 'Token and device_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        await client.queryObject(`
          DELETE FROM public.device_fingerprints
          WHERE id = $1 AND user_id = $2
        `, [device_id, payload.sub]);
        
        console.log(`[CustomAuth] Device removed: ${device_id}`);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      // ============================================================================
      // LOGIN ALERTS - 3 handlers
      // ============================================================================
      
      } else if (action === 'get-login-alerts') {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        const alertsResult = await client.queryObject(`
          SELECT la.id, la.alert_type, la.ip_address, la.location_info, la.created_at, la.acknowledged_at,
                 df.device_name, df.device_type, df.browser, df.os
          FROM public.login_alerts la
          LEFT JOIN public.device_fingerprints df ON la.device_fingerprint_id = df.id
          WHERE la.user_id = $1
          ORDER BY la.created_at DESC
          LIMIT 50
        `, [payload.sub]);
        
        // Count unread
        const unreadResult = await client.queryObject(`
          SELECT COUNT(*) as count FROM public.login_alerts
          WHERE user_id = $1 AND acknowledged_at IS NULL
        `, [payload.sub]);
        
        return new Response(JSON.stringify({ 
          alerts: alertsResult.rows,
          unread_count: parseInt((unreadResult.rows[0] as any)?.count || '0')
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'acknowledge-alert') {
        const { alert_id } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !alert_id) {
          return new Response(JSON.stringify({ error: 'Token and alert_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        await client.queryObject(`
          UPDATE public.login_alerts
          SET acknowledged_at = NOW()
          WHERE id = $1 AND user_id = $2
        `, [alert_id, payload.sub]);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'set-alert-preferences') {
        const { email_alerts, whatsapp_alerts } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        await client.queryObject(`
          UPDATE public.profiles
          SET login_alerts_email = $2, login_alerts_whatsapp = $3, updated_at = NOW()
          WHERE id = $1
        `, [payload.sub, email_alerts ?? true, whatsapp_alerts ?? false]);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      // ============================================================================
      // PASSKEYS/WEBAUTHN - 6 handlers
      // ============================================================================
      
      } else if (action === 'get-passkeys') {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        const passkeysResult = await client.queryObject(`
          SELECT id, credential_id, device_name, is_active, last_used_at, created_at
          FROM public.passkey_credentials
          WHERE user_id = $1 AND is_active = true
          ORDER BY last_used_at DESC NULLS LAST
        `, [payload.sub]);
        
        return new Response(JSON.stringify({ passkeys: passkeysResult.rows }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'register-passkey-options') {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Get user info
        const userResult = await client.queryObject(`
          SELECT email FROM auth.users WHERE id = $1
        `, [payload.sub]);
        
        const userEmail = (userResult.rows[0] as any)?.email || 'user';
        
        // Generate challenge
        const challenge = Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        // Store challenge temporarily (expires in 5 minutes)
        await client.queryObject(`
          INSERT INTO public.security_events (event_type, event_details, user_id, severity)
          VALUES ('passkey_challenge', $1, $2, 'info')
        `, [JSON.stringify({ challenge, expires: Date.now() + 300000 }), payload.sub]);
        
        const options = {
          challenge,
          rp: {
            name: 'IPTVLink',
            id: 'iptvlink.com.br'
          },
          user: {
            id: payload.sub,
            name: userEmail,
            displayName: userEmail.split('@')[0]
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },  // ES256
            { type: 'public-key', alg: -257 } // RS256
          ],
          timeout: 300000,
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            residentKey: 'preferred',
            userVerification: 'preferred'
          }
        };
        
        return new Response(JSON.stringify(options), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'register-passkey-verify') {
        const { credential_id, public_key, device_name, attestation } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !credential_id || !public_key) {
          return new Response(JSON.stringify({ error: 'Token, credential_id and public_key required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Store the passkey credential
        const passkeyId = crypto.randomUUID();
        
        await client.queryObject(`
          INSERT INTO public.passkey_credentials (id, user_id, credential_id, public_key, device_name, is_active, counter)
          VALUES ($1, $2, $3, $4, $5, true, 0)
        `, [passkeyId, payload.sub, credential_id, public_key, device_name || 'Passkey']);
        
        console.log(`[CustomAuth] Passkey registered: ${passkeyId} for user ${payload.sub}`);
        
        return new Response(JSON.stringify({ 
          success: true,
          passkey_id: passkeyId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'passkey-login-options') {
        const { email: passkeyEmail } = await req.json();
        
        if (!passkeyEmail) {
          return new Response(JSON.stringify({ error: 'Email required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Get user and their passkeys
        const userResult = await client.queryObject(`
          SELECT id FROM auth.users WHERE email = $1
        `, [passkeyEmail.toLowerCase()]);
        
        if (userResult.rows.length === 0) {
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const userId = (userResult.rows[0] as any).id;
        
        const passkeysResult = await client.queryObject(`
          SELECT credential_id FROM public.passkey_credentials
          WHERE user_id = $1 AND is_active = true
        `, [userId]);
        
        if (passkeysResult.rows.length === 0) {
          return new Response(JSON.stringify({ error: 'No passkeys registered' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const challenge = Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        // Store challenge
        await client.queryObject(`
          INSERT INTO public.security_events (event_type, event_details, user_id, severity)
          VALUES ('passkey_login_challenge', $1, $2, 'info')
        `, [JSON.stringify({ challenge, expires: Date.now() + 300000 }), userId]);
        
        const options = {
          challenge,
          rpId: 'iptvlink.com.br',
          timeout: 300000,
          userVerification: 'preferred',
          allowCredentials: (passkeysResult.rows as any[]).map(p => ({
            type: 'public-key',
            id: p.credential_id
          }))
        };
        
        return new Response(JSON.stringify(options), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'passkey-login-verify') {
        const { credential_id, signature, authenticator_data, client_data } = await req.json();
        
        if (!credential_id || !signature) {
          return new Response(JSON.stringify({ error: 'credential_id and signature required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Find the passkey and user
        const passkeyResult = await client.queryObject(`
          SELECT pc.id, pc.user_id, pc.public_key, pc.counter, u.email
          FROM public.passkey_credentials pc
          JOIN auth.users u ON pc.user_id = u.id
          WHERE pc.credential_id = $1 AND pc.is_active = true
        `, [credential_id]);
        
        if (passkeyResult.rows.length === 0) {
          return new Response(JSON.stringify({ error: 'Passkey not found' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const passkey = passkeyResult.rows[0] as any;
        
        // TODO: Verify signature using public key
        // For now, accept the verification (in production, implement proper WebAuthn verification)
        
        // Update counter and last used
        await client.queryObject(`
          UPDATE public.passkey_credentials
          SET counter = counter + 1, last_used_at = NOW()
          WHERE id = $1
        `, [passkey.id]);
        
        // Get role
        const roleResult = await client.queryObject(`
          SELECT role FROM public.user_roles WHERE user_id = $1
        `, [passkey.user_id]);
        
        const role = roleResult.rows.length > 0 ? (roleResult.rows[0] as any).role : 'client';
        
        // Create tokens
        const now = Math.floor(Date.now() / 1000);
        const accessExpiresIn = 3600;
        const refreshExpiresIn = 3600 * 24 * 30;
        const sessionId = crypto.randomUUID();
        const familyId = crypto.randomUUID();
        
        const accessToken = await createJWT({
          aud: 'authenticated',
          exp: now + accessExpiresIn,
          iat: now,
          iss: SUPABASE_URL + '/auth/v1',
          sub: passkey.user_id,
          email: passkey.email,
          phone: '',
          app_metadata: { provider: 'passkey', providers: ['passkey'] },
          user_metadata: {},
          role: 'authenticated',
          aal: 'aal2', // Passkey provides higher assurance
          amr: [{ method: 'passkey', timestamp: now }],
          session_id: sessionId,
          app_role: role
        }, jwtSecret);
        
        const refreshToken = await createJWT({
          sub: passkey.user_id,
          type: 'refresh',
          family_id: familyId,
          iat: now,
          exp: now + refreshExpiresIn,
        }, jwtSecret);
        
        // Store refresh token
        const refreshTokenHash = await hashToken(refreshToken);
        await storeRefreshToken(
          client, passkey.user_id, refreshTokenHash, familyId,
          ipAddress, userAgent, new Date(Date.now() + refreshExpiresIn * 1000)
        );
        
        // Log login
        await client.queryObject(`
          INSERT INTO public.auth_sessions_log (user_id, user_email, event_type, ip_address, user_agent, metadata)
          VALUES ($1, $2, 'passkey_login', $3, $4, $5)
        `, [passkey.user_id, passkey.email, ipAddress, userAgent, JSON.stringify({ passkey_id: passkey.id })]);
        
        console.log(`[CustomAuth] Passkey login successful for: ${passkey.email}`);
        
        return new Response(JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'bearer',
          expires_in: accessExpiresIn,
          user: {
            id: passkey.user_id,
            email: passkey.email,
            role
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'remove-passkey') {
        const { passkey_id } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !passkey_id) {
          return new Response(JSON.stringify({ error: 'Token and passkey_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        await client.queryObject(`
          UPDATE public.passkey_credentials
          SET is_active = false
          WHERE id = $1 AND user_id = $2
        `, [passkey_id, payload.sub]);
        
        console.log(`[CustomAuth] Passkey removed: ${passkey_id}`);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      // ============================================================================
      // EMAIL CHANGE - 3 handlers
      // ============================================================================
      
      } else if (action === 'request-email-change') {
        const { new_email } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !new_email) {
          return new Response(JSON.stringify({ error: 'Token and new_email required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Check if new email is already in use
        const existingUser = await client.queryObject(`
          SELECT id FROM auth.users WHERE email = $1
        `, [new_email.toLowerCase()]);
        
        if (existingUser.rows.length > 0) {
          return new Response(JSON.stringify({ error: 'Email already in use' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Cancel any pending requests
        await client.queryObject(`
          DELETE FROM public.email_change_requests
          WHERE user_id = $1 AND confirmed_at IS NULL
        `, [payload.sub]);
        
        // Generate verification token
        const verificationToken = crypto.randomUUID();
        const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
        
        // Store request
        await client.queryObject(`
          INSERT INTO public.email_change_requests (user_id, old_email, new_email, token, verification_code, expires_at)
          VALUES ($1, (SELECT email FROM auth.users WHERE id = $1), $2, $3, $4, NOW() + INTERVAL '1 hour')
        `, [payload.sub, new_email.toLowerCase(), verificationToken, code]);
        
        // TODO: Send verification code to new email
        console.log(`[CustomAuth] Email change requested for user ${payload.sub}, new: ${new_email}, code: ${code}`);
        
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Verification code sent to new email'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'confirm-email-change') {
        const { code } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !code) {
          return new Response(JSON.stringify({ error: 'Token and code required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Find pending request
        const requestResult = await client.queryObject(`
          SELECT id, new_email, old_email
          FROM public.email_change_requests
          WHERE user_id = $1 AND verification_code = $2 AND confirmed_at IS NULL AND expires_at > NOW()
        `, [payload.sub, code]);
        
        if (requestResult.rows.length === 0) {
          return new Response(JSON.stringify({ error: 'Invalid or expired code' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const request = requestResult.rows[0] as any;
        
        // Update email
        await client.queryObject(`
          UPDATE auth.users SET email = $1, updated_at = NOW() WHERE id = $2
        `, [request.new_email, payload.sub]);
        
        await client.queryObject(`
          UPDATE public.profiles SET email = $1, updated_at = NOW() WHERE id = $2
        `, [request.new_email, payload.sub]);
        
        // Mark request as confirmed
        await client.queryObject(`
          UPDATE public.email_change_requests SET confirmed_at = NOW() WHERE id = $1
        `, [request.id]);
        
        console.log(`[CustomAuth] Email changed for user ${payload.sub}: ${request.old_email} -> ${request.new_email}`);
        
        return new Response(JSON.stringify({ 
          success: true,
          new_email: request.new_email
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'cancel-email-change') {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        await client.queryObject(`
          DELETE FROM public.email_change_requests
          WHERE user_id = $1 AND confirmed_at IS NULL
        `, [payload.sub]);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      // ============================================================================
      // PHONE VERIFICATION VIA WHATSAPP - 3 handlers
      // ============================================================================
      
      } else if (action === 'request-phone-verification') {
        const { phone_number } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !phone_number) {
          return new Response(JSON.stringify({ error: 'Token and phone_number required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Rate limit: max 3 codes per phone per hour
        const recentCodes = await client.queryObject(`
          SELECT COUNT(*) as count FROM public.phone_verification_codes
          WHERE phone_number = $1 AND created_at > NOW() - INTERVAL '1 hour'
        `, [phone_number]);
        
        if (parseInt((recentCodes.rows[0] as any)?.count || '0') >= 3) {
          return new Response(JSON.stringify({ 
            error: 'Too many verification attempts. Try again later.' 
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store code (expires in 10 minutes)
        await client.queryObject(`
          INSERT INTO public.phone_verification_codes (user_id, phone_number, code, purpose, expires_at, attempts)
          VALUES ($1, $2, $3, 'verify_phone', NOW() + INTERVAL '10 minutes', 0)
        `, [payload.sub, phone_number, code]);
        
        // Send via WhatsApp using BotBot API
        const whatsappAppkey = Deno.env.get('WHATSAPP_APPKEY');
        const whatsappAuthkey = Deno.env.get('WHATSAPP_AUTHKEY');
        
        if (whatsappAppkey && whatsappAuthkey) {
          try {
            const formData = new FormData();
            formData.append('appkey', whatsappAppkey);
            formData.append('authkey', whatsappAuthkey);
            formData.append('to', phone_number.replace(/\D/g, ''));
            formData.append('message', `🔐 Seu código de verificação IPTVLink é: *${code}*\n\nEste código expira em 10 minutos.\n\nSe você não solicitou este código, ignore esta mensagem.`);
            
            const whatsappResponse = await fetch('https://api.botbot.app/send', {
              method: 'POST',
              body: formData
            });
            
            const whatsappResult = await whatsappResponse.json();
            console.log(`[CustomAuth] WhatsApp verification sent to ${phone_number}:`, whatsappResult);
          } catch (e) {
            console.error(`[CustomAuth] Failed to send WhatsApp:`, e);
            // Continue anyway - code is stored
          }
        } else {
          console.log(`[CustomAuth] WhatsApp not configured, code for ${phone_number}: ${code}`);
        }
        
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Verification code sent via WhatsApp'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'verify-phone-code') {
        const { phone_number, code } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !phone_number || !code) {
          return new Response(JSON.stringify({ error: 'Token, phone_number and code required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Find valid code
        const codeResult = await client.queryObject(`
          SELECT id, attempts FROM public.phone_verification_codes
          WHERE user_id = $1 AND phone_number = $2 AND code = $3 
            AND verified_at IS NULL AND expires_at > NOW() AND attempts < 3
        `, [payload.sub, phone_number, code]);
        
        if (codeResult.rows.length === 0) {
          // Increment attempts on wrong codes
          await client.queryObject(`
            UPDATE public.phone_verification_codes
            SET attempts = attempts + 1
            WHERE user_id = $1 AND phone_number = $2 AND verified_at IS NULL AND expires_at > NOW()
          `, [payload.sub, phone_number]);
          
          return new Response(JSON.stringify({ error: 'Invalid or expired code' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const verificationCode = codeResult.rows[0] as any;
        
        // Mark as verified
        await client.queryObject(`
          UPDATE public.phone_verification_codes SET verified_at = NOW() WHERE id = $1
        `, [verificationCode.id]);
        
        // Update profile with verified phone
        await client.queryObject(`
          UPDATE public.profiles
          SET contact_phone = $1, phone_verified = true, phone_verified_at = NOW(), updated_at = NOW()
          WHERE id = $2
        `, [phone_number, payload.sub]);
        
        console.log(`[CustomAuth] Phone verified for user ${payload.sub}: ${phone_number}`);
        
        return new Response(JSON.stringify({ 
          success: true,
          phone_number: phone_number
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'resend-phone-code') {
        const { phone_number } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !phone_number) {
          return new Response(JSON.stringify({ error: 'Token and phone_number required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Invalidate old codes
        await client.queryObject(`
          DELETE FROM public.phone_verification_codes
          WHERE user_id = $1 AND phone_number = $2 AND verified_at IS NULL
        `, [payload.sub, phone_number]);
        
        // Create new code (reuse request-phone-verification logic)
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        await client.queryObject(`
          INSERT INTO public.phone_verification_codes (user_id, phone_number, code, purpose, expires_at, attempts)
          VALUES ($1, $2, $3, 'verify_phone', NOW() + INTERVAL '10 minutes', 0)
        `, [payload.sub, phone_number, code]);
        
        // Send via WhatsApp
        const whatsappAppkey = Deno.env.get('WHATSAPP_APPKEY');
        const whatsappAuthkey = Deno.env.get('WHATSAPP_AUTHKEY');
        
        if (whatsappAppkey && whatsappAuthkey) {
          try {
            const formData = new FormData();
            formData.append('appkey', whatsappAppkey);
            formData.append('authkey', whatsappAuthkey);
            formData.append('to', phone_number.replace(/\D/g, ''));
            formData.append('message', `🔐 Seu novo código de verificação IPTVLink é: *${code}*\n\nEste código expira em 10 minutos.`);
            
            await fetch('https://api.botbot.app/send', {
              method: 'POST',
              body: formData
            });
          } catch (e) {
            console.error(`[CustomAuth] Failed to resend WhatsApp:`, e);
          }
        }
        
        return new Response(JSON.stringify({ 
          success: true,
          message: 'New verification code sent'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      // ============================================================================
      // ACCOUNT DELETION - 3 handlers
      // ============================================================================
      
      } else if (action === 'request-account-deletion') {
        const { reason, password } = await req.json();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        // Verify password if provided
        if (password) {
          const verifyResult = await client.queryObject(`
            SELECT (encrypted_password = crypt($2, encrypted_password)) as valid
            FROM auth.users WHERE id = $1
          `, [payload.sub, password]);
          
          if (verifyResult.rows.length === 0 || !(verifyResult.rows[0] as any).valid) {
            return new Response(JSON.stringify({ error: 'Invalid password' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
        
        // Check for existing pending request
        const existingRequest = await client.queryObject(`
          SELECT id FROM public.account_deletion_requests
          WHERE user_id = $1 AND completed_at IS NULL AND cancelled_at IS NULL
        `, [payload.sub]);
        
        if (existingRequest.rows.length > 0) {
          return new Response(JSON.stringify({ error: 'Deletion request already pending' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Create deletion request (30 days grace period)
        const confirmationToken = crypto.randomUUID();
        const scheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        
        await client.queryObject(`
          INSERT INTO public.account_deletion_requests (user_id, reason, confirmation_token, scheduled_deletion_at)
          VALUES ($1, $2, $3, $4)
        `, [payload.sub, reason || null, confirmationToken, scheduledAt.toISOString()]);
        
        // Log security event
        await client.queryObject(`
          INSERT INTO public.security_events (event_type, event_details, user_id, severity)
          VALUES ('account_deletion_requested', $1, $2, 'high')
        `, [JSON.stringify({ reason, scheduled_at: scheduledAt }), payload.sub]);
        
        console.log(`[CustomAuth] Account deletion requested for user ${payload.sub}, scheduled: ${scheduledAt}`);
        
        return new Response(JSON.stringify({ 
          success: true,
          scheduled_deletion_at: scheduledAt.toISOString(),
          message: 'Account scheduled for deletion in 30 days. You can cancel anytime before then.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'cancel-account-deletion') {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        const result = await client.queryObject(`
          UPDATE public.account_deletion_requests
          SET cancelled_at = NOW()
          WHERE user_id = $1 AND completed_at IS NULL AND cancelled_at IS NULL
          RETURNING id
        `, [payload.sub]);
        
        if (result.rows.length === 0) {
          return new Response(JSON.stringify({ error: 'No pending deletion request' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log(`[CustomAuth] Account deletion cancelled for user ${payload.sub}`);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'get-deletion-status') {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        const requestResult = await client.queryObject(`
          SELECT id, reason, scheduled_deletion_at, created_at, cancelled_at, completed_at
          FROM public.account_deletion_requests
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `, [payload.sub]);
        
        if (requestResult.rows.length === 0) {
          return new Response(JSON.stringify({ 
            has_pending_request: false,
            status: null
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const request = requestResult.rows[0] as any;
        
        let status = 'pending';
        if (request.cancelled_at) status = 'cancelled';
        else if (request.completed_at) status = 'completed';
        
        return new Response(JSON.stringify({
          has_pending_request: status === 'pending',
          status,
          scheduled_deletion_at: request.scheduled_deletion_at,
          reason: request.reason,
          created_at: request.created_at,
          cancelled_at: request.cancelled_at
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else {
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
    } finally {
      await client.end();
    }
    
  } catch (error) {
    console.error('[CustomAuth] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// FETCH-M3U HANDLER - Fetch M3U content from URL
// ============================================================================
async function handleFetchM3U(req: Request): Promise<Response> {
  const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fetch-m3u] Fetching M3U from:", url);

    // Normalize URL - force HTTP for common Xtream ports
    let fetchUrl = url;
    try {
      const urlObj = new URL(url);
      const httpPorts = ['8880', '8000', '25461', '25462', '8080'];
      if (urlObj.protocol === 'https:' && httpPorts.includes(urlObj.port)) {
        fetchUrl = url.replace('https://', 'http://');
        console.log("[fetch-m3u] Using HTTP for port:", urlObj.port);
      }
    } catch (e) {
      console.log("[fetch-m3u] URL parse warning:", e.message);
    }

    // Single attempt with VLC user agent
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
        "Accept": "*/*",
      },
    });

    console.log("[fetch-m3u] Response status:", response.status);

    if (!response.ok) {
      if (response.status === 404 || response.status === 403) {
        throw new Error("Servidor bloqueou a requisição. Use 'Colar M3U' para importar.");
      }
      throw new Error(`HTTP ${response.status}`);
    }

    // Check content-length header if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_CONTENT_SIZE) {
      const sizeMB = Math.round(parseInt(contentLength) / 1024 / 1024);
      throw new Error(`Arquivo muito grande (${sizeMB}MB). Use 'Colar M3U' para playlists grandes.`);
    }

    // Stream response and check size
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Não foi possível ler a resposta");
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      totalSize += value.length;
      if (totalSize > MAX_CONTENT_SIZE) {
        reader.cancel();
        const sizeMB = Math.round(totalSize / 1024 / 1024);
        throw new Error(`Arquivo muito grande (>${sizeMB}MB). Use 'Colar M3U' para playlists grandes.`);
      }
      
      chunks.push(value);
    }

    const allChunks = new Uint8Array(totalSize);
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }

    const content = new TextDecoder().decode(allChunks);
    console.log("[fetch-m3u] Content length:", content.length);

    // Basic validation
    if (!content.includes('#EXTM3U') && !content.includes('#EXTINF')) {
      throw new Error("Conteúdo não parece ser M3U válido");
    }

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fetch-m3u] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// ADMIN-DATA HANDLER - Admin dashboard data operations
// ============================================================================
async function handleAdminData(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { action, userId, filters } = body;
    
    console.log('[AdminData] Action:', action);
    
    const dbUrl = Deno.env.get('SELFHOSTED_DB_URL');
    if (!dbUrl) {
      throw new Error('SELFHOSTED_DB_URL not configured');
    }

    const dbUrlMatch = dbUrl.match(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/([^?]+)/);
    if (!dbUrlMatch) {
      throw new Error('Invalid database URL format');
    }

    const [, dbUser, dbPassword, dbHost, dbPortStr, dbName] = dbUrlMatch;
    const dbPort = dbPortStr ? parseInt(dbPortStr) : 5432;
    
    const postgres = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
    const { Client } = postgres;
    
    const client = new Client({
      user: dbUser,
      password: dbPassword,
      hostname: dbHost,
      port: dbPort,
      database: dbName,
    });
    
    await client.connect();
    
    try {
      switch (action) {
        case 'list-profiles': {
          const result = await client.queryObject(`
            SELECT * FROM public.profiles ORDER BY created_at DESC LIMIT 100
          `);
          return new Response(JSON.stringify({ profiles: result.rows }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        case 'list-shortcuts': {
          const result = await client.queryObject(`
            SELECT * FROM public.admin_shortcuts 
            WHERE user_id = $1 OR user_id IS NULL
            ORDER BY order_index ASC
          `, [userId]);
          return new Response(JSON.stringify({ shortcuts: result.rows }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        case 'list-activity': {
          const limit = filters?.limit || 10;
          const result = await client.queryObject(`
            SELECT * FROM public.activity_logs 
            ORDER BY created_at DESC 
            LIMIT $1
          `, [limit]);
          return new Response(JSON.stringify({ activities: result.rows }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        default:
          return new Response(JSON.stringify({ 
            error: `Unknown action: ${action}` 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      }
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('[AdminData] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// COOLIFY-API HANDLER - Infrastructure management (uses COOLIFY_API_TOKEN)
// ============================================================================
async function handleCoolifyApi(req: Request): Promise<Response> {
  const COOLIFY_URL = "https://dashboard.iptvlink.com.br";
  const COOLIFY_TOKEN = Deno.env.get('COOLIFY_API_TOKEN') || '';
  const SELFHOSTED_URL = "https://supabase.iptvlink.com.br";
  const SELFHOSTED_SERVICE_KEY = Deno.env.get('SELFHOSTED_SERVICE_ROLE_KEY') || '';

  try {
    const body = await req.json();
    const { action, endpoint, method = 'GET', params } = body;

    console.log('[CoolifyAPI] Action:', action);

    // Custom actions that don't require Coolify API
    const customActions: Record<string, () => Promise<any>> = {
      'get-selfhosted-status': async () => {
        const checks: Record<string, boolean> = { database: false, auth: false, functions: false };
        
        try {
          const dbResponse = await fetch(`${SELFHOSTED_URL}/rest/v1/`, {
            headers: { 'apikey': SELFHOSTED_SERVICE_KEY, 'Authorization': `Bearer ${SELFHOSTED_SERVICE_KEY}` }
          });
          checks.database = dbResponse.ok;
          
          const authResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/health`);
          checks.auth = authResponse.ok;
          
          const functionsResponse = await fetch(`${SELFHOSTED_URL}/functions/v1/main`);
          checks.functions = functionsResponse.ok;
        } catch (e) {
          console.error('[CoolifyAPI] Status check error:', e);
        }
        
        return { success: true, data: { url: SELFHOSTED_URL, checks, all_healthy: Object.values(checks).every(v => v) } };
      },
      
      'test-selfhosted-connection': async () => {
        try {
          const response = await fetch(`${SELFHOSTED_URL}/rest/v1/`, {
            headers: { 'apikey': SELFHOSTED_SERVICE_KEY, 'Authorization': `Bearer ${SELFHOSTED_SERVICE_KEY}` }
          });
          return { success: response.ok, data: { status: response.status, url: SELFHOSTED_URL } };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      
      'sync-secrets-to-coolify': async () => {
        const REQUIRED_SECRETS = [
          'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
          'MERCADO_PAGO_ACCESS_TOKEN', 'WHATSAPP_APPKEY', 'WHATSAPP_AUTHKEY',
          'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME',
          'COOLIFY_API_TOKEN', 'JWT_SECRET', 'CRON_SECRET', 'SELFHOSTED_DB_URL'
        ];
        
        const results: Record<string, boolean> = {};
        for (const secret of REQUIRED_SECRETS) {
          results[secret] = !!Deno.env.get(secret);
        }
        
        const configured = Object.values(results).filter(v => v).length;
        const missing = REQUIRED_SECRETS.filter(s => !results[s]);
        
        return { success: true, data: { total: REQUIRED_SECRETS.length, configured, missing, all_configured: missing.length === 0 } };
      },
    };

    // Execute custom action if exists
    if (action && customActions[action]) {
      const result = await customActions[action]();
      return new Response(JSON.stringify({ ...result, meta: { action, timestamp: new Date().toISOString() } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // For Coolify API calls, require token
    if (!COOLIFY_TOKEN) {
      return new Response(JSON.stringify({ 
        error: 'COOLIFY_API_TOKEN not configured',
        hint: 'Configure the token in Coolify environment variables'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Predefined Coolify actions
    const coolifyActions: Record<string, { endpoint: string; method: string }> = {
      'health': { endpoint: '/health', method: 'GET' },
      'version': { endpoint: '/version', method: 'GET' },
      'list-servers': { endpoint: '/servers', method: 'GET' },
      'list-services': { endpoint: '/services', method: 'GET' },
      'list-projects': { endpoint: '/projects', method: 'GET' },
      'list-applications': { endpoint: '/applications', method: 'GET' },
      'restart-service': { endpoint: '/services/{uuid}/restart', method: 'GET' },
      'start-service': { endpoint: '/services/{uuid}/start', method: 'GET' },
      'stop-service': { endpoint: '/services/{uuid}/stop', method: 'GET' },
    };

    let finalEndpoint = endpoint || '';
    let finalMethod = method;

    if (action && coolifyActions[action]) {
      finalEndpoint = coolifyActions[action].endpoint;
      finalMethod = coolifyActions[action].method;
    }

    // Replace path parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        finalEndpoint = finalEndpoint.replace(`{${key}}`, String(value));
      });
    }

    const finalUrl = `${COOLIFY_URL}/api/v1${finalEndpoint}`;
    console.log(`[CoolifyAPI] ${finalMethod} ${finalUrl}`);

    const response = await fetch(finalUrl, {
      method: finalMethod,
      headers: {
        'Authorization': `Bearer ${COOLIFY_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      data,
      meta: { action, endpoint: finalEndpoint, timestamp: new Date().toISOString() }
    }), {
      status: response.ok ? 200 : response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[CoolifyAPI] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// REMOTE-COMMAND HANDLER - SSH key management (uses COOLIFY_API_TOKEN)
// ============================================================================
async function handleRemoteCommand(req: Request): Promise<Response> {
  const COOLIFY_URL = "https://dashboard.iptvlink.com.br";
  const COOLIFY_TOKEN = Deno.env.get('COOLIFY_API_TOKEN') || '';
  const dbUrl = Deno.env.get('SELFHOSTED_DB_URL');

  try {
    // Validate COOLIFY_API_TOKEN instead of JWT
    if (!COOLIFY_TOKEN) {
      return new Response(JSON.stringify({ 
        error: 'COOLIFY_API_TOKEN not configured',
        hint: 'This function requires COOLIFY_API_TOKEN for authentication'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action, host, user, environment, publicKey, keyId, command, auditId } = body;

    console.log('[RemoteCommand] Action:', action, 'Host:', host);

    const newAuditId = auditId || crypto.randomUUID();

    // Log audit to database
    async function logAudit(entry: any) {
      if (!dbUrl) return;
      
      try {
        const dbUrlMatch = dbUrl.match(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/([^?]+)/);
        if (!dbUrlMatch) return;
        
        const [, dbUser, dbPassword, dbHost, dbPortStr, dbName] = dbUrlMatch;
        const dbPort = dbPortStr ? parseInt(dbPortStr) : 5432;
        
        const postgres = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
        const client = new postgres.Client({ user: dbUser, password: dbPassword, hostname: dbHost, port: dbPort, database: dbName });
        await client.connect();
        
        await client.queryObject(`
          INSERT INTO public.remote_command_audit (audit_id, action, host, user_remote, environment, status, details, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [entry.audit_id, entry.action, entry.host, entry.user, entry.environment, entry.status, JSON.stringify(entry.details)]);
        
        await client.end();
      } catch (e) {
        console.error('[RemoteCommand] Audit log error:', e);
      }
    }

    let result: any = {};

    switch (action) {
      case 'apply-ssh-key': {
        let key = publicKey;
        
        if (keyId) {
          const keysResponse = await fetch(`${COOLIFY_URL}/api/v1/security/keys`, {
            headers: { 'Authorization': `Bearer ${COOLIFY_TOKEN}`, 'Accept': 'application/json' }
          });
          
          if (keysResponse.ok) {
            const keys = await keysResponse.json();
            const foundKey = keys.find((k: any) => k.uuid === keyId);
            if (foundKey) key = foundKey.public_key;
          }
        }

        if (!key) {
          throw new Error('SSH public key required');
        }

        const commands = {
          backup: `mkdir -p ~/.ssh && chmod 700 ~/.ssh && cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak-${newAuditId} 2>/dev/null || true`,
          apply: `grep -F "${key}" ~/.ssh/authorized_keys >/dev/null 2>&1 || echo "${key}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`,
          verify: `ssh -o BatchMode=yes -o ConnectTimeout=5 ${user}@${host} echo ok`,
        };

        result = { status: 'commands_generated', audit_id: newAuditId, host, user, commands };
        await logAudit({ audit_id: newAuditId, action, host, user, environment, status: 'success', details: result });
        break;
      }

      case 'backup-authorized-keys': {
        const backupCommand = `mkdir -p ~/.ssh && cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak-${newAuditId}`;
        result = { status: 'backup_command_generated', audit_id: newAuditId, command: backupCommand };
        break;
      }

      case 'rollback': {
        if (!auditId) throw new Error('auditId required for rollback');
        const rollbackCommand = `mv ~/.ssh/authorized_keys.bak-${auditId} ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`;
        result = { status: 'rollback_command_generated', audit_id: auditId, command: rollbackCommand };
        break;
      }

      case 'verify-connection': {
        const verifyCommand = `ssh -o BatchMode=yes -o ConnectTimeout=5 ${user}@${host} echo ok`;
        result = { status: 'verify_command_generated', command: verifyCommand };
        break;
      }

      case 'execute-command': {
        if (!command) throw new Error('Command required');
        
        const dangerousPatterns = ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:'];
        for (const pattern of dangerousPatterns) {
          if (command.includes(pattern)) throw new Error('Dangerous command detected');
        }

        result = { status: 'command_prepared', audit_id: newAuditId, command, execution: `ssh ${user}@${host} "${command}"` };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[RemoteCommand] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// PROCESS-M3U-IMPORT HANDLER - M3U playlist import processing
// ============================================================================
async function handleProcessM3UImport(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { url, content, sessionId, sourceId } = body;

    console.log('[ProcessM3UImport] Session:', sessionId, 'URL:', url ? 'yes' : 'no', 'Content:', content ? 'yes' : 'no');

    const dbUrl = Deno.env.get('SELFHOSTED_DB_URL');
    if (!dbUrl) {
      throw new Error('SELFHOSTED_DB_URL not configured');
    }

    // Parse M3U content
    let m3uContent = content;
    
    if (url && !content) {
      console.log('[ProcessM3UImport] Fetching from URL:', url);
      const response = await fetch(url, {
        headers: { 'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18' }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch M3U: HTTP ${response.status}`);
      }
      
      m3uContent = await response.text();
    }

    if (!m3uContent) {
      throw new Error('No M3U content provided');
    }

    // Parse channels from M3U
    const lines = m3uContent.split('\n');
    const channels: any[] = [];
    let currentChannel: any = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('#EXTINF:')) {
        const nameMatch = trimmedLine.match(/,(.+)$/);
        const logoMatch = trimmedLine.match(/tvg-logo="([^"]+)"/);
        const groupMatch = trimmedLine.match(/group-title="([^"]+)"/);
        const tvgIdMatch = trimmedLine.match(/tvg-id="([^"]+)"/);
        
        currentChannel = {
          name: nameMatch ? nameMatch[1].trim() : 'Unknown',
          logo_url: logoMatch ? logoMatch[1] : null,
          category: groupMatch ? groupMatch[1] : 'Outros',
          tvg_id: tvgIdMatch ? tvgIdMatch[1] : null,
        };
      } else if (trimmedLine && !trimmedLine.startsWith('#') && currentChannel) {
        currentChannel.url = trimmedLine;
        channels.push(currentChannel);
        currentChannel = null;
      }
    }

    console.log('[ProcessM3UImport] Parsed channels:', channels.length);

    // Connect to database
    const dbUrlMatch = dbUrl.match(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/([^?]+)/);
    if (!dbUrlMatch) {
      throw new Error('Invalid database URL format');
    }

    const [, dbUser, dbPassword, dbHost, dbPortStr, dbName] = dbUrlMatch;
    const dbPort = dbPortStr ? parseInt(dbPortStr) : 5432;
    
    const postgres = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
    const client = new postgres.Client({ user: dbUser, password: dbPassword, hostname: dbHost, port: dbPort, database: dbName });
    await client.connect();

    try {
      // Insert channels in batches
      let inserted = 0;
      const batchSize = 100;
      
      for (let i = 0; i < channels.length; i += batchSize) {
        const batch = channels.slice(i, i + batchSize);
        
        for (const channel of batch) {
          const slug = channel.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').slice(0, 100);
          
          try {
            await client.queryObject(`
              INSERT INTO public.iptv_channels (name, slug, original_url, logo_url, category)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (slug) DO UPDATE SET
                original_url = EXCLUDED.original_url,
                logo_url = EXCLUDED.logo_url,
                category = EXCLUDED.category,
                updated_at = NOW()
            `, [channel.name, slug + '-' + Math.random().toString(36).slice(2, 8), channel.url, channel.logo_url, channel.category]);
            
            inserted++;
          } catch (e) {
            console.error('[ProcessM3UImport] Insert error:', e);
          }
        }
        
        console.log('[ProcessM3UImport] Progress:', inserted, '/', channels.length);
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          parsed: channels.length,
          inserted,
          sessionId
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } finally {
      await client.end();
    }

  } catch (error) {
    console.error('[ProcessM3UImport] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// IPTV-ADMIN HANDLER - Admin IPTV operations (bypasses RLS)
// ============================================================================
async function handleIptvAdmin(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { action, data } = body;

    console.log('[IptvAdmin] Action:', action);

    const dbUrl = Deno.env.get('SELFHOSTED_DB_URL');
    if (!dbUrl) {
      throw new Error('SELFHOSTED_DB_URL not configured');
    }

    const dbUrlMatch = dbUrl.match(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/([^?]+)/);
    if (!dbUrlMatch) {
      throw new Error('Invalid database URL format');
    }

    const [, dbUser, dbPassword, dbHost, dbPortStr, dbName] = dbUrlMatch;
    const dbPort = dbPortStr ? parseInt(dbPortStr) : 5432;
    
    const postgres = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
    const client = new postgres.Client({ user: dbUser, password: dbPassword, hostname: dbHost, port: dbPort, database: dbName });
    await client.connect();

    try {
      switch (action) {
        case 'create-playlist': {
          const { name, slug, description, is_public, user_id, channel_count } = data;
          const result = await client.queryObject<{ id: number }>(`
            INSERT INTO public.iptv_playlists (name, slug, description, is_public, user_id, channel_count)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
          `, [name, slug, description || null, is_public || false, user_id || null, channel_count || 0]);
          
          return new Response(JSON.stringify({ success: true, data: { id: result.rows[0]?.id } }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case 'update-playlist': {
          const { id, name, slug, description, is_public, channel_count } = data;
          await client.queryObject(`
            UPDATE public.iptv_playlists 
            SET name = $1, slug = $2, description = $3, is_public = $4, channel_count = COALESCE($5, channel_count), updated_at = NOW()
            WHERE id = $6
          `, [name, slug, description || null, is_public || false, channel_count, id]);
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case 'delete-playlist': {
          const { id } = data;
          await client.queryObject(`DELETE FROM public.iptv_playlist_channels WHERE playlist_id = $1`, [id]);
          await client.queryObject(`DELETE FROM public.iptv_playlists WHERE id = $1`, [id]);
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case 'link-channels': {
          const { playlist_id, channel_ids } = data;
          
          for (let i = 0; i < channel_ids.length; i++) {
            await client.queryObject(`
              INSERT INTO public.iptv_playlist_channels (playlist_id, channel_id, position)
              VALUES ($1, $2, $3)
              ON CONFLICT (playlist_id, channel_id) DO NOTHING
            `, [playlist_id, channel_ids[i], i]);
          }
          
          await client.queryObject(`
            UPDATE public.iptv_playlists SET channel_count = $1, updated_at = NOW() WHERE id = $2
          `, [channel_ids.length, playlist_id]);
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case 'insert-channels': {
          const { channels } = data;
          const insertedIds: number[] = [];
          
          for (const ch of channels) {
            const slug = ch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').slice(0, 100);
            const result = await client.queryObject<{ id: number }>(`
              INSERT INTO public.iptv_channels (name, slug, original_url, logo_url, category, content_type)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (slug) DO UPDATE SET original_url = EXCLUDED.original_url, updated_at = NOW()
              RETURNING id
            `, [ch.name, slug + '-' + Math.random().toString(36).slice(2, 8), ch.url, ch.logo || null, ch.group || null, 'live']);
            
            if (result.rows[0]) insertedIds.push(result.rows[0].id);
          }
          
          return new Response(JSON.stringify({ success: true, data: { ids: insertedIds } }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('[IptvAdmin] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// IPTV-PLAY HANDLER - Signed playback URL for channels
// ============================================================================
async function handleIptvPlay(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const channelId = url.searchParams.get('channelId');

    if (!channelId) {
      return new Response(
        JSON.stringify({ error: 'channelId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify authentication using custom auth token from X-Custom-Token header
    const customToken = req.headers.get('X-Custom-Token');
    if (!customToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = customToken;

    // Use self-hosted service role key or fallback to cloud
    const serviceRoleKey = Deno.env.get('SELFHOSTED_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!serviceRoleKey) {
      console.error('[iptv-play] No service role key found');
      return new Response(
        JSON.stringify({ error: 'Server configuration error - missing service role key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseAdmin = createClient(SUPABASE_URL, serviceRoleKey);

    // Decode JWT to get user_id
    let userId: string | null = null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        userId = payload.sub || payload.user_id || payload.id;
      }
    } catch (e) {
      console.error('[iptv-play] Token decode error (router):', e);
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, cliente_ativo')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - User not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: channel, error: channelError } = await supabaseAdmin
      .from('iptv_channels')
      .select('id, name, slug, original_url, transcode_manifest_url, transcode_status, content_type')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      return new Response(
        JSON.stringify({ error: 'Channel not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cdnList: Array<{ url: string; priority: number; type: string; region?: string }> = [];

    if (channel.transcode_status === 'ready' && channel.transcode_manifest_url) {
      cdnList.push({
        url: channel.transcode_manifest_url,
        priority: 1,
        type: 'transcode',
        region: 'global',
      });
    }

    if (channel.original_url.startsWith('http://')) {
      const proxyUrl = `${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(channel.original_url)}`;
      cdnList.push({
        url: proxyUrl,
        priority: 2,
        type: 'proxy',
      });
    }

    // Origin as fallback
    cdnList.push({
      url: channel.original_url,
      priority: 3,
      type: 'origin',
    });

    const primary = cdnList[0];
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return new Response(
      JSON.stringify({
        url: primary?.url,
        cdnList,
        expiresAt,
        channel: { id: channel.id, name: channel.name },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[iptv-play] Router handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
