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

    if (!config?.api_url || !config?.api_key) {
      console.error('[CLEANUP_MAXPLAYER] Sigma Blaze config not set')
      return new Response(JSON.stringify({
        success: false, error: 'Sigma Blaze não configurado'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Fetch ALL clients from Sigma API
    const allClients = await fetchAllClients(config)
    console.log(`[CLEANUP_MAXPLAYER] Total clients fetched: ${allClients.length}`)

    // 3. Separate Blaze IPTV and MaxPlayer clients
    const blazeClients = allClients.filter((c: any) => {
      const pkg = (c.plan_name || c.package_name || c.plano || c.plan || '').toLowerCase()
      return pkg.includes('blaze') || pkg.includes('iptv') || pkg.includes('blaze iptv')
    })

    const maxPlayerClients = allClients.filter((c: any) => {
      const pkg = (c.plan_name || c.package_name || c.plano || c.plan || '').toLowerCase()
      return pkg.includes('maxplayer') || pkg.includes('max player') || pkg.includes('max_player')
    })

    console.log(`[CLEANUP_MAXPLAYER] Blaze IPTV clients: ${blazeClients.length}`)
    console.log(`[CLEANUP_MAXPLAYER] MaxPlayer clients: ${maxPlayerClients.length}`)

    // 4. Find Blaze IPTV clients with expiration > 5 days
    const now = new Date()
    const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)

    const blazeWithGoodExpiration = blazeClients.filter((c: any) => {
      const expDate = new Date(c.expiration_date || c.exp_date || c.expires_at || c.data_expiracao || c.due_date || '1970-01-01')
      return expDate > fiveDaysFromNow
    })

    console.log(`[CLEANUP_MAXPLAYER] Blaze clients with >5 days expiration: ${blazeWithGoodExpiration.length}`)

    // 5. Build a set of usernames from qualifying Blaze clients
    const blazeUsernames = new Set<string>()
    for (const c of blazeWithGoodExpiration) {
      const username = (c.username || c.login || c.user || c.nome_usuario || '').toLowerCase().trim()
      if (username) {
        blazeUsernames.add(username)
      }
    }

    // 6. Find MaxPlayer clients whose username matches a qualifying Blaze client
    const toDelete: any[] = []
    for (const c of maxPlayerClients) {
      const username = (c.username || c.login || c.user || c.nome_usuario || '').toLowerCase().trim()
      if (username && blazeUsernames.has(username)) {
        toDelete.push(c)
      }
    }

    console.log(`[CLEANUP_MAXPLAYER] MaxPlayer clients to delete: ${toDelete.length}`)

    // 7. Delete each MaxPlayer client via Sigma API
    let deleted = 0
    let errors = 0
    const deletedDetails: any[] = []

    for (const client of toDelete) {
      const clientId = String(client.id || client.client_id || client.user_id || '')
      const username = client.username || client.login || client.user || client.nome_usuario || ''

      try {
        const result = await callSigmaAPI(config, 'DELETE', `/clients/${clientId}`)
        
        if (result.ok) {
          deleted++
          deletedDetails.push({ id: clientId, username, status: 'deleted' })
          console.log(`[CLEANUP_MAXPLAYER] Deleted MaxPlayer client: ${username} (ID: ${clientId})`)
        } else {
          errors++
          deletedDetails.push({ id: clientId, username, status: 'error', error: result.data })
          console.error(`[CLEANUP_MAXPLAYER] Failed to delete ${username}: ${JSON.stringify(result.data)}`)
        }
      } catch (e) {
        errors++
        deletedDetails.push({ id: clientId, username, status: 'error', error: (e as Error).message })
        console.error(`[CLEANUP_MAXPLAYER] Error deleting ${username}:`, e)
      }
    }

    // 8. Log the operation
    await supabase.from('sigma_blaze_logs').insert({
      action: 'cleanup-maxplayer',
      status: errors === 0 ? 'SUCCESS' : 'PARTIAL',
      details: {
        total_clients: allClients.length,
        blaze_clients: blazeClients.length,
        maxplayer_clients: maxPlayerClients.length,
        blaze_qualifying: blazeWithGoodExpiration.length,
        matched: toDelete.length,
        deleted,
        errors,
        details: deletedDetails,
      }
    })

    return new Response(JSON.stringify({
      success: true,
      message: `${deleted} clientes MaxPlayer excluídos, ${errors} erros`,
      deleted,
      errors,
      matched: toDelete.length,
      details: deletedDetails,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[CLEANUP_MAXPLAYER] Error:', error)
    return new Response(JSON.stringify({
      success: false, error: (error as Error).message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

async function fetchAllClients(config: any): Promise<any[]> {
  let allClients: any[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const result = await callSigmaAPI(config, 'GET', `/clients?page=${page}&per_page=100`)
    
    if (!result.ok) {
      const altResult = await callSigmaAPI(config, 'GET', `/users?page=${page}&limit=100`)
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

  return allClients
}

function extractClientArray(data: any): any[] {
  if (Array.isArray(data)) return data
  if (data?.data) return Array.isArray(data.data) ? data.data : []
  if (data?.clients) return Array.isArray(data.clients) ? data.clients : []
  if (data?.users) return Array.isArray(data.users) ? data.users : []
  return []
}

async function callSigmaAPI(
  config: any,
  method: string,
  path: string,
  body?: any
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const url = `${config.api_url}${path}`
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`,
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
