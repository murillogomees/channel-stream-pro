#!/bin/bash
# =============================================================================
# SUPABASE MIGRATION: Verify Table Counts
# Compara contagem de registros entre origem e destino
# =============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# CONFIGURAÇÃO
# -----------------------------------------------------------------------------
PG_URL_ORIG="${PG_URL_ORIG:-{{PG_URL_ORIG}}}"
PG_URL_DEST="${PG_URL_DEST:-{{PG_URL_DEST}}}"
OUTPUT_FILE="${OUTPUT_FILE:-./verification_report_$(date +%Y%m%d_%H%M%S).txt}"

# Tabelas críticas para verificar
CRITICAL_TABLES=(
    "public.profiles"
    "public.user_roles"
    "public.clientes"
    "public.subscription_plans"
    "public.user_subscriptions"
    "public.m3u_sync_sources"
    "public.m3u_sync_entries"
    "public.m3u_channels"
    "public.m3u_categories"
    "public.m3u_custom_lists"
    "public.whatsapp_config"
    "public.mercado_pago_config"
    "public.app_feature_flags"
    "public.affiliates"
    "public.discount_coupons"
    "auth.users"
    "storage.buckets"
    "storage.objects"
)

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
        exit 1
    fi
    
    if [[ "$PG_URL_DEST" == "{{PG_URL_DEST}}" ]]; then
        log_error "Variável PG_URL_DEST não configurada!"
        exit 1
    fi
    
    log_success "Ambiente validado"
}

# -----------------------------------------------------------------------------
# OBTER CONTAGEM DE TABELA
# -----------------------------------------------------------------------------
get_table_count() {
    local url="$1"
    local table="$2"
    
    local count=$(psql "$url" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ' || echo "-1")
    echo "$count"
}

# -----------------------------------------------------------------------------
# VERIFICAR TABELA
# -----------------------------------------------------------------------------
verify_table() {
    local table="$1"
    
    local orig_count=$(get_table_count "$PG_URL_ORIG" "$table")
    local dest_count=$(get_table_count "$PG_URL_DEST" "$table")
    
    local status="?"
    local diff=0
    
    if [[ "$orig_count" == "-1" ]]; then
        status="⚠️ NOT_FOUND_ORIG"
    elif [[ "$dest_count" == "-1" ]]; then
        status="⚠️ NOT_FOUND_DEST"
    elif [[ "$orig_count" == "$dest_count" ]]; then
        status="✅ MATCH"
    else
        diff=$((orig_count - dest_count))
        if [[ $diff -lt 0 ]]; then
            status="⚠️ DEST_HAS_MORE"
            diff=$((diff * -1))
        else
            status="❌ MISSING"
        fi
    fi
    
    printf "%-40s | %12s | %12s | %12s | %s\n" \
        "$table" "$orig_count" "$dest_count" "$diff" "$status"
}

# -----------------------------------------------------------------------------
# GERAR RELATÓRIO
# -----------------------------------------------------------------------------
generate_report() {
    log_info "Gerando relatório de verificação..."
    
    {
        echo "=============================================="
        echo " RELATÓRIO DE VERIFICAÇÃO DE MIGRAÇÃO"
        echo " Data: $(date)"
        echo "=============================================="
        echo ""
        echo "Origem: $PG_URL_ORIG"
        echo "Destino: $PG_URL_DEST"
        echo ""
        echo "=============================================="
        printf "%-40s | %12s | %12s | %12s | %s\n" \
            "TABELA" "ORIGEM" "DESTINO" "DIFERENÇA" "STATUS"
        echo "--------------------------------------------------------------------------------------------------------------"
    } | tee "$OUTPUT_FILE"
    
    local total_diff=0
    local errors=0
    
    for table in "${CRITICAL_TABLES[@]}"; do
        result=$(verify_table "$table")
        echo "$result" | tee -a "$OUTPUT_FILE"
        
        if [[ "$result" == *"MISSING"* ]] || [[ "$result" == *"NOT_FOUND"* ]]; then
            ((errors++)) || true
        fi
    done
    
    {
        echo ""
        echo "=============================================="
        echo " RESUMO"
        echo "=============================================="
        echo ""
        if [[ $errors -eq 0 ]]; then
            echo "✅ Todas as tabelas verificadas estão OK!"
        else
            echo "⚠️ $errors tabelas com diferenças encontradas"
        fi
        echo ""
        echo "Relatório salvo em: $OUTPUT_FILE"
    } | tee -a "$OUTPUT_FILE"
}

# -----------------------------------------------------------------------------
# VERIFICAÇÃO AVANÇADA
# -----------------------------------------------------------------------------
verify_advanced() {
    log_info "Executando verificações avançadas..."
    
    echo "" | tee -a "$OUTPUT_FILE"
    echo "=============================================="  | tee -a "$OUTPUT_FILE"
    echo " VERIFICAÇÕES AVANÇADAS" | tee -a "$OUTPUT_FILE"
    echo "=============================================="  | tee -a "$OUTPUT_FILE"
    
    # Verificar sequences
    echo "" | tee -a "$OUTPUT_FILE"
    echo "📊 Verificando sequences..." | tee -a "$OUTPUT_FILE"
    
    psql "$PG_URL_DEST" -c "
        SELECT 
            schemaname || '.' || sequencename as sequence_name,
            last_value
        FROM pg_sequences
        WHERE schemaname = 'public'
        ORDER BY sequencename
        LIMIT 20;
    " 2>/dev/null | tee -a "$OUTPUT_FILE" || echo "Não foi possível verificar sequences"
    
    # Verificar indexes
    echo "" | tee -a "$OUTPUT_FILE"
    echo "📊 Verificando indexes..." | tee -a "$OUTPUT_FILE"
    
    local orig_idx=$(psql "$PG_URL_ORIG" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" 2>/dev/null | tr -d ' ')
    local dest_idx=$(psql "$PG_URL_DEST" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" 2>/dev/null | tr -d ' ')
    
    echo "Indexes na origem: $orig_idx" | tee -a "$OUTPUT_FILE"
    echo "Indexes no destino: $dest_idx" | tee -a "$OUTPUT_FILE"
    
    # Verificar constraints
    echo "" | tee -a "$OUTPUT_FILE"
    echo "📊 Verificando constraints..." | tee -a "$OUTPUT_FILE"
    
    local orig_con=$(psql "$PG_URL_ORIG" -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    local dest_con=$(psql "$PG_URL_DEST" -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    
    echo "Constraints na origem: $orig_con" | tee -a "$OUTPUT_FILE"
    echo "Constraints no destino: $dest_con" | tee -a "$OUTPUT_FILE"
    
    # Verificar RLS policies
    echo "" | tee -a "$OUTPUT_FILE"
    echo "📊 Verificando RLS policies..." | tee -a "$OUTPUT_FILE"
    
    local orig_rls=$(psql "$PG_URL_ORIG" -t -c "SELECT COUNT(*) FROM pg_policies;" 2>/dev/null | tr -d ' ')
    local dest_rls=$(psql "$PG_URL_DEST" -t -c "SELECT COUNT(*) FROM pg_policies;" 2>/dev/null | tr -d ' ')
    
    echo "RLS policies na origem: $orig_rls" | tee -a "$OUTPUT_FILE"
    echo "RLS policies no destino: $dest_rls" | tee -a "$OUTPUT_FILE"
}

# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
main() {
    echo "=============================================="
    echo " SUPABASE MIGRATION: VERIFICATION"
    echo "=============================================="
    echo ""
    
    validate_environment
    
    log_info "Testando conexões..."
    
    if ! psql "$PG_URL_ORIG" -c "SELECT 1;" &> /dev/null; then
        log_error "Falha na conexão com banco origem"
        exit 1
    fi
    log_success "Conexão origem OK"
    
    if ! psql "$PG_URL_DEST" -c "SELECT 1;" &> /dev/null; then
        log_error "Falha na conexão com banco destino"
        exit 1
    fi
    log_success "Conexão destino OK"
    
    generate_report
    verify_advanced
    
    echo ""
    log_success "Verificação concluída!"
}

main "$@"
