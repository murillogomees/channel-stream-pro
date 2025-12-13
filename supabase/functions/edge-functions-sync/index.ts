/**
 * Edge Functions Sync - Sincroniza Edge Functions do GitHub para o Coolify
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COOLIFY_API_URL = 'https://dashboard.iptvlink.com.br/api/v1';
const COOLIFY_API_TOKEN = '1|qLEkDTd54DKQvSTZRY6FA3aYMdIYfbBv06ClAHGiaeeac3fa';
const SUPABASE_SERVICE_UUID = 'vcs0c0k8kww48kgws44swkk0';
const GITHUB_REPO = 'AcessoAI/tv-acessoai-hub';
const GITHUB_BRANCH = 'main';

interface FunctionInfo {
  name: string;
  path: string;
  size?: number;
  hasIndex: boolean;
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

async function fetchGitHubTree(): Promise<any[]> {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`,
    {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Lovable-Edge-Function',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.tree || [];
}

function parseEdgeFunctions(tree: any[]): FunctionInfo[] {
  const functions: Map<string, FunctionInfo> = new Map();
  
  for (const item of tree) {
    if (item.path.startsWith('supabase/functions/') && !item.path.includes('_shared')) {
      const parts = item.path.split('/');
      if (parts.length >= 3) {
        const funcName = parts[2];
        
        if (funcName && funcName !== 'functions') {
          if (!functions.has(funcName)) {
            functions.set(funcName, {
              name: funcName,
              path: `supabase/functions/${funcName}`,
              hasIndex: false,
            });
          }
          
          if (item.path.endsWith('index.ts')) {
            const func = functions.get(funcName)!;
            func.hasIndex = true;
            func.size = item.size;
          }
        }
      }
    }
  }
  
  return Array.from(functions.values()).filter(f => f.hasIndex);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get('action') || 'list';

    console.log(`[edge-functions-sync] Action: ${action}`);

    // Listar funções do GitHub
    if (action === 'list' || action === 'list-github') {
      const tree = await fetchGitHubTree();
      const functions = parseEdgeFunctions(tree);
      
      return new Response(JSON.stringify({
        success: true,
        source: 'github',
        repo: GITHUB_REPO,
        branch: GITHUB_BRANCH,
        count: functions.length,
        functions: functions.sort((a, b) => a.name.localeCompare(b.name)),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar status do edge-runtime no Coolify
    if (action === 'status') {
      const result = await callCoolifyAPI(`/services/${SUPABASE_SERVICE_UUID}`);
      
      const applications = result.data?.applications || [];
      const edgeRuntime = applications.find((app: any) => 
        app.image?.includes('edge-runtime')
      );
      
      // Também listar funções do GitHub para comparação
      const tree = await fetchGitHubTree();
      const githubFunctions = parseEdgeFunctions(tree);
      
      return new Response(JSON.stringify({
        success: true,
        edge_runtime: edgeRuntime ? {
          name: edgeRuntime.name,
          status: edgeRuntime.status,
          image: edgeRuntime.image,
          last_online: edgeRuntime.last_online_at,
        } : null,
        github_functions: githubFunctions.length,
        service_uuid: SUPABASE_SERVICE_UUID,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Gerar script de deploy
    if (action === 'generate-deploy-script') {
      const tree = await fetchGitHubTree();
      const functions = parseEdgeFunctions(tree);
      
      const script = `#!/bin/bash
# Auto-generated Edge Functions Deploy Script
# Generated at: ${new Date().toISOString()}
# Functions count: ${functions.length}

set -e

echo "🚀 Deploying ${functions.length} Edge Functions..."

# Clone repository
cd /tmp
rm -rf lovable-deploy
git clone --depth 1 https://github.com/${GITHUB_REPO}.git lovable-deploy

# Find functions volume
FUNCTIONS_VOL=$(docker volume inspect --format '{{ .Mountpoint }}' $(docker volume ls -q | grep functions | head -1) 2>/dev/null)
if [ -z "$FUNCTIONS_VOL" ]; then
  FUNCTIONS_VOL="/data/coolify/services/${SUPABASE_SERVICE_UUID}/volumes/functions"
fi

echo "📁 Copying to: $FUNCTIONS_VOL"
mkdir -p $FUNCTIONS_VOL

# Copy functions
cp -r /tmp/lovable-deploy/supabase/functions/* $FUNCTIONS_VOL/

# Restart edge-runtime
echo "🔄 Restarting edge-runtime..."
docker restart $(docker ps -q --filter "ancestor=supabase/edge-runtime:v1.67.4" | head -1)

echo "✅ Deploy complete!"
echo ""
echo "Functions deployed:"
${functions.map(f => `echo "  - ${f.name}"`).join('\n')}
`;

      return new Response(JSON.stringify({
        success: true,
        script,
        functions_count: functions.length,
        instructions: [
          'Salve este script como deploy.sh',
          'Execute: chmod +x deploy.sh && ./deploy.sh',
          'Ou cole diretamente no terminal SSH',
        ],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Trigger deploy via Coolify restart
    if (action === 'trigger-restart') {
      const result = await callCoolifyAPI(`/services/${SUPABASE_SERVICE_UUID}/restart`, 'POST');
      
      return new Response(JSON.stringify({
        success: result.status === 200,
        message: result.data?.message || 'Restart queued',
        note: 'Para deploy completo, execute o script de deploy no VPS',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Comparar funções locais vs GitHub
    if (action === 'compare') {
      const tree = await fetchGitHubTree();
      const githubFunctions = parseEdgeFunctions(tree);
      
      // Verificar quais funções estão disponíveis localmente
      const localFunctions: string[] = [];
      const testFunctions = ['main', 'health-check', 'custom-auth', 'deploy-webhook'];
      
      for (const funcName of testFunctions) {
        try {
          // Tentar fazer uma requisição OPTIONS para verificar se existe
          const testUrl = `${Deno.env.get('SUPABASE_URL') || 'https://supabase.iptvlink.com.br'}/functions/v1/${funcName}`;
          const resp = await fetch(testUrl, { method: 'OPTIONS' });
          if (resp.ok) {
            localFunctions.push(funcName);
          }
        } catch {
          // Função não existe ou erro de rede
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        github: {
          count: githubFunctions.length,
          functions: githubFunctions.map(f => f.name),
        },
        local_sample: {
          tested: testFunctions,
          available: localFunctions,
        },
        sync_needed: githubFunctions.length > localFunctions.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: 'Unknown action',
      available_actions: ['list', 'status', 'generate-deploy-script', 'trigger-restart', 'compare'],
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[edge-functions-sync] Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
