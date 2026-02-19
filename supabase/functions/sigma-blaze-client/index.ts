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

  // Auth check
  const authHeader = req.headers.get('Authorization')
  const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader || '' } }
  })

  // Service client for DB operations
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const body: SigmaRequest = await req.json()
    const { action, user_id, email, name, plan_id, sigma_client_id } = body

    // Check feature flag for this action
    const flagMap: Record<string, string> = {
      'create': 'SIGMA_AUTO_CREATE_CLIENT',
      'delete': 'SIGMA_AUTO_DELETE_CLIENT',
      'update-package': 'SIGMA_AUTO_UPDATE_PACKAGE',
      'sync': 'SIGMA_AUTO_CREATE_CLIENT',
      'list-all': 'SIGMA_AUTO_CREATE_CLIENT',
    }

    const flagName = flagMap[action]
    if (!flagName) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // For list-all, skip feature flag check (admin-only action)
    if (action !== 'list-all') {
      const { data: flag } = await supabase
        .from('feature_flag_config')
        .select('enabled')
        .eq('flag_name', flagName)
        .single()

      if (!flag?.enabled) {
        await logAction(supabase, action, 'SKIPPED_BY_FEATURE_FLAG', user_id, {
          reason: `Flag ${flagName} is disabled`
        })
        return new Response(JSON.stringify({
          success: false, status: 'SKIPPED_BY_FEATURE_FLAG',
          message: `Flag ${flagName} está desabilitada`
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Get Sigma config
    const { data: config } = await supabase
      .from('sigma_blaze_config')
      .select('*')
      .limit(1)
      .single()

    if (!config?.api_url || !config?.api_key) {
      await logAction(supabase, action, 'ERROR', user_id, {
        error: 'Sigma Blaze config not set'
      })
      return new Response(JSON.stringify({
        success: false, error: 'Sigma Blaze não configurado. Configure a URL e API Key na aba Sigma Blaze.'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let result: any = null

    switch (action) {
      case 'create': {
        result = await callSigmaAPI(config, 'POST', '/clients', {
          email, name, user_id
        })
        break
      }
      case 'delete': {
        result = await callSigmaAPI(config, 'DELETE', `/clients/${sigma_client_id}`)
        break
      }
      case 'update-package': {
        const { data: mapping } = await supabase
          .from('subscription_package_mapping')
          .select('*')
          .eq('internal_plan_id', plan_id)
          .eq('is_active', true)
          .single()

        if (!mapping) {
          await logAction(supabase, action, 'ERROR', user_id, {
            error: 'No package mapping found', plan_id
          })
          return new Response(JSON.stringify({
            success: false, error: 'Mapeamento de pacote não encontrado'
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        result = await callSigmaAPI(config, 'PUT', `/clients/${sigma_client_id}/package`, {
          package_id: mapping.sigma_package_id
        })
        break
      }
      case 'sync': {
        result = await callSigmaAPI(config, 'GET', `/clients/${sigma_client_id || user_id}`)
        break
      }
      case 'list-all': {
        return await handleListAll(supabase, config, corsHeaders)
      }
    }

    const status = result?.ok ? 'SUCCESS' : 'ERROR'
    await logAction(supabase, action, status, user_id, {
      response: result?.data,
      http_status: result?.status
    })

    return new Response(JSON.stringify({
      success: result?.ok, status, data: result?.data
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[SIGMA_BLAZE] Error:', error)
    return new Response(JSON.stringify({
      success: false, error: error.message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

async function handleListAll(supabase: any, config: any, headers: any) {
  try {
    let allClients: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const result = await callSigmaAPI(config, 'GET', `/clients?page=${page}&per_page=100`)
      
      if (!result.ok) {
        const altResult = await callSigmaAPI(config, 'GET', `/users?page=${page}&limit=100`)
        if (altResult.ok && altResult.data) {
          const clients = Array.isArray(altResult.data) ? altResult.data : 
                          altResult.data?.data ? altResult.data.data :
                          altResult.data?.clients ? altResult.data.clients :
                          altResult.data?.users ? altResult.data.users : []
          allClients = allClients.concat(clients)
          hasMore = clients.length >= 100
        } else {
          hasMore = false
        }
      } else {
        const clients = Array.isArray(result.data) ? result.data :
                        result.data?.data ? result.data.data :
                        result.data?.clients ? result.data.clients :
                        result.data?.users ? result.data.users : []
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

    // Retorna os clientes diretamente sem salvar em tabela
    return new Response(JSON.stringify({
      success: true,
      clients: allClients,
      total: allClients.length,
      message: `${allClients.length} clientes encontrados`
    }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[SIGMA_BLAZE] List all error:', error)
    await logAction(supabase, 'list-all', 'ERROR', undefined, { error: error.message })
    return new Response(JSON.stringify({
      success: false, error: error.message
    }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } })
  }
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
    return { ok: false, status: 0, data: { error: error.message } }
  }
}

async function logAction(
  supabase: any,
  action: string,
  status: string,
  user_id?: string,
  details?: any
) {
  await supabase.from('sigma_blaze_logs').insert({
    action, status, user_id, details: details || {}
  })
}