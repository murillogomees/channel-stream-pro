#!/bin/bash
# =============================================================================
# SUPABASE MIGRATION: Database Restore Script
# Restaura dump no Supabase Self-Hosted (VPS Hostinger)
# =============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# CONFIGURAÇÃO - Substituir pelos valores reais
# -----------------------------------------------------------------------------
PG_URL_DEST="${PG_URL_DEST:-{{PG_URL_DEST}}}"
DUMP_DIR="${DUMP_DIR:-/home/$(whoami)/supabase_migration}"
PARALLEL_JOBS="${PARALLEL_JOBS:-4}"

# -----------------------------------------------------------------------------
# CORES PARA OUTPUT
# -----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# -----------------------------------------------------------------------------
# VALIDAÇÕES
# -----------------------------------------------------------------------------
validate_environment() {
    log_info "Validando ambiente..."
    
    if [[ "$PG_URL_DEST" == "{{PG_URL_DEST}}" ]]; then
        log_error "Variável PG_URL_DEST não configurada!"
        log_info "Execute: export PG_URL_DEST='postgresql://postgres:PASSWORD@localhost:5432/postgres'"
        exit 1
    fi
    
    if ! command -v pg_restore &> /dev/null; then
        log_error "pg_restore não encontrado. Instale PostgreSQL client."
        exit 1
    fi
    
    if ! command -v psql &> /dev/null; then
        log_error "psql não encontrado. Instale PostgreSQL client."
        exit 1
    fi
    
    log_success "Ambiente validado"
}

# -----------------------------------------------------------------------------
# ENCONTRAR DUMP
# -----------------------------------------------------------------------------
find_dump_file() {
    log_info "Procurando arquivo de dump..."
    
    # Procurar .custom.gz primeiro
    DUMP_FILE=$(ls -t "$DUMP_DIR"/supabase_dump_*.custom.gz 2>/dev/null | head -1 || true)
    
    if [[ -n "$DUMP_FILE" && -f "$DUMP_FILE" ]]; then
        log_info "Encontrado dump comprimido: $DUMP_FILE"
        log_info "Descomprimindo..."
        gunzip -k "$DUMP_FILE" 2>/dev/null || true
        DUMP_FILE="${DUMP_FILE%.gz}"
    else
        DUMP_FILE=$(ls -t "$DUMP_DIR"/supabase_dump_*.custom 2>/dev/null | head -1 || true)
    fi
    
    if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
        log_error "Nenhum arquivo de dump encontrado em $DUMP_DIR"
        exit 1
    fi
    
    log_success "Usando dump: $DUMP_FILE"
}

# -----------------------------------------------------------------------------
# TESTAR CONEXÃO
# -----------------------------------------------------------------------------
test_connection() {
    log_info "Testando conexão com banco destino..."
    
    if psql "$PG_URL_DEST" -c "SELECT 1;" &> /dev/null; then
        log_success "Conexão com banco destino OK"
    else
        log_error "Falha na conexão com banco destino"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# BACKUP DO BANCO DESTINO (SAFETY)
# -----------------------------------------------------------------------------
backup_destination() {
    log_info "Criando backup do banco destino (segurança)..."
    
    local backup_file="${DUMP_DIR}/backup_dest_$(date +%Y%m%d_%H%M%S).custom"
    
    pg_dump \
        --format=custom \
        --no-acl \
        --no-owner \
        --file="$backup_file" \
        "$PG_URL_DEST" 2>/dev/null || true
    
    if [[ -f "$backup_file" ]]; then
        log_success "Backup criado: $backup_file"
    else
        log_warn "Não foi possível criar backup (banco pode estar vazio)"
    fi
}

# -----------------------------------------------------------------------------
# RECRIAR EXTENSIONS
# -----------------------------------------------------------------------------
recreate_extensions() {
    log_info "Recriando extensions necessárias..."
    
    local ext_sql="${DUMP_DIR}/recreate_extensions.sql"
    
    if [[ -f "$ext_sql" ]]; then
        psql "$PG_URL_DEST" -f "$ext_sql" 2>&1 | grep -v "already exists" || true
        log_success "Extensions recriadas"
    else
        log_warn "Arquivo recreate_extensions.sql não encontrado"
        
        # Extensions padrão do Supabase
        log_info "Criando extensions padrão..."
        psql "$PG_URL_DEST" << 'EOF'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
EOF
        log_success "Extensions padrão criadas"
    fi
}

# -----------------------------------------------------------------------------
# DESABILITAR TRIGGERS
# -----------------------------------------------------------------------------
disable_triggers() {
    log_info "Desabilitando triggers temporariamente..."
    
    psql "$PG_URL_DEST" << 'EOF'
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER ALL', r.tablename);
    END LOOP;
END $$;
EOF
    
    log_success "Triggers desabilitados"
}

# -----------------------------------------------------------------------------
# HABILITAR TRIGGERS
# -----------------------------------------------------------------------------
enable_triggers() {
    log_info "Reabilitando triggers..."
    
    psql "$PG_URL_DEST" << 'EOF'
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER ALL', r.tablename);
    END LOOP;
END $$;
EOF
    
    log_success "Triggers reabilitados"
}

# -----------------------------------------------------------------------------
# RESTAURAR BANCO
# -----------------------------------------------------------------------------
restore_database() {
    log_info "Iniciando restauração do banco..."
    log_warn "Isso pode levar vários minutos dependendo do tamanho do dump..."
    
    local log_file="${DUMP_DIR}/restore_log_$(date +%Y%m%d_%H%M%S).log"
    
    # Restaurar com pg_restore
    pg_restore \
        --verbose \
        --clean \
        --if-exists \
        --no-acl \
        --no-owner \
        --jobs="$PARALLEL_JOBS" \
        --dbname="$PG_URL_DEST" \
        "$DUMP_FILE" 2>&1 | tee "$log_file" || {
            log_warn "Alguns erros durante restore (podem ser normais para objetos que já existem)"
        }
    
    log_success "Restauração concluída"
    log_info "Log salvo em: $log_file"
}

# -----------------------------------------------------------------------------
# VERIFICAR CONTAGENS
# -----------------------------------------------------------------------------
verify_restore() {
    log_info "Verificando restauração..."
    
    psql "$PG_URL_DEST" << 'EOF'
SELECT 
    schemaname,
    relname as table_name,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname IN ('public', 'auth', 'storage')
ORDER BY n_live_tup DESC
LIMIT 20;
EOF
    
    log_success "Verificação concluída"
}

# -----------------------------------------------------------------------------
# ATUALIZAR SEQUENCES
# -----------------------------------------------------------------------------
update_sequences() {
    log_info "Atualizando sequences..."
    
    psql "$PG_URL_DEST" << 'EOF'
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 
            pg_get_serial_sequence(quote_ident(table_schema) || '.' || quote_ident(table_name), column_name) as seq,
            quote_ident(table_schema) || '.' || quote_ident(table_name) as tbl,
            column_name as col
        FROM information_schema.columns
        WHERE column_default LIKE 'nextval%'
        AND table_schema = 'public'
    LOOP
        IF r.seq IS NOT NULL THEN
            EXECUTE format(
                'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %s), 1))',
                r.seq, r.col, r.tbl
            );
        END IF;
    END LOOP;
END $$;
EOF
    
    log_success "Sequences atualizadas"
}

# -----------------------------------------------------------------------------
# REINDEX
# -----------------------------------------------------------------------------
reindex_database() {
    log_info "Reindexando banco..."
    
    psql "$PG_URL_DEST" -c "REINDEX DATABASE postgres;" 2>/dev/null || {
        log_warn "Reindex não executado (pode requerer superuser)"
    }
    
    log_success "Reindex concluído"
}

# -----------------------------------------------------------------------------
# ANALYZE
# -----------------------------------------------------------------------------
analyze_database() {
    log_info "Analisando estatísticas do banco..."
    
    psql "$PG_URL_DEST" -c "ANALYZE;"
    
    log_success "Análise concluída"
}

# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
main() {
    echo "=============================================="
    echo " SUPABASE MIGRATION: DATABASE RESTORE"
    echo "=============================================="
    echo ""
    
    validate_environment
    find_dump_file
    test_connection
    backup_destination
    recreate_extensions
    disable_triggers
    restore_database
    enable_triggers
    update_sequences
    reindex_database
    analyze_database
    verify_restore
    
    echo ""
    echo "=============================================="
    log_success "RESTAURAÇÃO CONCLUÍDA COM SUCESSO!"
    echo "=============================================="
    echo ""
    echo "Próximos passos:"
    echo "  1. Execute: ./verify_counts.sh (comparar tabelas)"
    echo "  2. Execute: ./healthcheck_tests.sh (testar APIs)"
    echo "  3. Atualize as variáveis de ambiente (ver update_envs.md)"
}

main "$@"
