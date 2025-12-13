#!/bin/bash

# ============================================
# IPTV Phase 1 Edge Functions Deployment
# Deploys Connection Pool and Read Replica via Coolify
# ============================================

set -e

# Colors
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
COOLIFY_API_URL="${COOLIFY_API_URL:-https://dashboard.iptvlink.com.br}"
COOLIFY_API_TOKEN="${COOLIFY_API_TOKEN:-}"
VPS_HOST="${VPS_HOST:-srv1182856.hstgr.cloud}"
VPS_USER="${VPS_USER:-root}"
FUNCTIONS_PATH="/root/supabase/docker/volumes/functions"

# Copy functions to VPS
deploy_edge_functions() {
  log_info "Deploying Edge Functions to self-hosted Supabase..."
  
  # Create temp directory with functions
  TEMP_DIR=$(mktemp -d)
  
  # Copy new Phase 1 functions
  cp -r supabase/functions/iptv-connection-pool "$TEMP_DIR/"
  cp -r supabase/functions/iptv-read-replica "$TEMP_DIR/"
  
  # Also include shared dependencies if they exist
  if [ -d "supabase/functions/_shared" ]; then
    cp -r supabase/functions/_shared "$TEMP_DIR/"
  fi
  
  log_info "Copying functions to VPS..."
  
  # SCP to VPS
  scp -r "$TEMP_DIR"/* "$VPS_USER@$VPS_HOST:$FUNCTIONS_PATH/"
  
  # Cleanup
  rm -rf "$TEMP_DIR"
  
  log_success "Functions copied to VPS"
}

# Restart edge-runtime via Coolify API
restart_edge_runtime() {
  log_info "Restarting edge-runtime service..."
  
  if [ -n "$COOLIFY_API_TOKEN" ]; then
    # Use Coolify API
    curl -X POST "$COOLIFY_API_URL/api/v1/services/vcs0c0k8kww48kgws44swkk0/restart" \
      -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
      -H "Content-Type: application/json" \
      && log_success "Edge runtime restart triggered via Coolify API"
  else
    # Direct SSH restart
    log_info "Restarting via SSH..."
    ssh "$VPS_USER@$VPS_HOST" << 'ENDSSH'
      cd /root/supabase/docker
      docker compose restart functions
      echo "Edge runtime restarted"
ENDSSH
    log_success "Edge runtime restarted via SSH"
  fi
}

# Verify deployment
verify_deployment() {
  log_info "Verifying Edge Function deployment..."
  
  SUPABASE_URL="${SUPABASE_URL:-https://supabase.iptvlink.com.br}"
  
  sleep 5  # Wait for restart
  
  # Test connection-pool
  POOL_RESPONSE=$(curl -sf "$SUPABASE_URL/functions/v1/iptv-connection-pool/health" 2>/dev/null || echo "")
  if echo "$POOL_RESPONSE" | grep -q "success"; then
    log_success "iptv-connection-pool: HEALTHY"
  else
    log_warn "iptv-connection-pool: Pending (may need a few more seconds)"
  fi
  
  # Test read-replica
  REPLICA_RESPONSE=$(curl -sf "$SUPABASE_URL/functions/v1/iptv-read-replica/health" 2>/dev/null || echo "")
  if echo "$REPLICA_RESPONSE" | grep -q "success"; then
    log_success "iptv-read-replica: HEALTHY"
  else
    log_warn "iptv-read-replica: Pending (may need a few more seconds)"
  fi
}

# Main
main() {
  echo ""
  echo "============================================"
  echo "  IPTV Phase 1 Edge Functions Deployment"
  echo "============================================"
  echo ""
  
  # Check SSH access
  if ! ssh -o ConnectTimeout=5 "$VPS_USER@$VPS_HOST" exit 2>/dev/null; then
    log_error "Cannot connect to VPS. Check SSH configuration."
    log_info "Ensure SSH key is configured for $VPS_USER@$VPS_HOST"
    exit 1
  fi
  
  deploy_edge_functions
  restart_edge_runtime
  verify_deployment
  
  echo ""
  echo "============================================"
  echo "  Edge Functions Deployed!"
  echo "============================================"
  echo ""
  log_success "iptv-connection-pool: $SUPABASE_URL/functions/v1/iptv-connection-pool"
  log_success "iptv-read-replica: $SUPABASE_URL/functions/v1/iptv-read-replica"
  echo ""
}

main "$@"
