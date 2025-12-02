#!/bin/bash

# ============================================
# Cloudflare Worker - CDN Router Deployment Script
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting CDN Router deployment..."

# ============================================
# STEP 1: Verify wrangler installation
# ============================================
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler CLI not found"
    echo "Install: npm install -g wrangler"
    exit 1
fi

echo "✅ Wrangler CLI found"

# ============================================
# STEP 2: Login check
# ============================================
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  Not logged in to Cloudflare"
    echo "Run: wrangler login"
    exit 1
fi

echo "✅ Authenticated with Cloudflare"

# ============================================
# STEP 3: Configure secrets (production)
# ============================================
echo ""
echo "📝 Configuring production secrets..."
echo ""
echo "You'll need to provide the following secrets:"
echo "  1. JWT_SECRET (same as STREAM_PROXY_SECRET from Supabase)"
echo "  2. SUPABASE_URL (your Supabase project URL)"
echo "  3. SUPABASE_ANON_KEY (your Supabase anon key)"
echo ""

read -p "Do you want to configure secrets now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Setting JWT_SECRET..."
    wrangler secret put JWT_SECRET --env production
    
    echo ""
    echo "Setting SUPABASE_URL..."
    wrangler secret put SUPABASE_URL --env production
    
    echo ""
    echo "Setting SUPABASE_ANON_KEY..."
    wrangler secret put SUPABASE_ANON_KEY --env production
    
    echo "✅ Secrets configured"
else
    echo "⚠️  Skipping secret configuration"
    echo "   You can configure them later with:"
    echo "   wrangler secret put <SECRET_NAME> --env production"
fi

# ============================================
# STEP 4: Deploy to staging (optional)
# ============================================
echo ""
read -p "Deploy to staging first? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Deploying to staging..."
    wrangler deploy --env staging
    
    echo ""
    echo "✅ Staging deployment complete!"
    echo "   Test URL: https://iptvlink-cdn-router-staging.<your-subdomain>.workers.dev"
    echo ""
    read -p "Continue to production? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "⏸️  Production deployment cancelled"
        exit 0
    fi
fi

# ============================================
# STEP 5: Deploy to production
# ============================================
echo ""
echo "🚀 Deploying to production..."
wrangler deploy --env production

# ============================================
# STEP 6: Verify deployment
# ============================================
echo ""
echo "✅ Production deployment complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Configure custom domain in Cloudflare dashboard"
echo "  2. Set up route pattern: cdn.iptvlink.com/*"
echo "  3. Bind R2 bucket 'iptvlink-cdn' to R2_BUCKET"
echo "  4. Test manifest URL: https://cdn.iptvlink.com/path/to/manifest.m3u8?jwt=<token>"
echo "  5. Monitor in Cloudflare dashboard: Workers & Pages > cdn-router"
echo ""
echo "🔍 Health check:"
echo "   curl -I https://<your-worker-url>.workers.dev/health"
echo ""
echo "📊 View logs:"
echo "   wrangler tail --env production"
echo ""
