import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SigmaRequest {
  action: 'create' | 'delete' | 'update-package' | 'sync'
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
      'sync': 'SIGMA_AUTO_CREATE_CLIENT', // sync uses create flag
    }

    const flagName = flagMap[action]
    if (!flagName) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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
        success: false, error: 'Sigma Blaze não configurado'
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
        // Get mapping
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
