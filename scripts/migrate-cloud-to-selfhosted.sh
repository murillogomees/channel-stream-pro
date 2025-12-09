#!/bin/bash
# =============================================================================
# MIGRAÇÃO SUPABASE CLOUD → SELF-HOSTED
# Script unificado para migrar banco de dados completo
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# CONFIGURAÇÃO - EDITE ESTAS VARIÁVEIS
# =============================================================================

# Supabase Cloud (origem)
CLOUD_PROJECT_REF="sdvyxdghxqmntyoweqbd"
CLOUD_DB_HOST="db.sdvyxdghxqmntyoweqbd.supabase.co"
CLOUD_DB_PORT="5432"
CLOUD_DB_NAME="postgres"
CLOUD_DB_USER="postgres"
CLOUD_DB_PASSWORD="w84qlQZGTfadDI4M"  # Obtenha em: https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/settings/database

# Self-Hosted (destino)
SELFHOST_DB_HOST="https://supabase
iptvlink.com.br"  # ou IP do VPS
SELFHOST_DB_PORT="5432"
SELFHOST_DB_NAME="postgres"
SELFHOST_DB_USER="postgres"
SELFHOST_DB_PASSWORD="SUA_SENHA_SELFHOSTED"

# Diretório para dumps
DUMP_DIR="./migration_dumps"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# =============================================================================
# FUNÇÕES
# =============================================================================

check_requirements() {
    log_info "Verificando requisitos..."
    
    for cmd in pg_dump pg_restore psql; do
        if ! command -v $cmd &> /dev/null; then
            log_error "$cmd não encontrado. Instale postgresql-client"
            exit 1
        fi
    done
    
    log_success "Todos os requisitos instalados"
}

test_connections() {
    log_info "Testando conexão com Cloud..."
    PGPASSWORD="$CLOUD_DB_PASSWORD" psql -h "$CLOUD_DB_HOST" -p "$CLOUD_DB_PORT" -U "$CLOUD_DB_USER" -d "$CLOUD_DB_NAME" -c "SELECT 1" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        log_success "Conexão Cloud OK"
    else
        log_error "Falha na conexão com Cloud. Verifique a senha."
        exit 1
    fi
    
    log_info "Testando conexão com Self-Hosted..."
    PGPASSWORD="$SELFHOST_DB_PASSWORD" psql -h "$SELFHOST_DB_HOST" -p "$SELFHOST_DB_PORT" -U "$SELFHOST_DB_USER" -d "$SELFHOST_DB_NAME" -c "SELECT 1" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        log_success "Conexão Self-Hosted OK"
    else
        log_error "Falha na conexão com Self-Hosted. Verifique as credenciais."
        exit 1
    fi
}

dump_cloud_database() {
    log_info "Criando dump do banco Cloud..."
    mkdir -p "$DUMP_DIR"
    
    DUMP_FILE="$DUMP_DIR/supabase_cloud_$TIMESTAMP.dump"
    
    PGPASSWORD="$CLOUD_DB_PASSWORD" pg_dump \
        -h "$CLOUD_DB_HOST" \
        -p "$CLOUD_DB_PORT" \
        -U "$CLOUD_DB_USER" \
        -d "$CLOUD_DB_NAME" \
        -Fc \
        --no-owner \
        --no-acl \
        --exclude-schema=supabase_functions \
        --exclude-schema=supabase_migrations \
        --exclude-schema=_realtime \
        --exclude-schema=_analytics \
        --exclude-schema=pgbouncer \
        --exclude-schema=pgsodium \
        --exclude-schema=pgsodium_masks \
        --exclude-schema=vault \
        -f "$DUMP_FILE"
    
    if [ $? -eq 0 ]; then
        DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
        log_success "Dump criado: $DUMP_FILE ($DUMP_SIZE)"
    else
        log_error "Falha ao criar dump"
        exit 1
    fi
}

restore_to_selfhosted() {
    log_info "Restaurando no Self-Hosted..."
    
    DUMP_FILE=$(ls -t "$DUMP_DIR"/*.dump 2>/dev/null | head -1)
    
    if [ -z "$DUMP_FILE" ]; then
        log_error "Nenhum arquivo .dump encontrado em $DUMP_DIR"
        exit 1
    fi
    
    log_info "Usando: $DUMP_FILE"
    
    # Criar extensões necessárias
    log_info "Criando extensões..."
    PGPASSWORD="$SELFHOST_DB_PASSWORD" psql -h "$SELFHOST_DB_HOST" -p "$SELFHOST_DB_PORT" -U "$SELFHOST_DB_USER" -d "$SELFHOST_DB_NAME" << 'EOF'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "unaccent";
EOF
    
    # Restaurar dump
    PGPASSWORD="$SELFHOST_DB_PASSWORD" pg_restore \
        -h "$SELFHOST_DB_HOST" \
        -p "$SELFHOST_DB_PORT" \
        -U "$SELFHOST_DB_USER" \
        -d "$SELFHOST_DB_NAME" \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        "$DUMP_FILE" 2>&1 | grep -v "already exists" || true
    
    log_success "Restauração concluída"
}

verify_migration() {
    log_info "Verificando migração..."
    
    echo ""
    echo "=== CONTAGEM DE REGISTROS ==="
    
    PGPASSWORD="$SELFHOST_DB_PASSWORD" psql -h "$SELFHOST_DB_HOST" -p "$SELFHOST_DB_PORT" -U "$SELFHOST_DB_USER" -d "$SELFHOST_DB_NAME" << 'EOF'
SELECT 
    schemaname || '.' || relname AS table_name,
    n_live_tup AS row_count
FROM pg_stat_user_tables 
WHERE schemaname IN ('public', 'auth', 'storage')
ORDER BY n_live_tup DESC
LIMIT 20;
EOF
    
    echo ""
    log_success "Migração verificada"
}

show_next_steps() {
    echo ""
    echo "=============================================="
    echo -e "${GREEN}MIGRAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
    echo "=============================================="
    echo ""
    echo "PRÓXIMOS PASSOS:"
    echo ""
    echo "1. Atualize as variáveis de ambiente do frontend:"
    echo "   VITE_SUPABASE_URL=https://seu-vps.com"
    echo "   VITE_SUPABASE_ANON_KEY=sua_anon_key_selfhosted"
    echo ""
    echo "2. Atualize webhooks externos:"
    echo "   - MercadoPago: https://seu-vps.com/functions/v1/mercado-pago-webhook"
    echo "   - WhatsApp: https://seu-vps.com/functions/v1/whatsapp-webhook"
    echo ""
    echo "3. Deploy das Edge Functions (execute no VPS):"
    echo "   ./scripts/deploy-functions-selfhosted.sh"
    echo ""
    echo "4. Teste o sistema:"
    echo "   - Login de usuário"
    echo "   - Player de vídeo"
    echo "   - Pagamentos"
    echo ""
}

# =============================================================================
# EXECUÇÃO PRINCIPAL
# =============================================================================

echo ""
echo "========================================"
echo "  MIGRAÇÃO SUPABASE CLOUD → SELF-HOSTED"
echo "========================================"
echo ""

# Verificar se as senhas foram configuradas
if [ "$CLOUD_DB_PASSWORD" = "SUA_SENHA_DO_CLOUD" ]; then
    log_error "Configure CLOUD_DB_PASSWORD no script"
    exit 1
fi

if [ "$SELFHOST_DB_PASSWORD" = "SUA_SENHA_SELFHOSTED" ]; then
    log_error "Configure SELFHOST_DB_PASSWORD no script"
    exit 1
fi

check_requirements
test_connections
dump_cloud_database
restore_to_selfhosted
verify_migration
show_next_steps
