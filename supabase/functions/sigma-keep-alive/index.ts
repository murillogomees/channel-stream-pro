import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Proxy configuration for bypassing Cloudflare
const PROXY_HOST = '181.215.48.26'
const PROXY_PORT = 36621
const PROXY_USER = '3RQpVq9w'
const PROXY_PASS = '47t7XEoD'

async function proxiedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const proxyUrl = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`
  try {
    return await fetch(url, {
      ...options,
      // @ts-ignore - Deno supports client proxy
      client: Deno.createHttpClient({ proxy: { url: proxyUrl } }),
    })
  } catch {
    return await fetch(url, options)
  }
}

/**
 * Keep-alive function: renews the Sigma Blaze session every ~45 minutes
 * so the 60-minute session never expires.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    // 1. Get config
    const { data: config } = await supabase
      .from('sigma_blaze_config')
      .select('*')
      .limit(1)
      .single()

    if (!config?.api_url || !config?.sigma_username) {
      return new Response(JSON.stringify({ success: false, error: 'Sigma não configurado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Check if current session needs renewal (< 15 min remaining)
    const { data: cached } = await supabase
      .from('sigma_auth_cache')
      .select('access_token, session_cookie, expires_at')
      .eq('id', 'default')
      .maybeSingle()

    const now = new Date()
    const fifteenMin = new Date(now.getTime() + 15 * 60 * 1000)

    if (cached && new Date(cached.expires_at) > fifteenMin) {
      console.log('[SIGMA_KEEP_ALIVE] Session still valid, no renewal needed')
      return new Response(JSON.stringify({
        success: true, message: 'Sessão ainda válida',
        expires_at: cached.expires_at
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Force re-authenticate
    console.log('[SIGMA_KEEP_ALIVE] Renewing session...')
    const authEndpoints = ['/auth/login', '/login', '/api/login', '/api/auth', '/api/v1/auth/login', '/api/v1/login']

    for (const endpoint of authEndpoints) {
      try {
        const response = await proxiedFetch(`${config.api_url}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: config.sigma_username, password: config.sigma_password,
            user: config.sigma_username, login: config.sigma_username,
            senha: config.sigma_password, pass: config.sigma_password,
          }),
        })

        if (response.ok) {
          const data = await response.json().catch(() => ({}))
          const token = data.token || data.access_token || data.jwt || data.session || data.auth_token || ''
          const sessionCookie = response.headers.get('set-cookie') || ''

          if (token || sessionCookie) {
            const expiresAt = new Date(Date.now() + 50 * 60 * 1000).toISOString()
            await supabase.from('sigma_auth_cache').upsert({
              id: 'default',
              access_token: token,
              session_cookie: sessionCookie,
              expires_at: expiresAt,
              updated_at: new Date().toISOString(),
            })

            console.log(`[SIGMA_KEEP_ALIVE] Session renewed via ${endpoint}, expires at ${expiresAt}`)
            return new Response(JSON.stringify({
              success: true, message: 'Sessão renovada com sucesso',
              expires_at: expiresAt
            }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }
        }
      } catch (_) { /* try next */ }
    }

    console.error('[SIGMA_KEEP_ALIVE] Failed to renew session')
    return new Response(JSON.stringify({
      success: false, error: 'Falha ao renovar sessão'
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[SIGMA_KEEP_ALIVE] Error:', error)
    return new Response(JSON.stringify({
      success: false, error: (error as Error).message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
