#!/bin/bash
# =============================================================================
# SUPABASE MIGRATION: Database Dump Script
# Gera dump completo do banco Supabase Cloud
# =============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# CONFIGURAÇÃO - Substituir pelos valores reais
# -----------------------------------------------------------------------------
PG_URL_ORIG="${PG_URL_ORIG:-{{PG_URL_ORIG}}}"
DUMP_DIR="${DUMP_DIR:-./dumps}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${DUMP_DIR}/supabase_dump_${TIMESTAMP}.custom"
DUMP_FILE_SCHEMA="${DUMP_DIR}/supabase_schema_${TIMESTAMP}.sql"
DUMP_FILE_DATA="${DUMP_DIR}/supabase_data_${TIMESTAMP}.sql"

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
    
    if [[ "$PG_URL_ORIG" == "{{PG_URL_ORIG}}" ]]; then
        log_error "Variável PG_URL_ORIG não configurada!"
        log_info "Execute: export PG_URL_ORIG='postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres'"
        exit 1
    fi
    
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump não encontrado. Instale PostgreSQL client."
        exit 1
    fi
    
    mkdir -p "$DUMP_DIR"
    log_success "Ambiente validado"
}

# -----------------------------------------------------------------------------
# TESTAR CONEXÃO
# -----------------------------------------------------------------------------
test_connection() {
    log_info "Testando conexão com banco origem..."
    
    if psql "$PG_URL_ORIG" -c "SELECT 1;" &> /dev/null; then
        log_success "Conexão com banco origem OK"
    else
        log_error "Falha na conexão com banco origem"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# LISTAR EXTENSIONS
# -----------------------------------------------------------------------------
list_extensions() {
    log_info "Listando extensions instaladas..."
    
    psql "$PG_URL_ORIG" -t -c "SELECT extname FROM pg_extension ORDER BY extname;" \
        > "${DUMP_DIR}/extensions_list_${TIMESTAMP}.txt"
    
    log_success "Extensions listadas em: ${DUMP_DIR}/extensions_list_${TIMESTAMP}.txt"
    cat "${DUMP_DIR}/extensions_list_${TIMESTAMP}.txt"
}

# -----------------------------------------------------------------------------
# GERAR ESTATÍSTICAS PRÉ-DUMP
# -----------------------------------------------------------------------------
generate_stats() {
    log_info "Gerando estatísticas do banco..."
    
    psql "$PG_URL_ORIG" -c "
        SELECT 
            schemaname,
            relname as table_name,
            n_live_tup as row_count
        FROM pg_stat_user_tables
        WHERE schemaname IN ('public', 'auth', 'storage')
        ORDER BY n_live_tup DESC;
    " > "${DUMP_DIR}/table_stats_${TIMESTAMP}.txt"
    
    log_success "Estatísticas salvas em: ${DUMP_DIR}/table_stats_${TIMESTAMP}.txt"
}

# -----------------------------------------------------------------------------
# DUMP COMPLETO (formato custom para restore eficiente)
# -----------------------------------------------------------------------------
dump_database_custom() {
    log_info "Iniciando dump em formato custom..."
    log_warn "Isso pode levar vários minutos dependendo do tamanho do banco..."
    
    pg_dump \
        --format=custom \
        --no-acl \
        --no-owner \
        --verbose \
        --jobs=4 \
        --file="$DUMP_FILE" \
        "$PG_URL_ORIG" 2>&1 | tee "${DUMP_DIR}/dump_log_${TIMESTAMP}.log"
    
    if [[ -f "$DUMP_FILE" ]]; then
        DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
        log_success "Dump custom gerado: $DUMP_FILE ($DUMP_SIZE)"
    else
        log_error "Falha ao gerar dump"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# DUMP SCHEMA SEPARADO (para revisão)
# -----------------------------------------------------------------------------
dump_schema_only() {
    log_info "Gerando dump apenas do schema..."
    
    pg_dump \
        --schema-only \
        --no-acl \
        --no-owner \
        --file="$DUMP_FILE_SCHEMA" \
        "$PG_URL_ORIG"
    
    log_success "Schema dump gerado: $DUMP_FILE_SCHEMA"
}

# -----------------------------------------------------------------------------
# DUMP DATA SEPARADO (opcional, para tabelas grandes)
# -----------------------------------------------------------------------------
dump_data_only() {
    log_info "Gerando dump apenas dos dados..."
    
    pg_dump \
        --data-only \
        --no-acl \
        --no-owner \
        --file="$DUMP_FILE_DATA" \
        "$PG_URL_ORIG"
    
    log_success "Data dump gerado: $DUMP_FILE_DATA"
}

# -----------------------------------------------------------------------------
# GERAR CHECKSUMS
# -----------------------------------------------------------------------------
generate_checksums() {
    log_info "Gerando checksums para verificação..."
    
    cd "$DUMP_DIR"
    sha256sum supabase_*_${TIMESTAMP}.* > "checksums_${TIMESTAMP}.sha256"
    cd - > /dev/null
    
    log_success "Checksums gerados em: ${DUMP_DIR}/checksums_${TIMESTAMP}.sha256"
}

# -----------------------------------------------------------------------------
# COMPRIMIR DUMP
# -----------------------------------------------------------------------------
compress_dump() {
    log_info "Comprimindo dump..."
    
    if command -v pigz &> /dev/null; then
        pigz -k "$DUMP_FILE"
    else
        gzip -k "$DUMP_FILE"
    fi
    
    if [[ -f "${DUMP_FILE}.gz" ]]; then
        COMPRESSED_SIZE=$(du -h "${DUMP_FILE}.gz" | cut -f1)
        log_success "Dump comprimido: ${DUMP_FILE}.gz ($COMPRESSED_SIZE)"
    fi
}

# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
main() {
    echo "=============================================="
    echo " SUPABASE CLOUD → SELF-HOSTED: DATABASE DUMP"
    echo "=============================================="
    echo ""
    
    validate_environment
    test_connection
    list_extensions
    generate_stats
    dump_database_custom
    dump_schema_only
    generate_checksums
    compress_dump
    
    echo ""
    echo "=============================================="
    log_success "DUMP CONCLUÍDO COM SUCESSO!"
    echo "=============================================="
    echo ""
    echo "Arquivos gerados em: $DUMP_DIR"
    ls -lah "$DUMP_DIR"/*${TIMESTAMP}*
    echo ""
    echo "Próximo passo: Execute transfer_dump.sh para enviar à VPS"
}

main "$@"
