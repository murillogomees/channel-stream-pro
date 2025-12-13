#!/bin/bash

# ============================================
# IPTV Phase 1 Workers Deployment Script
# Deploys Rate Limiter and Origin Failover Workers
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
SUPABASE_URL="${SUPABASE_URL:-https://supabase.iptvlink.com.br}"
WORKER_SECRET="${WORKER_SECRET:-$(openssl rand -hex 32)}"

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."
  
  if ! command -v wrangler &> /dev/null; then
    log_error "Wrangler CLI not found. Install with: npm install -g wrangler"
    exit 1
  fi
  
  if ! wrangler whoami &> /dev/null; then
    log_warn "Not logged into Cloudflare. Running: wrangler login"
    wrangler login
  fi
  
  log_success "Prerequisites OK"
}

# Create KV Namespaces
create_kv_namespaces() {
  log_info "Creating KV Namespaces..."
  
  # Rate Limiter KV
  RATE_LIMIT_KV_ID=$(wrangler kv:namespace create "RATE_LIMIT_KV" --json 2>/dev/null | jq -r '.id' || echo "")
  if [ -z "$RATE_LIMIT_KV_ID" ]; then
    log_warn "RATE_LIMIT_KV may already exist, fetching..."
    RATE_LIMIT_KV_ID=$(wrangler kv:namespace list --json | jq -r '.[] | select(.title | contains("RATE_LIMIT_KV")) | .id' | head -1)
  fi
  log_success "RATE_LIMIT_KV: $RATE_LIMIT_KV_ID"
  
  # Blocked IPs KV
  BLOCKED_IPS_KV_ID=$(wrangler kv:namespace create "BLOCKED_IPS_KV" --json 2>/dev/null | jq -r '.id' || echo "")
  if [ -z "$BLOCKED_IPS_KV_ID" ]; then
    log_warn "BLOCKED_IPS_KV may already exist, fetching..."
    BLOCKED_IPS_KV_ID=$(wrangler kv:namespace list --json | jq -r '.[] | select(.title | contains("BLOCKED_IPS_KV")) | .id' | head -1)
  fi
  log_success "BLOCKED_IPS_KV: $BLOCKED_IPS_KV_ID"
  
  # Origins KV
  ORIGINS_KV_ID=$(wrangler kv:namespace create "ORIGINS_KV" --json 2>/dev/null | jq -r '.id' || echo "")
  if [ -z "$ORIGINS_KV_ID" ]; then
    log_warn "ORIGINS_KV may already exist, fetching..."
    ORIGINS_KV_ID=$(wrangler kv:namespace list --json | jq -r '.[] | select(.title | contains("ORIGINS_KV")) | .id' | head -1)
  fi
  log_success "ORIGINS_KV: $ORIGINS_KV_ID"
  
  # Health KV
  HEALTH_KV_ID=$(wrangler kv:namespace create "HEALTH_KV" --json 2>/dev/null | jq -r '.id' || echo "")
  if [ -z "$HEALTH_KV_ID" ]; then
    log_warn "HEALTH_KV may already exist, fetching..."
    HEALTH_KV_ID=$(wrangler kv:namespace list --json | jq -r '.[] | select(.title | contains("HEALTH_KV")) | .id' | head -1)
  fi
  log_success "HEALTH_KV: $HEALTH_KV_ID"
  
  # Export for later use
  export RATE_LIMIT_KV_ID BLOCKED_IPS_KV_ID ORIGINS_KV_ID HEALTH_KV_ID
}

# Update wrangler.toml with KV IDs
update_wrangler_configs() {
  log_info "Updating wrangler.toml files with KV namespace IDs..."
  
  # Rate Limiter Worker
  sed -i.bak "s/YOUR_RATE_LIMIT_KV_ID/$RATE_LIMIT_KV_ID/g" workers/rate-limiter-worker/wrangler.toml
  sed -i.bak "s/YOUR_RATE_LIMIT_KV_PREVIEW_ID/$RATE_LIMIT_KV_ID/g" workers/rate-limiter-worker/wrangler.toml
  sed -i.bak "s/YOUR_BLOCKED_IPS_KV_ID/$BLOCKED_IPS_KV_ID/g" workers/rate-limiter-worker/wrangler.toml
  sed -i.bak "s/YOUR_BLOCKED_IPS_KV_PREVIEW_ID/$BLOCKED_IPS_KV_ID/g" workers/rate-limiter-worker/wrangler.toml
  rm -f workers/rate-limiter-worker/wrangler.toml.bak
  
  # Origin Failover Worker
  sed -i.bak "s/YOUR_ORIGINS_KV_ID/$ORIGINS_KV_ID/g" workers/origin-failover-worker/wrangler.toml
  sed -i.bak "s/YOUR_ORIGINS_KV_PREVIEW_ID/$ORIGINS_KV_ID/g" workers/origin-failover-worker/wrangler.toml
  sed -i.bak "s/YOUR_HEALTH_KV_ID/$HEALTH_KV_ID/g" workers/origin-failover-worker/wrangler.toml
  sed -i.bak "s/YOUR_HEALTH_KV_PREVIEW_ID/$HEALTH_KV_ID/g" workers/origin-failover-worker/wrangler.toml
  rm -f workers/origin-failover-worker/wrangler.toml.bak
  
  log_success "wrangler.toml files updated"
}

# Configure secrets for workers
configure_secrets() {
  log_info "Configuring worker secrets..."
  
  # Generate shared worker secret if not provided
  if [ -z "$WORKER_SECRET" ]; then
    WORKER_SECRET=$(openssl rand -hex 32)
    log_info "Generated WORKER_SECRET: $WORKER_SECRET"
  fi
  
  # Rate Limiter Worker secrets
  log_info "Setting secrets for rate-limiter-worker..."
  cd workers/rate-limiter-worker
  echo "$SUPABASE_URL" | wrangler secret put SUPABASE_URL 2>/dev/null || log_warn "SUPABASE_URL may already be set"
  echo "$SUPABASE_SERVICE_ROLE_KEY" | wrangler secret put SUPABASE_SERVICE_ROLE_KEY 2>/dev/null || log_warn "SUPABASE_SERVICE_ROLE_KEY may already be set"
  echo "$WORKER_SECRET" | wrangler secret put WORKER_SECRET 2>/dev/null || log_warn "WORKER_SECRET may already be set"
  cd ../..
  
  # Origin Failover Worker secrets
  log_info "Setting secrets for origin-failover-worker..."
  cd workers/origin-failover-worker
  echo "$SUPABASE_URL" | wrangler secret put SUPABASE_URL 2>/dev/null || log_warn "SUPABASE_URL may already be set"
  echo "$SUPABASE_SERVICE_ROLE_KEY" | wrangler secret put SUPABASE_SERVICE_ROLE_KEY 2>/dev/null || log_warn "SUPABASE_SERVICE_ROLE_KEY may already be set"
  echo "$WORKER_SECRET" | wrangler secret put WORKER_SECRET 2>/dev/null || log_warn "WORKER_SECRET may already be set"
  cd ../..
  
  log_success "Secrets configured"
  
  # Save worker secret for reference
  echo "WORKER_SECRET=$WORKER_SECRET" >> .env.workers
  log_info "Worker secret saved to .env.workers"
}

# Deploy workers
deploy_workers() {
  log_info "Deploying workers to Cloudflare..."
  
  # Deploy Rate Limiter Worker
  log_info "Deploying rate-limiter-worker..."
  cd workers/rate-limiter-worker
  wrangler deploy
  RATE_LIMITER_URL=$(wrangler deployments list --json 2>/dev/null | jq -r '.[0].url' || echo "https://iptv-rate-limiter.workers.dev")
  cd ../..
  log_success "Rate Limiter deployed: $RATE_LIMITER_URL"
  
  # Deploy Origin Failover Worker
  log_info "Deploying origin-failover-worker..."
  cd workers/origin-failover-worker
  wrangler deploy
  FAILOVER_URL=$(wrangler deployments list --json 2>/dev/null | jq -r '.[0].url' || echo "https://iptv-origin-failover.workers.dev")
  cd ../..
  log_success "Origin Failover deployed: $FAILOVER_URL"
  
  # Save URLs
  cat >> .env.workers << EOF
RATE_LIMITER_WORKER_URL=$RATE_LIMITER_URL
ORIGIN_FAILOVER_WORKER_URL=$FAILOVER_URL
EOF
  
  log_success "All workers deployed! URLs saved to .env.workers"
}

# Verify deployment
verify_deployment() {
  log_info "Verifying deployments..."
  
  # Test Rate Limiter health
  if curl -sf "https://iptv-rate-limiter.workers.dev/health" > /dev/null 2>&1; then
    log_success "Rate Limiter: HEALTHY"
  else
    log_warn "Rate Limiter: Health check pending (may take a few seconds)"
  fi
  
  # Test Origin Failover health
  if curl -sf "https://iptv-origin-failover.workers.dev/health" > /dev/null 2>&1; then
    log_success "Origin Failover: HEALTHY"
  else
    log_warn "Origin Failover: Health check pending (may take a few seconds)"
  fi
}

# Main execution
main() {
  echo ""
  echo "============================================"
  echo "  IPTV Phase 1 Workers Deployment"
  echo "============================================"
  echo ""
  
  # Check for required env vars
  if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    log_error "SUPABASE_SERVICE_ROLE_KEY not set!"
    log_info "Run: export SUPABASE_SERVICE_ROLE_KEY='your-key'"
    exit 1
  fi
  
  check_prerequisites
  create_kv_namespaces
  update_wrangler_configs
  configure_secrets
  deploy_workers
  verify_deployment
  
  echo ""
  echo "============================================"
  echo "  Deployment Complete!"
  echo "============================================"
  echo ""
  log_success "Rate Limiter Worker: https://iptv-rate-limiter.workers.dev"
  log_success "Origin Failover Worker: https://iptv-origin-failover.workers.dev"
  echo ""
  log_info "Worker secret saved in .env.workers"
  log_info "Use WORKER_SECRET header for management endpoints"
  echo ""
}

# Run main
main "$@"
