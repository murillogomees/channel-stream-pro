#!/bin/bash
# =============================================================================
# SUPABASE MIGRATION: Health Check Tests
# Testes automatizados pós-migração
# =============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# CONFIGURAÇÃO
# -----------------------------------------------------------------------------
SUPABASE_URL="${SUPABASE_URL_DEST:-{{SUPABASE_URL_DEST}}}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY_DEST:-{{SUPABASE_ANON_KEY_DEST}}}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY_DEST:-{{SUPABASE_SERVICE_KEY_DEST}}}"
PG_URL="${PG_URL_DEST:-{{PG_URL_DEST}}}"

TEST_EMAIL="${TEST_EMAIL:-test_migration@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestMigration123!}"

OUTPUT_FILE="./healthcheck_$(date +%Y%m%d_%H%M%S).log"

# Contadores
PASSED=0
FAILED=0
SKIPPED=0

# -----------------------------------------------------------------------------
# CORES PARA OUTPUT
# -----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$OUTPUT_FILE"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1" | tee -a "$OUTPUT_FILE"; ((PASSED++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1" | tee -a "$OUTPUT_FILE"; ((FAILED++)); }
log_skip() { echo -e "${YELLOW}[SKIP]${NC} $1" | tee -a "$OUTPUT_FILE"; ((SKIPPED++)); }

# -----------------------------------------------------------------------------
# VALIDAÇÕES
# -----------------------------------------------------------------------------
validate_config() {
    log_info "Validando configuração..."
    
    local missing=0
    
    if [[ "$SUPABASE_URL" == *"{{"* ]]; then
        log_fail "SUPABASE_URL_DEST não configurada"
        ((missing++))
    fi
    
    if [[ "$SUPABASE_ANON_KEY" == *"{{"* ]]; then
        log_fail "SUPABASE_ANON_KEY_DEST não configurada"
        ((missing++))
    fi
    
    if [[ "$SUPABASE_SERVICE_KEY" == *"{{"* ]]; then
        log_fail "SUPABASE_SERVICE_KEY_DEST não configurada"
        ((missing++))
    fi
    
    if [[ $missing -gt 0 ]]; then
        echo ""
        echo "Configure as variáveis de ambiente:"
        echo "  export SUPABASE_URL_DEST='https://seu-supabase.com'"
        echo "  export SUPABASE_ANON_KEY_DEST='eyJ...'"
        echo "  export SUPABASE_SERVICE_KEY_DEST='eyJ...'"
        exit 1
    fi
    
    log_success "Configuração validada"
}

# -----------------------------------------------------------------------------
# TESTE 1: CONECTIVIDADE BÁSICA
# -----------------------------------------------------------------------------
test_connectivity() {
    log_info "Teste 1: Conectividade básica..."
    
    # Health check endpoint
    local response=$(curl -s -o /dev/null -w "%{http_code}" \
        "${SUPABASE_URL}/rest/v1/" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        --connect-timeout 10 || echo "000")
    
    if [[ "$response" == "200" ]] || [[ "$response" == "401" ]]; then
        log_success "REST API acessível (HTTP $response)"
    else
        log_fail "REST API inacessível (HTTP $response)"
    fi
}

# -----------------------------------------------------------------------------
# TESTE 2: AUTENTICAÇÃO
# -----------------------------------------------------------------------------
test_auth() {
    log_info "Teste 2: Autenticação (GoTrue)..."
    
    # Health check do GoTrue
    local auth_health=$(curl -s -o /dev/null -w "%{http_code}" \
        "${SUPABASE_URL}/auth/v1/health" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        --connect-timeout 10 || echo "000")
    
    if [[ "$auth_health" == "200" ]]; then
        log_success "GoTrue health OK"
    else
        log_fail "GoTrue health falhou (HTTP $auth_health)"
    fi
    
    # Teste de signup (opcional)
    log_info "Testando signup..."
    local signup_response=$(curl -s -X POST \
        "${SUPABASE_URL}/auth/v1/signup" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" \
        --connect-timeout 10 || echo '{"error":"timeout"}')
    
    if echo "$signup_response" | grep -q '"access_token"'; then
        log_success "Signup funcionando"
    elif echo "$signup_response" | grep -q 'already registered'; then
        log_success "Signup funcionando (usuário já existe)"
    else
        log_skip "Signup: resposta inesperada"
    fi
}

# -----------------------------------------------------------------------------
# TESTE 3: DATABASE QUERIES
# -----------------------------------------------------------------------------
test_database() {
    log_info "Teste 3: Database queries..."
    
    # Query simples via REST
    local query_response=$(curl -s -o /dev/null -w "%{http_code}" \
        "${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        --connect-timeout 10 || echo "000")
    
    if [[ "$query_response" == "200" ]]; then
        log_success "Query REST funcionando"
    else
        log_fail "Query REST falhou (HTTP $query_response)"
    fi
    
    # Verificar contagem de profiles
    local profiles_count=$(curl -s \
        "${SUPABASE_URL}/rest/v1/profiles?select=count" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Prefer: count=exact" \
        --connect-timeout 10 | grep -o '"count":[0-9]*' | grep -o '[0-9]*' || echo "0")
    
    if [[ "$profiles_count" -gt 0 ]]; then
        log_success "Profiles table tem $profiles_count registros"
    else
        log_skip "Profiles table vazia ou inacessível"
    fi
}

# -----------------------------------------------------------------------------
# TESTE 4: STORAGE
# -----------------------------------------------------------------------------
test_storage() {
    log_info "Teste 4: Storage..."
    
    # Listar buckets
    local buckets_response=$(curl -s -o /dev/null -w "%{http_code}" \
        "${SUPABASE_URL}/storage/v1/bucket" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        --connect-timeout 10 || echo "000")
    
    if [[ "$buckets_response" == "200" ]]; then
        log_success "Storage API acessível"
        
        # Contar buckets
        local buckets=$(curl -s \
            "${SUPABASE_URL}/storage/v1/bucket" \
            -H "apikey: ${SUPABASE_ANON_KEY}" \
            -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
            --connect-timeout 10)
        
        local bucket_count=$(echo "$buckets" | grep -o '"id"' | wc -l | tr -d ' ')
        log_info "Buckets encontrados: $bucket_count"
    else
        log_fail "Storage API inacessível (HTTP $buckets_response)"
    fi
}

# -----------------------------------------------------------------------------
# TESTE 5: REALTIME
# -----------------------------------------------------------------------------
test_realtime() {
    log_info "Teste 5: Realtime..."
    
    # WebSocket health
    local realtime_url="${SUPABASE_URL/https/wss}/realtime/v1/websocket"
    
    # Teste básico de conexão (não conecta de fato, só verifica se o endpoint responde)
    local realtime_http="${SUPABASE_URL}/realtime/v1/"
    local realtime_response=$(curl -s -o /dev/null -w "%{http_code}" \
        "$realtime_http" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        --connect-timeout 10 || echo "000")
    
    if [[ "$realtime_response" != "000" ]]; then
        log_success "Realtime endpoint acessível"
    else
        log_skip "Realtime endpoint não testável via HTTP"
    fi
}

# -----------------------------------------------------------------------------
# TESTE 6: EDGE FUNCTIONS
# -----------------------------------------------------------------------------
test_edge_functions() {
    log_info "Teste 6: Edge Functions..."
    
    # Listar functions
    local functions_response=$(curl -s -o /dev/null -w "%{http_code}" \
        "${SUPABASE_URL}/functions/v1/" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        --connect-timeout 10 || echo "000")
    
    if [[ "$functions_response" == "200" ]] || [[ "$functions_response" == "404" ]]; then
        log_success "Edge Functions endpoint acessível"
    else
        log_fail "Edge Functions endpoint inacessível (HTTP $functions_response)"
    fi
}

# -----------------------------------------------------------------------------
# TESTE 7: POSTGRES DIRETO
# -----------------------------------------------------------------------------
test_postgres_direct() {
    log_info "Teste 7: PostgreSQL direto..."
    
    if [[ "$PG_URL" == *"{{"* ]]; then
        log_skip "PG_URL_DEST não configurada"
        return
    fi
    
    if psql "$PG_URL" -c "SELECT 1;" &> /dev/null; then
        log_success "Conexão PostgreSQL direta OK"
        
        # Verificar tabelas
        local table_count=$(psql "$PG_URL" -t -c "
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public';
        " 2>/dev/null | tr -d ' ')
        
        log_info "Tabelas no schema public: $table_count"
    else
        log_fail "Conexão PostgreSQL direta falhou"
    fi
}

# -----------------------------------------------------------------------------
# TESTE 8: RLS POLICIES
# -----------------------------------------------------------------------------
test_rls() {
    log_info "Teste 8: RLS Policies..."
    
    if [[ "$PG_URL" == *"{{"* ]]; then
        log_skip "PG_URL_DEST não configurada"
        return
    fi
    
    local rls_count=$(psql "$PG_URL" -t -c "
        SELECT COUNT(*) FROM pg_policies;
    " 2>/dev/null | tr -d ' ')
    
    if [[ "$rls_count" -gt 0 ]]; then
        log_success "RLS policies encontradas: $rls_count"
    else
        log_skip "Nenhuma RLS policy encontrada"
    fi
    
    # Verificar tabelas com RLS habilitado
    local rls_enabled=$(psql "$PG_URL" -t -c "
        SELECT COUNT(*) FROM pg_tables 
        WHERE schemaname = 'public' AND rowsecurity = true;
    " 2>/dev/null | tr -d ' ')
    
    log_info "Tabelas com RLS habilitado: $rls_enabled"
}

# -----------------------------------------------------------------------------
# RESUMO
# -----------------------------------------------------------------------------
print_summary() {
    echo "" | tee -a "$OUTPUT_FILE"
    echo "=============================================="  | tee -a "$OUTPUT_FILE"
    echo " RESUMO DOS TESTES" | tee -a "$OUTPUT_FILE"
    echo "=============================================="  | tee -a "$OUTPUT_FILE"
    echo "" | tee -a "$OUTPUT_FILE"
    echo -e "${GREEN}✅ Passou: $PASSED${NC}" | tee -a "$OUTPUT_FILE"
    echo -e "${RED}❌ Falhou: $FAILED${NC}" | tee -a "$OUTPUT_FILE"
    echo -e "${YELLOW}⏭️  Pulou: $SKIPPED${NC}" | tee -a "$OUTPUT_FILE"
    echo "" | tee -a "$OUTPUT_FILE"
    
    local total=$((PASSED + FAILED))
    if [[ $total -gt 0 ]]; then
        local success_rate=$((PASSED * 100 / total))
        echo "Taxa de sucesso: ${success_rate}%" | tee -a "$OUTPUT_FILE"
    fi
    
    echo "" | tee -a "$OUTPUT_FILE"
    echo "Log salvo em: $OUTPUT_FILE" | tee -a "$OUTPUT_FILE"
    
    if [[ $FAILED -gt 0 ]]; then
        echo "" | tee -a "$OUTPUT_FILE"
        log_fail "Alguns testes falharam. Verifique a configuração."
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
main() {
    echo "=============================================="
    echo " SUPABASE MIGRATION: HEALTH CHECK"
    echo "=============================================="
    echo ""
    echo "Supabase URL: $SUPABASE_URL"
    echo "Data: $(date)"
    echo ""
    
    validate_config
    echo ""
    
    test_connectivity
    test_auth
    test_database
    test_storage
    test_realtime
    test_edge_functions
    test_postgres_direct
    test_rls
    
    print_summary
}

main "$@"
