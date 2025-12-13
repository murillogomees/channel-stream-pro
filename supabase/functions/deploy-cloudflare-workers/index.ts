import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COOLIFY_URL = "https://dashboard.iptvlink.com.br";
const COOLIFY_TOKEN = Deno.env.get('COOLIFY_API_TOKEN') || '';

interface DeployRequest {
  action: 'deploy-workers' | 'create-kv-namespaces' | 'check-status';
  workers?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request = await req.json() as DeployRequest;
    console.log(`[deploy-cloudflare-workers] Action: ${request.action}`);

    // Get server list to find the VPS
    const serversResponse = await fetch(`${COOLIFY_URL}/api/v1/servers`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${COOLIFY_TOKEN}`,
        'Accept': 'application/json',
      },
    });

    if (!serversResponse.ok) {
      throw new Error(`Failed to get servers: ${serversResponse.status}`);
    }

    const servers = await serversResponse.json();
    console.log(`[deploy-cloudflare-workers] Found ${servers.length} servers`);

    // Find the main VPS server
    const vpsServer = servers.find((s: any) => s.name?.includes('VPS') || s.ip);
    
    if (!vpsServer) {
      return new Response(JSON.stringify({
        success: false,
        error: 'VPS server not found in Coolify',
        servers: servers.map((s: any) => ({ name: s.name, uuid: s.uuid })),
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[deploy-cloudflare-workers] VPS Server: ${vpsServer.name} (${vpsServer.uuid})`);

    // Try to execute command via Coolify execute-command endpoint
    const deployScript = `
#!/bin/bash
set -e

echo "🚀 Starting Cloudflare Workers deployment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "📦 Installing wrangler..."
    npm install -g wrangler
fi

echo "✅ Prerequisites verified"

# Clone/pull the repository
REPO_DIR="/tmp/iptv-workers"
REPO_URL="https://github.com/AcessoAI/tv-acessoai-hub.git"

rm -rf $REPO_DIR
git clone --depth 1 $REPO_URL $REPO_DIR

cd $REPO_DIR/workers

# Create KV namespaces if they don't exist
echo "📦 Creating KV namespaces..."

create_kv_if_not_exists() {
    local name=$1
    local result=$(wrangler kv:namespace list 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -z "$result" ]; then
        wrangler kv:namespace create "$name" 2>/dev/null || true
    fi
}

create_kv_if_not_exists "RATE_LIMIT_KV"
create_kv_if_not_exists "BLOCKED_IPS_KV"
create_kv_if_not_exists "ORIGINS_KV"
create_kv_if_not_exists "HEALTH_KV"

# Deploy rate-limiter-worker
if [ -d "rate-limiter-worker" ]; then
    echo "🚀 Deploying rate-limiter-worker..."
    cd rate-limiter-worker
    npm install 2>/dev/null || true
    wrangler deploy --name iptv-rate-limiter || echo "⚠️ Rate limiter deploy failed"
    cd ..
fi

# Deploy origin-failover-worker
if [ -d "origin-failover-worker" ]; then
    echo "🚀 Deploying origin-failover-worker..."
    cd origin-failover-worker
    npm install 2>/dev/null || true
    wrangler deploy --name iptv-origin-failover || echo "⚠️ Origin failover deploy failed"
    cd ..
fi

# Cleanup
rm -rf $REPO_DIR

echo "🎉 Deployment complete!"
`;

    // Try to execute via Coolify API command execution
    // Note: Coolify may not support direct command execution for security
    // We'll return the script for manual execution or trigger via webhook

    const result = {
      success: true,
      server: {
        name: vpsServer.name,
        uuid: vpsServer.uuid,
        ip: vpsServer.ip,
      },
      message: 'Deploy script generated. Execute via SSH or GitHub Actions.',
      script: deployScript,
      manual_commands: [
        'ssh root@VPS_IP "bash -s" < deploy-script.sh',
        'Or trigger GitHub Actions: .github/workflows/deploy-cloudflare-workers.yml',
      ],
      github_actions_trigger: {
        url: 'https://api.github.com/repos/AcessoAI/tv-acessoai-hub/actions/workflows/deploy-cloudflare-workers.yml/dispatches',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer GITHUB_TOKEN',
          'Accept': 'application/vnd.github.v3+json',
        },
        body: {
          ref: 'main',
          inputs: { worker: 'all' },
        },
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[deploy-cloudflare-workers] Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
