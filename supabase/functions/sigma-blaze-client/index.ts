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
  'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
}

interface ProxyConfig {
  host: string
  port: number
  user: string
  pass: string
}

function buildProxiedFetch(proxy?: ProxyConfig) {
  return async function proxiedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    if (proxy && proxy.host && proxy.port) {
      const proxyUrl = `http://${proxy.user}:${proxy.pass}@${proxy.host}:${proxy.port}`
      try {
        const response = await fetch(url, {
          ...options,
          // @ts-ignore - Deno supports client proxy
          client: Deno.createHttpClient({ proxy: { url: proxyUrl } }),
        })
        return response
      } catch (proxyError) {
        console.log(`[SIGMA] Proxy failed, trying direct: ${(proxyError as Error).message}`)
      }
    }
    return await fetch(url, options)
  }
}

interface SigmaRequest {
  action: 'create' | 'delete' | 'update-package' | 'sync' | 'list-all' | 'test-connection'
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
      return jsonResponse({ success: false, error: 'Sigma Blaze não configurado. Configure a URL e credenciais.' }, 400)
    }

    // Build proxy from DB config
    const proxy: ProxyConfig | undefined = config.proxy_host && config.proxy_port
      ? { host: config.proxy_host, port: config.proxy_port, user: config.proxy_user || '', pass: config.proxy_pass || '' }
      : undefined

    const fetchFn = buildProxiedFetch(proxy)

    // Test connection action
    if (action === 'test-connection') {
      return await handleTestConnection(supabase, config, proxy, fetchFn)
    }

    const authToken = await getAuthToken(supabase, config, fetchFn)
    if (!authToken) {
      return jsonResponse({ success: false, error: 'Falha na autenticação com o Sigma Blaze. Verifique usuário e senha.' }, 401)
    }

    if (action === 'list-all') {
      return await handleListAll(supabase, config, authToken, fetchFn)
    }

    return jsonResponse({ success: false, error: 'Ação não suportada: ' + action }, 400)

  } catch (error) {
    console.error('[SIGMA] Error:', error)
    return jsonResponse({ success: false, error: (error as Error).message }, 500)
  }
})

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Test connection: tries to reach the API URL, then authenticate
 */
async function handleTestConnection(
  supabase: any, config: any, proxy: ProxyConfig | undefined, fetchFn: typeof fetch
) {
  const steps: Array<{ step: string; status: string; detail: string }> = []
  const baseUrl = config.api_url.replace(/\/+$/, '')

  // Step 1: Reach the URL
  try {
    const reachRes = await fetchFn(baseUrl, {
      method: 'GET',
      headers: { ...browserHeaders },
    })
    const reachText = await reachRes.text()
    const isCloudflareChallenge = reachText.includes('challenge-platform') || reachText.includes('cf-browser-verification')

    steps.push({
      step: 'Alcançar URL',
      status: isCloudflareChallenge ? 'CLOUDFLARE_BLOCK' : reachRes.ok ? 'OK' : `HTTP ${reachRes.status}`,
      detail: isCloudflareChallenge
        ? 'Cloudflare está bloqueando. Configure um proxy residencial.'
        : `Status ${reachRes.status}, body: ${reachText.substring(0, 200)}`,
    })

    if (isCloudflareChallenge && !proxy?.host) {
      await logAction(supabase, 'test-connection', 'ERROR', undefined, { steps })
      return jsonResponse({
        success: false,
        message: 'Cloudflare está bloqueando a conexão direta. Configure um proxy residencial.',
        details: { steps },
      })
    }
  } catch (e) {
    steps.push({ step: 'Alcançar URL', status: 'ERROR', detail: (e as Error).message })
    await logAction(supabase, 'test-connection', 'ERROR', undefined, { steps })
    return jsonResponse({ success: false, message: `Não foi possível alcançar ${baseUrl}: ${(e as Error).message}`, details: { steps } })
  }

  // Step 2: Try authentication
  try {
    const authToken = await getAuthToken(supabase, config, fetchFn)
    if (authToken) {
      steps.push({ step: 'Autenticação', status: 'OK', detail: 'Token obtido com sucesso' })

      // Step 3: Try listing clients
      try {
        const result = await callSigmaAPI(baseUrl, authToken, 'GET', '/clients?page=1&per_page=5', undefined, fetchFn)
        if (result.ok) {
          const clients = extractClientArray(result.data)
          steps.push({ step: 'Listar Clientes', status: 'OK', detail: `${clients.length} clientes retornados na amostra` })
        } else {
          steps.push({ step: 'Listar Clientes', status: `HTTP ${result.status}`, detail: JSON.stringify(result.data).substring(0, 200) })
        }
      } catch (e) {
        steps.push({ step: 'Listar Clientes', status: 'ERROR', detail: (e as Error).message })
      }

      await logAction(supabase, 'test-connection', 'SUCCESS', undefined, { steps })
      return jsonResponse({ success: true, message: 'Conexão com Sigma Blaze funcionando!', details: { steps } })
    } else {
      steps.push({ step: 'Autenticação', status: 'FAILED', detail: 'Nenhum token retornado. Verifique credenciais.' })
      await logAction(supabase, 'test-connection', 'ERROR', undefined, { steps })
      return jsonResponse({ success: false, message: 'Autenticação falhou. Verifique usuário e senha.', details: { steps } })
    }
  } catch (e) {
    steps.push({ step: 'Autenticação', status: 'ERROR', detail: (e as Error).message })
    await logAction(supabase, 'test-connection', 'ERROR', undefined, { steps })
    return jsonResponse({ success: false, message: `Erro na autenticação: ${(e as Error).message}`, details: { steps } })
  }
}

/**
 * Authenticate with Sigma Blaze
 */
async function getAuthToken(supabase: any, config: any, fetchFn: typeof fetch): Promise<string | null> {
  // Check cached token
  const { data: cached } = await supabase
    .from('sigma_auth_cache')
    .select('access_token, session_cookie, expires_at')
    .eq('id', 'default')
    .maybeSingle()

  const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000)

  if (cached && new Date(cached.expires_at) > tenMinutesFromNow) {
    const isValid = await validateToken(config.api_url, cached.access_token || cached.session_cookie, fetchFn)
    if (isValid) {
      console.log('[SIGMA] Using cached token')
      return cached.access_token || cached.session_cookie
    }
  }

  console.log('[SIGMA] Authenticating...')
  const baseUrl = config.api_url.replace(/\/+$/, '')
  const rootUrl = baseUrl.endsWith('/api') ? baseUrl.slice(0, -4) : baseUrl

  // Add Origin/Referer headers dynamically based on config URL
  const dynamicHeaders = {
    ...browserHeaders,
    'Origin': rootUrl,
    'Referer': rootUrl + '/',
  }

  const authEndpoints = [
    `${baseUrl}/auth/login`,
    `${baseUrl}/login`,
    `${rootUrl}/auth/login`,
    `${baseUrl}/auth/sign-in`,
    `${baseUrl}/auth/signin`,
    `${baseUrl}/sessions`,
    `${baseUrl}/auth/sessions`,
  ]

  const payloads = [
    { body: JSON.stringify({ email: config.sigma_username, password: config.sigma_password }) },
    { body: JSON.stringify({ username: config.sigma_username, password: config.sigma_password }) },
    { body: JSON.stringify({ login: config.sigma_username, password: config.sigma_password }) },
  ]

  for (const url of authEndpoints) {
    for (const payload of payloads) {
      try {
        console.log(`[SIGMA] Trying: POST ${url}`)
        const response = await fetchFn(url, {
          method: 'POST',
          headers: { ...dynamicHeaders, 'Content-Type': 'application/json' },
          body: payload.body,
        })
        console.log(`[SIGMA] Response: ${response.status} from ${url}`)

        if (response.ok) {
          const text = await response.text()
          let data: any = {}
          try { data = JSON.parse(text) } catch { /* not json */ }

          const token = data.token || data.access_token || data.jwt || data.session?.token ||
                        data.data?.token || data.data?.access_token || data.auth_token ||
                        data.api_key || data.key || data.session_id || ''
          const sessionCookie = response.headers.get('set-cookie') || ''

          if (token || sessionCookie) {
            console.log(`[SIGMA] Auth successful via ${url}`)
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
            console.log(`[SIGMA] 200 OK but no token. Body: ${text.substring(0, 300)}`)
          }
        } else {
          const text = await response.text().catch(() => '')
          console.log(`[SIGMA] ${response.status} - ${text.substring(0, 200)}`)
        }
      } catch (e) {
        console.log(`[SIGMA] Error on ${url}: ${(e as Error).message}`)
      }
    }
  }

  if (config.api_key) {
    console.log('[SIGMA] Falling back to API key auth')
    return config.api_key
  }

  console.error('[SIGMA] All auth methods failed')
  return null
}

async function validateToken(apiUrl: string, token: string, fetchFn: typeof fetch): Promise<boolean> {
  const baseUrl = apiUrl.replace(/\/+$/, '')
  for (const url of [`${baseUrl}/auth/me`, `${baseUrl}/me`]) {
    try {
      const response = await fetchFn(url, {
        method: 'GET',
        headers: {
          ...browserHeaders,
          'Authorization': `Bearer ${token}`,
          'Cookie': token.includes('=') ? token : '',
        },
      })
      if (response.ok) return true
      else await response.text() // consume body
    } catch { /* continue */ }
  }
  return false
}

async function handleListAll(supabase: any, config: any, authToken: string, fetchFn: typeof fetch) {
  try {
    let allClients: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const result = await callSigmaAPI(config.api_url, authToken, 'GET', `/clients?page=${page}&per_page=100`, undefined, fetchFn)
      if (!result.ok) {
        const altResult = await callSigmaAPI(config.api_url, authToken, 'GET', `/users?page=${page}&limit=100`, undefined, fetchFn)
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

    console.log(`[SIGMA] Fetched ${allClients.length} clients`)
    await logAction(supabase, 'list-all', 'SUCCESS', undefined, { total_fetched: allClients.length })

    return jsonResponse({
      success: true,
      clients: allClients,
      total: allClients.length,
      message: `${allClients.length} clientes encontrados`,
    })
  } catch (error) {
    console.error('[SIGMA] List all error:', error)
    await logAction(supabase, 'list-all', 'ERROR', undefined, { error: (error as Error).message })
    return jsonResponse({ success: false, error: (error as Error).message }, 500)
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
  baseUrl: string, authToken: string, method: string, path: string, body?: any, fetchFn: typeof fetch = fetch
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
    if (body && method !== 'GET') options.body = JSON.stringify(body)

    const response = await fetchFn(url, options)
    const data = await response.json().catch(() => ({}))
    return { ok: response.ok, status: response.status, data }
  } catch (error) {
    return { ok: false, status: 0, data: { error: (error as Error).message } }
  }
}

async function logAction(supabase: any, action: string, status: string, user_id?: string, details?: any) {
  await supabase.from('sigma_blaze_logs').insert({ action, status, user_id, details: details || {} })
}
