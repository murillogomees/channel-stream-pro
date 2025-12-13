/**
 * Coolify Secrets Manager - Gerencia secrets no Coolify via API
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COOLIFY_API_URL = 'https://dashboard.iptvlink.com.br/api/v1';
const COOLIFY_API_TOKEN = '1|qLEkDTd54DKQvSTZRY6FA3aYMdIYfbBv06ClAHGiaeeac3fa';
const SUPABASE_SERVICE_UUID = 'vcs0c0k8kww48kgws44swkk0';

interface SecretConfig {
  key: string;
  value: string;
  is_preview?: boolean;
}

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
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get('action') || 'list';

    console.log(`[coolify-secrets] Action: ${action}`);

    // Listar variáveis de ambiente do serviço
    if (action === 'list') {
      const result = await callCoolifyAPI(`/services/${SUPABASE_SERVICE_UUID}/envs`);
      
      // Mascarar valores sensíveis
      const envs = (result.data || []).map((env: any) => ({
        id: env.id,
        key: env.key,
        value: env.key.includes('SECRET') || env.key.includes('PASSWORD') || env.key.includes('KEY') 
          ? '••••••••' 
          : env.value,
        is_preview: env.is_preview,
        is_build_time: env.is_build_time,
        created_at: env.created_at,
      }));
      
      return new Response(JSON.stringify({
        success: true,
        count: envs.length,
        envs,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Adicionar/atualizar secret
    if (action === 'set') {
      const { key, value, is_preview = false } = body as SecretConfig;
      
      if (!key || !value) {
        return new Response(JSON.stringify({
          error: 'key and value are required',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Tentar criar ou atualizar
      const result = await callCoolifyAPI(`/services/${SUPABASE_SERVICE_UUID}/envs`, 'POST', {
        key,
        value,
        is_preview,
        is_build_time: false,
      });

      return new Response(JSON.stringify({
        success: result.status === 200 || result.status === 201,
        message: result.status === 200 || result.status === 201 
          ? `Secret ${key} configurado com sucesso` 
          : 'Falha ao configurar secret',
        coolify_response: result,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deletar secret
    if (action === 'delete') {
      const { id, key } = body;
      
      if (!id) {
        return new Response(JSON.stringify({
          error: 'id is required',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await callCoolifyAPI(`/services/${SUPABASE_SERVICE_UUID}/envs/${id}`, 'DELETE');

      return new Response(JSON.stringify({
        success: result.status === 200 || result.status === 204,
        message: `Secret ${key || id} removido`,
        coolify_response: result,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Bulk set - configurar múltiplos secrets de uma vez
    if (action === 'bulk-set') {
      const { secrets } = body as { secrets: SecretConfig[] };
      
      if (!secrets || !Array.isArray(secrets)) {
        return new Response(JSON.stringify({
          error: 'secrets array is required',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results = [];
      for (const secret of secrets) {
        const result = await callCoolifyAPI(`/services/${SUPABASE_SERVICE_UUID}/envs`, 'POST', {
          key: secret.key,
          value: secret.value,
          is_preview: secret.is_preview || false,
          is_build_time: false,
        });
        results.push({
          key: secret.key,
          success: result.status === 200 || result.status === 201,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        results,
        total: secrets.length,
        succeeded: results.filter(r => r.success).length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sync secrets from Supabase to Coolify
    if (action === 'sync-from-supabase') {
      // Lista de secrets conhecidos que precisam ser sincronizados
      const requiredSecrets = [
        'SELFHOSTED_DB_URL',
        'JWT_SECRET',
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'MERCADO_PAGO_ACCESS_TOKEN',
        'MERCADO_PAGO_WEBHOOK_SECRET',
        'WHATSAPP_APPKEY',
        'WHATSAPP_AUTHKEY',
        'CRON_SECRET',
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_BUCKET_NAME',
        'R2_PUBLIC_DOMAIN',
        'TMDB_API_KEY',
        'CLOUDFLARE_ACCOUNT_ID',
        'CLOUDFLARE_STREAM_API_TOKEN',
        'CLOUDFLARE_STREAM_SIGNING_KEY',
      ];

      // Verificar quais estão configurados localmente
      const configuredSecrets = requiredSecrets.filter(key => Deno.env.get(key));
      const missingSecrets = requiredSecrets.filter(key => !Deno.env.get(key));

      return new Response(JSON.stringify({
        success: true,
        configured: configuredSecrets,
        missing: missingSecrets,
        total_required: requiredSecrets.length,
        message: `${configuredSecrets.length}/${requiredSecrets.length} secrets configurados`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar saúde dos secrets
    if (action === 'health') {
      const criticalSecrets = [
        'SELFHOSTED_DB_URL',
        'JWT_SECRET',
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
      ];

      const status = criticalSecrets.map(key => ({
        key,
        configured: !!Deno.env.get(key),
        preview: Deno.env.get(key)?.substring(0, 10) + '...',
      }));

      const allConfigured = status.every(s => s.configured);

      return new Response(JSON.stringify({
        success: true,
        healthy: allConfigured,
        critical_secrets: status,
        message: allConfigured 
          ? 'Todos os secrets críticos estão configurados' 
          : 'Alguns secrets críticos estão faltando',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: 'Unknown action',
      available_actions: ['list', 'set', 'delete', 'bulk-set', 'sync-from-supabase', 'health'],
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[coolify-secrets] Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
