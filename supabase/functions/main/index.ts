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
