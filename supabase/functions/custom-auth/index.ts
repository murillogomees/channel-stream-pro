import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// JWT utilities
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

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // bcrypt verification using Deno
  const bcrypt = await import("https://deno.land/x/bcrypt@v0.4.1/mod.ts");
  try {
    return await bcrypt.compare(password, hash);
  } catch (e) {
    console.error('Password verification error:', e);
    return false;
  }
}

async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("https://deno.land/x/bcrypt@v0.4.1/mod.ts");
  return await bcrypt.hash(password);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, email, password, userData } = await req.json();
    
    const dbUrl = Deno.env.get('SELFHOSTED_DB_URL');
    const jwtSecret = Deno.env.get('JWT_SECRET') || 'super-secret-jwt-token-with-at-least-32-characters-long';
    
    console.log('[CustomAuth] DB URL preview:', dbUrl?.substring(0, 30) + '...');
    
    if (!dbUrl) {
      throw new Error('SELFHOSTED_DB_URL not configured');
    }

    // Parse database URL - support multiple formats
    // Format 1: postgres://user:pass@host:port/dbname
    // Format 2: postgresql://user:pass@host:port/dbname
    // Format 3: postgres://user:pass@host:port/dbname?options
    let dbUrlMatch = dbUrl.match(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/([^?]+)/);
    
    if (!dbUrlMatch) {
      console.error('[CustomAuth] Failed to parse DB URL:', dbUrl.substring(0, 50));
      throw new Error('Invalid database URL format. Expected: postgres://user:pass@host:port/dbname');
    }

    const [, dbUser, dbPassword, dbHost, dbPortStr, dbName] = dbUrlMatch;
    const dbPort = dbPortStr ? parseInt(dbPortStr) : 5432;
    
    console.log('[CustomAuth] Connecting to DB:', dbHost, dbPort, dbName);
    
    // Dynamic import for postgres
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
      if (action === 'login') {
        console.log(`Login attempt for: ${email}`);
        
        // Get user from auth.users
        const userResult = await client.queryObject(`
          SELECT id, email, encrypted_password, email_confirmed_at, raw_user_meta_data
          FROM auth.users 
          WHERE email = $1
        `, [email.toLowerCase()]);
        
        if (userResult.rows.length === 0) {
          return new Response(JSON.stringify({ 
            error: 'Invalid login credentials',
            details: 'User not found'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const user = userResult.rows[0] as any;
        
        // Verify password
        const passwordValid = await verifyPassword(password, user.encrypted_password);
        
        if (!passwordValid) {
          // Log failed attempt
          await client.queryObject(`
            INSERT INTO public.security_events (event_type, event_details, ip_address)
            VALUES ('failed_login', $1, $2)
          `, [JSON.stringify({ email }), req.headers.get('x-forwarded-for') || 'unknown']);
          
          return new Response(JSON.stringify({ 
            error: 'Invalid login credentials',
            details: 'Invalid password'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Get user role
        const roleResult = await client.queryObject(`
          SELECT role FROM public.user_roles WHERE user_id = $1
        `, [user.id]);
        
        const role = roleResult.rows.length > 0 ? (roleResult.rows[0] as any).role : 'client';
        
        // Get profile
        const profileResult = await client.queryObject(`
          SELECT * FROM public.profiles WHERE id = $1
        `, [user.id]);
        
        const profile = profileResult.rows.length > 0 ? profileResult.rows[0] : null;
        
        // Create JWT token
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = 3600 * 24 * 7; // 7 days
        
        const accessToken = await createJWT({
          sub: user.id,
          email: user.email,
          role: role,
          iat: now,
          exp: now + expiresIn,
          aud: 'authenticated',
          iss: 'custom-auth'
        }, jwtSecret);
        
        const refreshToken = await createJWT({
          sub: user.id,
          type: 'refresh',
          iat: now,
          exp: now + (expiresIn * 4), // 28 days
        }, jwtSecret);
        
        // Log successful login
        await client.queryObject(`
          INSERT INTO public.auth_sessions_log (user_id, user_email, event_type, ip_address, user_agent)
          VALUES ($1, $2, 'login', $3, $4)
        `, [user.id, user.email, req.headers.get('x-forwarded-for') || 'unknown', req.headers.get('user-agent') || 'unknown']);
        
        console.log(`Login successful for: ${email}, role: ${role}`);
        
        return new Response(JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'bearer',
          expires_in: expiresIn,
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
        console.log(`Signup attempt for: ${email}`);
        
        // Check if user exists
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
        
        // Hash password
        const hashedPassword = await hashPassword(password);
        
        // Create user in auth.users
        const userId = crypto.randomUUID();
        const now = new Date().toISOString();
        
        await client.queryObject(`
          INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, 
            email_confirmed_at, created_at, updated_at,
            raw_user_meta_data, raw_app_meta_data,
            aud, role, confirmation_token
          ) VALUES (
            $1, '00000000-0000-0000-0000-000000000000', $2, $3,
            $4, $4, $4,
            $5, '{"provider": "email", "providers": ["email"]}',
            'authenticated', 'authenticated', ''
          )
        `, [userId, email.toLowerCase(), hashedPassword, now, JSON.stringify(userData || {})]);
        
        // Create identity
        await client.queryObject(`
          INSERT INTO auth.identities (
            id, user_id, provider_id, provider, identity_data, 
            last_sign_in_at, created_at, updated_at
          ) VALUES (
            $1, $1, $2, 'email', $3, $4, $4, $4
          )
        `, [userId, email.toLowerCase(), JSON.stringify({ sub: userId, email: email.toLowerCase() }), now]);
        
        // Profile and role are created by handle_new_user trigger
        // But let's ensure they exist
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
        
        // Create JWT tokens
        const nowTs = Math.floor(Date.now() / 1000);
        const expiresIn = 3600 * 24 * 7;
        
        const accessToken = await createJWT({
          sub: userId,
          email: email.toLowerCase(),
          role: 'client',
          iat: nowTs,
          exp: nowTs + expiresIn,
          aud: 'authenticated',
          iss: 'custom-auth'
        }, jwtSecret);
        
        const refreshToken = await createJWT({
          sub: userId,
          type: 'refresh',
          iat: nowTs,
          exp: nowTs + (expiresIn * 4),
        }, jwtSecret);
        
        console.log(`Signup successful for: ${email}`);
        
        return new Response(JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'bearer',
          expires_in: expiresIn,
          user: {
            id: userId,
            email: email.toLowerCase(),
            role: 'client'
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } else if (action === 'refresh') {
        // Token refresh logic
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // For now, just validate the user exists and issue new tokens
        const token = authHeader.replace('Bearer ', '');
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        
        const userResult = await client.queryObject(`
          SELECT id, email FROM auth.users WHERE id = $1
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
        
        const nowTs = Math.floor(Date.now() / 1000);
        const expiresIn = 3600 * 24 * 7;
        
        const accessToken = await createJWT({
          sub: user.id,
          email: user.email,
          role: role,
          iat: nowTs,
          exp: nowTs + expiresIn,
          aud: 'authenticated',
          iss: 'custom-auth'
        }, jwtSecret);
        
        return new Response(JSON.stringify({
          access_token: accessToken,
          token_type: 'bearer',
          expires_in: expiresIn
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
            console.log('Could not log logout:', e);
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
        
        // Check if token is expired
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
    console.error('Custom auth error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
