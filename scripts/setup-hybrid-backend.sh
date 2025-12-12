#!/bin/bash
# ============================================
# HYBRID BACKEND SETUP SCRIPT
# Deploy Edge Functions to Self-Hosted VPS
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================
# CONFIGURATION
# ============================================

VPS_HOST="${VPS_HOST:-srv1182856.hstgr.cloud}"
VPS_USER="${VPS_USER:-root}"
VPS_SUPABASE_DIR="${VPS_SUPABASE_DIR:-/root/supabase/docker}"

# Heavy functions to deploy to self-hosted
HEAVY_FUNCTIONS=(
    "fetch-m3u"
    "fetch-m3u-url"
    "m3u-sync"
    "m3u-cron-sync"
    "m3u-ingest"
    "m3u-playlist"
    "generate-m3u-from-sync"
    "generate-m3u-file"
    "process-m3u-import"
    "clean-m3u"
    "m3u-clean-advanced"
    "clean-sync-entries"
    "stream-proxy"
    "stream-url-resolve"
    "transcode-processor"
    "transcode-webhook"
    "cdn-bulk-downloader"
    "cdn-content-downloader"
    "cdn-prewarm"
    "r2-upload"
    "r2-migration-worker"
    "r2-upload-proxy"
    "iptv-m3u-generator"
    "playlist-cdn-generate"
)

# ============================================
# PRE-FLIGHT CHECKS
# ============================================

preflight_check() {
    log_info "Running pre-flight checks..."
    
    # Check SSH access
    if ! ssh -o ConnectTimeout=5 -o BatchMode=yes ${VPS_USER}@${VPS_HOST} "echo ok" &>/dev/null; then
        log_error "Cannot connect to VPS via SSH"
        log_info "Make sure SSH key is configured for ${VPS_USER}@${VPS_HOST}"
        exit 1
    fi
    log_success "SSH connection verified"
    
    # Check Docker on VPS
    if ! ssh ${VPS_USER}@${VPS_HOST} "docker --version" &>/dev/null; then
        log_error "Docker not found on VPS"
        exit 1
    fi
    log_success "Docker is available on VPS"
    
    # Check local functions directory
    if [ ! -d "supabase/functions" ]; then
        log_error "supabase/functions directory not found"
        exit 1
    fi
    log_success "Local functions directory found"
}

# ============================================
# DEPLOY FUNCTIONS
# ============================================

deploy_functions() {
    log_info "Deploying heavy functions to VPS..."
    
    # Create temp directory for selected functions
    TEMP_DIR=$(mktemp -d)
    log_info "Temporary directory: ${TEMP_DIR}"
    
    # Copy only heavy functions
    for fn in "${HEAVY_FUNCTIONS[@]}"; do
        if [ -d "supabase/functions/${fn}" ]; then
            cp -r "supabase/functions/${fn}" "${TEMP_DIR}/"
            log_success "Copied ${fn}"
        else
            log_warn "Function ${fn} not found locally"
        fi
    done
    
    # Copy shared dependencies if they exist
    if [ -d "supabase/functions/_shared" ]; then
        cp -r "supabase/functions/_shared" "${TEMP_DIR}/"
        log_success "Copied _shared dependencies"
    fi
    
    # Create tarball
    TARBALL="${TEMP_DIR}/functions.tar.gz"
    tar -czf "${TARBALL}" -C "${TEMP_DIR}" .
    log_success "Created functions archive"
    
    # Transfer to VPS
    log_info "Transferring to VPS..."
    scp "${TARBALL}" "${VPS_USER}@${VPS_HOST}:/tmp/functions.tar.gz"
    log_success "Transferred to VPS"
    
    # Extract and deploy on VPS
    log_info "Deploying on VPS..."
    ssh ${VPS_USER}@${VPS_HOST} << 'EOF'
        set -e
        cd /root/supabase/docker
        
        # Backup existing functions
        if [ -d "volumes/functions" ]; then
            mv volumes/functions volumes/functions.backup.$(date +%Y%m%d_%H%M%S)
        fi
        
        # Extract new functions
        mkdir -p volumes/functions
        tar -xzf /tmp/functions.tar.gz -C volumes/functions
        
        # Restart functions service
        docker compose restart functions || docker compose up -d functions
        
        # Cleanup
        rm /tmp/functions.tar.gz
        
        echo "Functions deployed successfully!"
EOF
    
    log_success "Functions deployed to VPS"
    
    # Cleanup local temp
    rm -rf "${TEMP_DIR}"
}

# ============================================
# CONFIGURE ENVIRONMENT
# ============================================

configure_env() {
    log_info "Configuring environment variables on VPS..."
    
    # Read current secrets from Supabase Cloud (if available)
    # This would need to be customized for your specific secrets
    
    ssh ${VPS_USER}@${VPS_HOST} << 'EOF'
        cd /root/supabase/docker
        
        # Add environment variables to functions service
        # These should already be in docker-compose.yml, just verify
        
        echo "Checking environment configuration..."
        
        # Verify required secrets are set
        grep -q "MERCADO_PAGO_ACCESS_TOKEN" .env && echo "✓ MERCADO_PAGO_ACCESS_TOKEN set" || echo "✗ MERCADO_PAGO_ACCESS_TOKEN missing"
        grep -q "WHATSAPP_APPKEY" .env && echo "✓ WHATSAPP_APPKEY set" || echo "✗ WHATSAPP_APPKEY missing"
        grep -q "R2_ACCESS_KEY_ID" .env && echo "✓ R2_ACCESS_KEY_ID set" || echo "✗ R2_ACCESS_KEY_ID missing"
        grep -q "TMDB_API_KEY" .env && echo "✓ TMDB_API_KEY set" || echo "✗ TMDB_API_KEY missing"
EOF
    
    log_success "Environment configured"
}

# ============================================
# HEALTH CHECK
# ============================================

health_check() {
    log_info "Running health checks..."
    
    # Check self-hosted Supabase is responding
    if curl -s -o /dev/null -w "%{http_code}" "https://${VPS_HOST}/rest/v1/" | grep -q "200\|401"; then
        log_success "Self-hosted REST API is responding"
    else
        log_warn "Self-hosted REST API not responding"
    fi
    
    # Test a function
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "https://${VPS_HOST}/functions/v1/fetch-m3u" -X OPTIONS)
    if [ "$RESPONSE" = "204" ] || [ "$RESPONSE" = "200" ]; then
        log_success "Edge Functions are responding"
    else
        log_warn "Edge Functions may not be responding (HTTP ${RESPONSE})"
    fi
}

# ============================================
# GENERATE LOCAL ENV
# ============================================

generate_local_env() {
    log_info "Generating local environment configuration..."
    
    cat > .env.hybrid << EOF
# Hybrid Backend Configuration
# Generated by setup-hybrid-backend.sh on $(date)

# Lovable Cloud (default)
VITE_SUPABASE_URL=https://waxgowafohlrfoefwhsf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndheGdvd2Fmb2hscmZvZWZ3aHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw

# Self-Hosted VPS (for heavy operations)
VITE_SUPABASE_SELFHOSTED_URL=https://${VPS_HOST}
VITE_SUPABASE_SELFHOSTED_KEY=YOUR_SELFHOSTED_ANON_KEY_HERE
EOF
    
    log_success "Generated .env.hybrid - update VITE_SUPABASE_SELFHOSTED_KEY with your anon key"
}

# ============================================
# MAIN
# ============================================

main() {
    echo ""
    echo "============================================"
    echo "   HYBRID BACKEND SETUP"
    echo "   Cloud + Self-Hosted VPS"
    echo "============================================"
    echo ""
    
    case "${1:-all}" in
        preflight)
            preflight_check
            ;;
        deploy)
            deploy_functions
            ;;
        env)
            configure_env
            ;;
        health)
            health_check
            ;;
        local)
            generate_local_env
            ;;
        all)
            preflight_check
            deploy_functions
            configure_env
            health_check
            generate_local_env
            ;;
        *)
            echo "Usage: $0 {preflight|deploy|env|health|local|all}"
            exit 1
            ;;
    esac
    
    echo ""
    log_success "Setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Copy .env.hybrid to .env and update VITE_SUPABASE_SELFHOSTED_KEY"
    echo "  2. Restart your development server"
    echo "  3. Check /admin/hybrid-backend dashboard"
    echo ""
}

main "$@"
