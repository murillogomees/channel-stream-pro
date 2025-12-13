/**
 * Deploy Webhook - Automatiza o deploy de Edge Functions
 * Chamado via webhook do GitHub ou manualmente
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const COOLIFY_API_URL = 'https://dashboard.iptvlink.com.br/api/v1';
const COOLIFY_API_TOKEN = '1|qLEkDTd54DKQvSTZRY6FA3aYMdIYfbBv06ClAHGiaeeac3fa';
const SUPABASE_SERVICE_UUID = 'vcs0c0k8kww48kgws44swkk0';

async function callCoolifyAPI(endpoint: string, method: string = 'GET', body?: object) {
  const response = await fetch(`${COOLIFY_API_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${COOLIFY_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  return {
    status: response.status,
    data: await response.json().catch(() => null),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get('DEPLOY_WEBHOOK_SECRET') || 'deploy-secret-2024';
    const providedSecret = req.headers.get('x-webhook-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
    
    // Validar secret (opcional para chamadas internas)
    const url = new URL(req.url);
    const skipAuth = url.searchParams.get('internal') === 'true';
    
    if (!skipAuth && providedSecret !== webhookSecret) {
      console.log('[deploy-webhook] Invalid secret provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || url.searchParams.get('action') || 'status';

    console.log(`[deploy-webhook] Action: ${action}`);

    if (action === 'status') {
      // Verificar status do serviço Supabase
      const result = await callCoolifyAPI(`/services/${SUPABASE_SERVICE_UUID}`);
      
      const applications = result.data?.applications || [];
      const edgeRuntime = applications.find((app: any) => 
        app.name?.includes('functions') || app.image?.includes('edge-runtime')
      );
      
      return new Response(JSON.stringify({
        success: true,
        service: {
          uuid: SUPABASE_SERVICE_UUID,
          name: result.data?.name,
          edge_runtime: edgeRuntime ? {
            name: edgeRuntime.name,
            status: edgeRuntime.status,
            image: edgeRuntime.image,
            last_online: edgeRuntime.last_online_at,
          } : null,
          applications_count: applications.length,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'restart') {
      // Reiniciar o serviço Supabase (inclui edge-runtime)
      console.log('[deploy-webhook] Restarting Supabase service...');
      
      const result = await callCoolifyAPI(`/services/${SUPABASE_SERVICE_UUID}/restart`, 'POST');
      
      return new Response(JSON.stringify({
        success: result.status === 200,
        message: result.data?.message || 'Restart queued',
        coolify_response: result,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'deploy') {
      // Deploy completo: informar passos necessários
      console.log('[deploy-webhook] Deploy requested');
      
      // 1. Verificar status atual
      const statusResult = await callCoolifyAPI(`/services/${SUPABASE_SERVICE_UUID}`);
      
      // 2. Solicitar restart
      const restartResult = await callCoolifyAPI(`/services/${SUPABASE_SERVICE_UUID}/restart`, 'POST');
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Deploy iniciado',
        steps: [
          { step: 1, action: 'status_check', result: 'ok' },
          { step: 2, action: 'restart_queued', result: restartResult.data?.message },
        ],
        instructions: [
          'Para deploy completo, execute no VPS:',
          'cd /tmp && git clone --depth 1 https://github.com/AcessoAI/tv-acessoai-hub.git lovable-deploy',
          'cp -r /tmp/lovable-deploy/supabase/functions/* /data/coolify/services/*/volumes/functions/',
          'O restart já foi solicitado via Coolify API',
        ],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'github-webhook') {
      // Handler para webhook do GitHub
      const event = req.headers.get('x-github-event');
      const payload = body;
      
      console.log(`[deploy-webhook] GitHub event: ${event}`);
      
      if (event === 'push' && payload.ref === 'refs/heads/main') {
        // Push na main - solicitar restart
        const restartResult = await callCoolifyAPI(`/services/${SUPABASE_SERVICE_UUID}/restart`, 'POST');
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Restart solicitado após push na main',
          commit: payload.head_commit?.id,
          author: payload.head_commit?.author?.name,
          restart_result: restartResult.data,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Webhook recebido mas não requer ação',
        event,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: 'Unknown action',
      available_actions: ['status', 'restart', 'deploy', 'github-webhook'],
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[deploy-webhook] Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
