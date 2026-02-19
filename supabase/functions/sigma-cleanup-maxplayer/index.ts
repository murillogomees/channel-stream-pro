import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    // 1. Get Sigma config
    const { data: config } = await supabase
      .from('sigma_blaze_config')
      .select('*')
      .limit(1)
      .single()

    if (!config?.api_url || (!config?.sigma_username && !config?.api_key)) {
      return new Response(JSON.stringify({
        success: false, error: 'Sigma Blaze não configurado'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Authenticate
    const authToken = await getAuthToken(supabase, config)
    if (!authToken) {
      return new Response(JSON.stringify({
        success: false, error: 'Falha na autenticação com o Sigma Blaze'
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Fetch ALL clients from Sigma API
    const allClients = await fetchAllClients(config.api_url, authToken)
    console.log(`[CLEANUP_MAXPLAYER] Total clients fetched: ${allClients.length}`)

    // 4. Separate Blaze IPTV and MaxPlayer clients by package/plan field
    const blazeClients = allClients.filter((c: any) => {
      const pkg = (c.plan_name || c.package_name || c.plano || c.plan || '').toLowerCase()
      return pkg.includes('blaze') || pkg.includes('iptv') || pkg.includes('blaze iptv')
    })

    const maxPlayerClients = allClients.filter((c: any) => {
      const pkg = (c.plan_name || c.package_name || c.plano || c.plan || '').toLowerCase()
      return pkg.includes('maxplayer') || pkg.includes('max player') || pkg.includes('max_player')
    })

    console.log(`[CLEANUP_MAXPLAYER] Blaze IPTV: ${blazeClients.length}, MaxPlayer: ${maxPlayerClients.length}`)

    // 5. Build username sets from Blaze IPTV clients
    const allBlazeUsernames = new Set<string>()
    const blazeWithExpGt5Days = new Set<string>()
    const now = new Date()
    const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)

    for (const c of blazeClients) {
      const username = (c.username || c.login || c.user || c.nome_usuario || '').toLowerCase().trim()
      if (!username) continue
      allBlazeUsernames.add(username)
      const expDate = new Date(c.expiration_date || c.exp_date || c.expires_at || c.data_expiracao || c.due_date || '1970-01-01')
      if (expDate > fiveDaysFromNow) blazeWithExpGt5Days.add(username)
    }

    // 6. Find MaxPlayer clients to delete:
    //    a) Órfãos: MaxPlayer SEM Blaze IPTV correspondente
    //    b) Duplicados: MaxPlayer COM Blaze IPTV que tem vencimento > 5 dias
    const toDelete: any[] = []
    const orphans: any[] = []
    const duplicates: any[] = []

    for (const c of maxPlayerClients) {
      const username = (c.username || c.login || c.user || c.nome_usuario || '').toLowerCase().trim()
      if (!username) continue

      if (!allBlazeUsernames.has(username)) {
        // Órfão - sem Blaze IPTV correspondente
        toDelete.push(c)
        orphans.push(c)
      } else if (blazeWithExpGt5Days.has(username)) {
        // Duplicado - tem Blaze IPTV com vencimento > 5 dias
        toDelete.push(c)
        duplicates.push(c)
      }
    }

    console.log(`[CLEANUP_MAXPLAYER] Orphans: ${orphans.length}, Duplicates (exp>5d): ${duplicates.length}, Total to delete: ${toDelete.length}`)

    // 7. Delete each MaxPlayer client via API
    let deleted = 0, errors = 0
    const details: any[] = []

    for (const client of toDelete) {
      const clientId = String(client.id || client.client_id || client.user_id || '')
      const username = client.username || client.login || client.user || client.nome_usuario || ''
      const reason = orphans.includes(client) ? 'orphan' : 'duplicate_exp_gt_5d'
      try {
        const result = await callSigmaAPI(config.api_url, authToken, 'DELETE', `/clients/${clientId}`)
        if (result.ok) {
          deleted++
          details.push({ id: clientId, username, reason, status: 'deleted' })
        } else {
          errors++
          details.push({ id: clientId, username, reason, status: 'error', error: result.data })
        }
      } catch (e) {
        errors++
        details.push({ id: clientId, username, reason, status: 'error', error: (e as Error).message })
      }
    }

    // 8. Log
    await supabase.from('sigma_blaze_logs').insert({
      action: 'cleanup-maxplayer',
      status: errors === 0 ? 'SUCCESS' : 'PARTIAL',
      details: { total: allClients.length, blaze: blazeClients.length, maxplayer: maxPlayerClients.length, orphans: orphans.length, duplicates: duplicates.length, deleted, errors, details }
    })

    return new Response(JSON.stringify({
      success: true,
      message: `${deleted} MaxPlayer excluídos (${orphans.length} órfãos, ${duplicates.length} duplicados), ${errors} erros`,
      deleted, errors, orphans: orphans.length, duplicates: duplicates.length, total: toDelete.length, details,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[CLEANUP_MAXPLAYER] Error:', error)
    return new Response(JSON.stringify({
      success: false, error: (error as Error).message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

async function getAuthToken(supabase: any, config: any): Promise<string | null> {
  const { data: cached } = await supabase
    .from('sigma_auth_cache')
    .select('access_token, session_cookie, expires_at')
    .eq('id', 'default')
    .maybeSingle()

  if (cached && new Date(cached.expires_at) > new Date()) {
    return cached.access_token || cached.session_cookie
  }

  const authEndpoints = ['/auth/login', '/login', '/api/login', '/api/auth', '/api/v1/auth/login', '/api/v1/login']

  for (const endpoint of authEndpoints) {
    try {
      const response = await fetch(`${config.api_url}${endpoint}`, {
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
          await supabase.from('sigma_auth_cache').upsert({
            id: 'default', access_token: token, session_cookie: sessionCookie,
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          return token || sessionCookie
        }
      }
    } catch (_) { /* try next */ }
  }

  return config.api_key || null
}

async function fetchAllClients(baseUrl: string, authToken: string): Promise<any[]> {
  let all: any[] = [], page = 1, hasMore = true
  while (hasMore) {
    const result = await callSigmaAPI(baseUrl, authToken, 'GET', `/clients?page=${page}&per_page=100`)
    if (!result.ok) {
      const alt = await callSigmaAPI(baseUrl, authToken, 'GET', `/users?page=${page}&limit=100`)
      if (alt.ok) { const c = extractArr(alt.data); all = all.concat(c); hasMore = c.length >= 100 }
      else hasMore = false
    } else {
      const c = extractArr(result.data); all = all.concat(c); hasMore = c.length >= 100
    }
    page++
    if (page > 50) break
  }
  return all
}

function extractArr(data: any): any[] {
  if (Array.isArray(data)) return data
  return data?.data || data?.clients || data?.users || []
}

async function callSigmaAPI(baseUrl: string, authToken: string, method: string, path: string, body?: any) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
    })
    const data = await response.json().catch(() => ({}))
    return { ok: response.ok, status: response.status, data }
  } catch (error) {
    return { ok: false, status: 0, data: { error: (error as Error).message } }
  }
}
