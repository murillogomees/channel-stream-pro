import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    const body: SigmaRequest = await req.json()
    const { action } = body

    // Get Sigma config (with credentials)
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

    // Authenticate with Sigma Blaze (session-based)
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
 * Authenticate with Sigma Blaze using username/password.
 * Caches the token/session in the database to persist across cold starts.
 */
async function getAuthToken(supabase: any, config: any): Promise<string | null> {
  // 1. Check cached token
  const { data: cached } = await supabase
    .from('sigma_auth_cache')
    .select('access_token, session_cookie, expires_at')
    .eq('id', 'default')
    .maybeSingle()

  if (cached && new Date(cached.expires_at) > new Date()) {
    console.log('[SIGMA_BLAZE] Using cached auth token')
    return cached.access_token || cached.session_cookie
  }

  // 2. Authenticate with username/password
  console.log('[SIGMA_BLAZE] Authenticating with username/password...')
  
  // Try common auth endpoint patterns
  const authEndpoints = [
    '/auth/login',
    '/login',
    '/api/login',
    '/api/auth',
    '/api/v1/auth/login',
    '/api/v1/login',
  ]

  for (const endpoint of authEndpoints) {
    try {
      const url = `${config.api_url}${endpoint}`
      console.log(`[SIGMA_BLAZE] Trying auth endpoint: ${url}`)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: config.sigma_username,
          password: config.sigma_password,
          // Also try alternative field names
          user: config.sigma_username,
          login: config.sigma_username,
          senha: config.sigma_password,
          pass: config.sigma_password,
        }),
      })

      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        const token = data.token || data.access_token || data.jwt || data.session || data.auth_token || data.api_key || ''
        const sessionCookie = response.headers.get('set-cookie') || ''

        if (token || sessionCookie) {
          console.log(`[SIGMA_BLAZE] Auth successful via ${endpoint}`)
          
          // Cache for 30 minutes
          const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
          await supabase.from('sigma_auth_cache').upsert({
            id: 'default',
            access_token: token,
            session_cookie: sessionCookie,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          })

          return token || sessionCookie
        }
      }
    } catch (e) {
      console.log(`[SIGMA_BLAZE] Auth endpoint ${endpoint} failed:`, (e as Error).message)
    }
  }

  // 3. Fallback: try api_key if available
  if (config.api_key) {
    console.log('[SIGMA_BLAZE] Falling back to API key auth')
    return config.api_key
  }

  console.error('[SIGMA_BLAZE] All authentication methods failed')
  return null
}

async function handleListAll(supabase: any, config: any, authToken: string, headers: any) {
  try {
    let allClients: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const result = await callSigmaAPI(config.api_url, authToken, 'GET', `/clients?page=${page}&per_page=100`)
      
      if (!result.ok) {
        // Try alternative endpoints
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
    const url = `${baseUrl}${path}`
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Cookie': authToken.startsWith('session') ? authToken : '',
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
