import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Browser-like headers to bypass Cloudflare bot protection
const browserHeaders: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin': 'https://blaze.officeb.site',
  'Referer': 'https://blaze.officeb.site/',
  'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
}

interface SigmaRequest {
  action: 'create' | 'delete' | 'update-package' | 'sync' | 'list-all'
  user_id?: string
  email?: string
  name?: string
  plan_id?: string
  sigma_client_id?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    let body: SigmaRequest
    if (req.method === 'GET') {
      const url = new URL(req.url)
      body = { action: (url.searchParams.get('action') as SigmaRequest['action']) || 'list-all' }
    } else {
      body = await req.json()
    }
    const { action } = body

    const { data: config } = await supabase
      .from('sigma_blaze_config')
      .select('*')
      .limit(1)
      .single()

    if (!config?.api_url || (!config?.sigma_username && !config?.api_key)) {
      return new Response(JSON.stringify({
        success: false, error: 'Sigma Blaze não configurado. Configure a URL e credenciais na aba Sigma Blaze.'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const authToken = await getAuthToken(supabase, config)
    if (!authToken) {
      return new Response(JSON.stringify({
        success: false, error: 'Falha na autenticação com o Sigma Blaze. Verifique usuário e senha.'
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'list-all') {
      return await handleListAll(supabase, config, authToken, corsHeaders)
    }

    return new Response(JSON.stringify({
      success: false, error: 'Ação não suportada: ' + action
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[SIGMA_BLAZE] Error:', error)
    return new Response(JSON.stringify({
      success: false, error: (error as Error).message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

/**
 * Authenticate with Sigma Blaze.
 * Based on user info: login page is /#/sign-in, API base is /api,
 * session endpoint is /api/auth/me
 */
async function getAuthToken(supabase: any, config: any): Promise<string | null> {
  // 1. Check cached token
  const { data: cached } = await supabase
    .from('sigma_auth_cache')
    .select('access_token, session_cookie, expires_at')
    .eq('id', 'default')
    .maybeSingle()

  const now = new Date()
  const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000)

  if (cached && new Date(cached.expires_at) > tenMinutesFromNow) {
    // Validate cached token is still valid
    const isValid = await validateToken(config.api_url, cached.access_token || cached.session_cookie)
    if (isValid) {
      console.log('[SIGMA_BLAZE] Using cached auth token (validated)')
      return cached.access_token || cached.session_cookie
    }
    console.log('[SIGMA_BLAZE] Cached token invalid, re-authenticating...')
  }

  console.log('[SIGMA_BLAZE] Authenticating with Sigma Blaze...')

  const baseUrl = config.api_url.replace(/\/+$/, '')
  // Remove /api suffix to get the root domain for building full paths
  const rootUrl = baseUrl.endsWith('/api') ? baseUrl.slice(0, -4) : baseUrl

  // Focused auth paths based on user-confirmed API structure
  const authEndpoints = [
    `${baseUrl}/auth/login`,       // /api/auth/login
    `${baseUrl}/login`,            // /api/login
    `${rootUrl}/auth/login`,       // /auth/login (if base doesn't have /api)
    `${baseUrl}/auth/sign-in`,     // /api/auth/sign-in
    `${baseUrl}/auth/signin`,      // /api/auth/signin
    `${baseUrl}/sessions`,         // /api/sessions
    `${baseUrl}/auth/sessions`,    // /api/auth/sessions
  ]

  // Payloads to try
  const payloads = [
    { contentType: 'application/json', body: JSON.stringify({ email: config.sigma_username, password: config.sigma_password }) },
    { contentType: 'application/json', body: JSON.stringify({ username: config.sigma_username, password: config.sigma_password }) },
    { contentType: 'application/json', body: JSON.stringify({ login: config.sigma_username, password: config.sigma_password }) },
  ]

  for (const url of authEndpoints) {
    for (const payload of payloads) {
      try {
        console.log(`[SIGMA_BLAZE] Trying: POST ${url}`)

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            ...browserHeaders,
            'Content-Type': payload.contentType,
          },
          body: payload.body,
        })

        console.log(`[SIGMA_BLAZE] Response: ${response.status} from ${url}`)

        if (response.ok) {
          const text = await response.text()
          let data: any = {}
          try { data = JSON.parse(text) } catch { /* not json */ }

          // Extract token from various response formats
          const token = data.token || data.access_token || data.jwt || data.session?.token || 
                        data.data?.token || data.data?.access_token || data.auth_token || 
                        data.api_key || data.key || data.session_id || ''
          const sessionCookie = response.headers.get('set-cookie') || ''

          if (token || sessionCookie) {
            console.log(`[SIGMA_BLAZE] Auth successful via ${url}`)
            
            const expiresAt = new Date(Date.now() + 50 * 60 * 1000).toISOString()
            await supabase.from('sigma_auth_cache').upsert({
              id: 'default',
              access_token: token,
              session_cookie: sessionCookie,
              expires_at: expiresAt,
              updated_at: new Date().toISOString(),
            })

            return token || sessionCookie
          } else {
            console.log(`[SIGMA_BLAZE] 200 OK but no token. Body: ${text.substring(0, 300)}`)
          }
        } else {
          const text = await response.text().catch(() => '')
          console.log(`[SIGMA_BLAZE] ${response.status} - ${text.substring(0, 200)}`)
        }
      } catch (e) {
        console.log(`[SIGMA_BLAZE] Error on ${url}: ${(e as Error).message}`)
      }
    }
  }

  // Fallback: try api_key if available
  if (config.api_key) {
    console.log('[SIGMA_BLAZE] Falling back to API key auth')
    return config.api_key
  }

  console.error('[SIGMA_BLAZE] All authentication methods failed')
  return null
}

/**
 * Validate if a token is still valid by calling /api/auth/me
 */
async function validateToken(apiUrl: string, token: string): Promise<boolean> {
  const baseUrl = apiUrl.replace(/\/+$/, '')
  const meEndpoints = [
    `${baseUrl}/auth/me`,   // /api/auth/me
    `${baseUrl}/me`,        // /api/me
  ]
  
  for (const url of meEndpoints) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...browserHeaders,
          'Authorization': `Bearer ${token}`,
          'Cookie': token.includes('=') ? token : '',
        },
      })
      if (response.ok) return true
    } catch {
      // continue
    }
  }
  return false
}

async function handleListAll(supabase: any, config: any, authToken: string, headers: any) {
  try {
    let allClients: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const result = await callSigmaAPI(config.api_url, authToken, 'GET', `/clients?page=${page}&per_page=100`)
      
      if (!result.ok) {
        const altResult = await callSigmaAPI(config.api_url, authToken, 'GET', `/users?page=${page}&limit=100`)
        if (altResult.ok && altResult.data) {
          const clients = extractClientArray(altResult.data)
          allClients = allClients.concat(clients)
          hasMore = clients.length >= 100
        } else {
          hasMore = false
        }
      } else {
        const clients = extractClientArray(result.data)
        allClients = allClients.concat(clients)
        hasMore = clients.length >= 100
      }
      page++
      if (page > 50) break
    }

    console.log(`[SIGMA_BLAZE] Fetched ${allClients.length} clients from API`)

    await logAction(supabase, 'list-all', 'SUCCESS', undefined, {
      total_fetched: allClients.length,
    })

    return new Response(JSON.stringify({
      success: true,
      clients: allClients,
      total: allClients.length,
      message: `${allClients.length} clientes encontrados`
    }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[SIGMA_BLAZE] List all error:', error)
    await logAction(supabase, 'list-all', 'ERROR', undefined, { error: (error as Error).message })
    return new Response(JSON.stringify({
      success: false, error: (error as Error).message
    }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } })
  }
}

function extractClientArray(data: any): any[] {
  if (Array.isArray(data)) return data
  if (data?.data) return Array.isArray(data.data) ? data.data : []
  if (data?.clients) return Array.isArray(data.clients) ? data.clients : []
  if (data?.users) return Array.isArray(data.users) ? data.users : []
  return []
}

async function callSigmaAPI(
  baseUrl: string,
  authToken: string,
  method: string,
  path: string,
  body?: any
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}${path}`
    const options: RequestInit = {
      method,
      headers: {
        ...browserHeaders,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Cookie': authToken.includes('=') ? authToken : '',
      },
    }
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)
    const data = await response.json().catch(() => ({}))
    return { ok: response.ok, status: response.status, data }
  } catch (error) {
    return { ok: false, status: 0, data: { error: (error as Error).message } }
  }
}

async function logAction(supabase: any, action: string, status: string, user_id?: string, details?: any) {
  await supabase.from('sigma_blaze_logs').insert({
    action, status, user_id, details: details || {}
  })
}
