#!/bin/bash
# ============================================
# REDIS CACHE SETUP FOR SELF-HOSTED VPS
# Optimized for IPTV playlist caching
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

VPS_HOST="${VPS_HOST:-srv1182856.hstgr.cloud}"
VPS_USER="${VPS_USER:-root}"

# ============================================
# INSTALL REDIS
# ============================================

install_redis() {
    log_info "Installing Redis on VPS..."
    
    ssh ${VPS_USER}@${VPS_HOST} << 'EOF'
        set -e
        
        # Check if Redis is already installed
        if command -v redis-server &> /dev/null; then
            echo "Redis already installed"
            redis-server --version
            exit 0
        fi
        
        # Install Redis
        apt-get update
        apt-get install -y redis-server
        
        # Configure Redis for performance
        cat > /etc/redis/redis.conf.d/iptv.conf << 'REDIS_CONF'
# IPTV Link Redis Configuration
# Optimized for 32GB RAM VPS

# Memory settings (use up to 8GB for cache)
maxmemory 8gb
maxmemory-policy allkeys-lru

# Persistence (disable for pure cache, or enable RDB for persistence)
save ""
appendonly no

# Network
bind 127.0.0.1
port 6379

# Performance
tcp-keepalive 300
timeout 0

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
REDIS_CONF
        
        # Include custom config
        echo "include /etc/redis/redis.conf.d/iptv.conf" >> /etc/redis/redis.conf
        
        # Restart Redis
        systemctl restart redis-server
        systemctl enable redis-server
        
        echo "Redis installed and configured!"
        redis-cli ping
EOF
    
    log_success "Redis installed on VPS"
}

# ============================================
# VERIFY REDIS
# ============================================

verify_redis() {
    log_info "Verifying Redis connection..."
    
    ssh ${VPS_USER}@${VPS_HOST} << 'EOF'
        # Test Redis
        redis-cli ping
        
        # Show info
        redis-cli info memory | grep -E "(used_memory_human|maxmemory_human)"
        
        # Test set/get
        redis-cli set test:hybrid "working" EX 60
        redis-cli get test:hybrid
        redis-cli del test:hybrid
        
        echo "Redis verification complete!"
EOF
    
    log_success "Redis is working correctly"
}

# ============================================
# CONFIGURE FOR EDGE FUNCTIONS
# ============================================

configure_for_edge() {
    log_info "Configuring Redis access for Edge Functions..."
    
    ssh ${VPS_USER}@${VPS_HOST} << 'EOF'
        cd /root/supabase/docker
        
        # Add Redis URL to .env if not present
        if ! grep -q "REDIS_URL" .env 2>/dev/null; then
            echo "" >> .env
            echo "# Redis Cache" >> .env
            echo "REDIS_URL=redis://127.0.0.1:6379" >> .env
            echo "Added REDIS_URL to .env"
        else
            echo "REDIS_URL already in .env"
        fi
        
        # Restart functions to pick up new env
        docker compose restart functions 2>/dev/null || echo "Functions service not running via compose"
EOF
    
    log_success "Redis configured for Edge Functions"
}

# ============================================
# CREATE CACHE HELPERS
# ============================================

create_cache_helpers() {
    log_info "Creating Redis cache helper scripts..."
    
    ssh ${VPS_USER}@${VPS_HOST} << 'EOF'
        mkdir -p /root/scripts
        
        # Cache status script
        cat > /root/scripts/redis-status.sh << 'SCRIPT'
#!/bin/bash
echo "=== Redis Status ==="
redis-cli info memory | grep -E "(used_memory_human|maxmemory_human|evicted_keys)"
echo ""
echo "=== Cache Keys ==="
echo "Playlist keys: $(redis-cli keys 'playlist:*' | wc -l)"
echo "Stream keys: $(redis-cli keys 'stream:*' | wc -l)"
echo "M3U keys: $(redis-cli keys 'm3u:*' | wc -l)"
echo "Total keys: $(redis-cli dbsize)"
SCRIPT
        chmod +x /root/scripts/redis-status.sh
        
        # Cache clear script
        cat > /root/scripts/redis-clear.sh << 'SCRIPT'
#!/bin/bash
echo "Clearing Redis cache..."
redis-cli FLUSHDB
echo "Cache cleared!"
SCRIPT
        chmod +x /root/scripts/redis-clear.sh
        
        # Cache warmup script
        cat > /root/scripts/redis-warmup.sh << 'SCRIPT'
#!/bin/bash
echo "Warming up cache..."
# This would call your Edge Function to pre-cache popular playlists
curl -X POST "http://localhost:54321/functions/v1/cdn-prewarm" \
    -H "Content-Type: application/json" \
    -d '{"force": true}'
echo "Cache warmup initiated!"
SCRIPT
        chmod +x /root/scripts/redis-warmup.sh
        
        echo "Helper scripts created in /root/scripts/"
EOF
    
    log_success "Cache helper scripts created"
}

# ============================================
# MAIN
# ============================================

main() {
    echo ""
    echo "============================================"
    echo "   REDIS CACHE SETUP"
    echo "   For IPTV Link Hybrid Backend"
    echo "============================================"
    echo ""
    
    case "${1:-all}" in
        install)
            install_redis
            ;;
        verify)
            verify_redis
            ;;
        configure)
            configure_for_edge
            ;;
        helpers)
            create_cache_helpers
            ;;
        all)
            install_redis
            verify_redis
            configure_for_edge
            create_cache_helpers
            ;;
        *)
            echo "Usage: $0 {install|verify|configure|helpers|all}"
            exit 1
            ;;
    esac
    
    echo ""
    log_success "Redis setup complete!"
    echo ""
    echo "Commands available on VPS:"
    echo "  /root/scripts/redis-status.sh  - View cache status"
    echo "  /root/scripts/redis-clear.sh   - Clear all cache"
    echo "  /root/scripts/redis-warmup.sh  - Warm up cache"
    echo ""
}

main "$@"
