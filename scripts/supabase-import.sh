#!/bin/bash

# =============================================================================
# Supabase Local Import Script
# Importa dados exportados do Cloud para o Supabase Local
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/sync-config.env"

# Funções de log
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Mostrar ajuda
show_help() {
    echo "Uso: $0 [opções]"
    echo ""
    echo "Opções:"
    echo "  --dir DIRECTORY     Diretório com arquivos de export"
    echo "  --file FILE         Arquivo SQL único para importar"
    echo "  --combined          Usar arquivo combined_import.sql"
    echo "  --tables TABLE1,TABLE2  Importar apenas tabelas específicas"
    echo "  --dry-run           Mostrar o que seria importado sem executar"
    echo "  --no-truncate       Não limpar tabelas antes de importar"
    echo "  --force             Forçar importação mesmo com erros"
    echo "  --help              Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0 --dir exports/2025-12-07_10-30-00"
    echo "  $0 --dir exports/2025-12-07_10-30-00 --combined"
    echo "  $0 --file exports/2025-12-07_10-30-00/profiles.sql"
    echo "  $0 --dir exports/latest --tables profiles,user_roles"
}

# Carregar configuração
load_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        log_error "Arquivo de configuração não encontrado: $CONFIG_FILE"
        log_info "Copie o template: cp sync-config.env.example sync-config.env"
        exit 1
    fi
    source "$CONFIG_FILE"
    
    if [[ -z "$LOCAL_DB_URL" ]]; then
        log_error "LOCAL_DB_URL não configurado em $CONFIG_FILE"
        exit 1
    fi
}

# Verificar se Supabase local está rodando
check_local_supabase() {
    log_info "Verificando Supabase local..."
    
    if ! command -v supabase &> /dev/null; then
        log_warning "Supabase CLI não encontrado. Tentando conectar diretamente..."
    else
        if supabase status &> /dev/null; then
            log_success "Supabase local está rodando"
        else
            log_warning "Supabase local pode não estar rodando. Tentando continuar..."
        fi
    fi
    
    # Testar conexão
    if psql "$LOCAL_DB_URL" -c "SELECT 1" &> /dev/null; then
        log_success "Conexão com banco local OK"
    else
        log_error "Não foi possível conectar ao banco local"
        log_info "Verifique se LOCAL_DB_URL está correto e o Supabase está rodando"
        exit 1
    fi
}

# Ordem de importação (respeitando foreign keys)
IMPORT_ORDER=(
    # Sem dependências
    "subscription_plans"
    "affiliate_tiers"
    "app_feature_flags"
    "storage_config"
    "system_settings"
    "homepage_content"
    "homepage_faqs"
    "notification_templates"
    "whatsapp_config"
    "mercado_pago_config"
    "admin_phones"
    
    # Dependem de subscription_plans/tiers
    "profiles"
    "user_roles"
    "clientes"
    "affiliates"
    "user_subscriptions"
    "discount_coupons"
    
    # M3U - ordem de dependências
    "m3u_sync_sources"
    "m3u_custom_lists"
    "m3u_categories"
    "m3u_channels"
    "m3u_sync_entries"
    "m3u_lists"
    
    # Conteúdo
    "content_metadata"
    "epg_data"
    
    # Perfis de usuário
    "user_profiles"
    "viewer_profiles"
    "favorites"
    "watch_history"
    "channel_usage_stats"
    
    # Logs (opcionais)
    "activity_logs"
    "auth_sessions_log"
    "notification_logs"
)

# Descomprimir arquivo se necessário
decompress_if_needed() {
    local file=$1
    
    if [[ "$file" == *.gz ]]; then
        log_info "Descomprimindo: $file"
        gunzip -k "$file"
        echo "${file%.gz}"
    else
        echo "$file"
    fi
}

# Importar uma tabela
import_table() {
    local table_name=$1
    local sql_file=$2
    
    if [[ ! -f "$sql_file" ]]; then
        # Tentar versão comprimida
        if [[ -f "${sql_file}.gz" ]]; then
            sql_file=$(decompress_if_needed "${sql_file}.gz")
        else
            log_warning "Arquivo não encontrado: $sql_file"
            return 1
        fi
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Importaria: $table_name de $sql_file"
        return 0
    fi
    
    log_info "Importando: $table_name..."
    
    # Contar linhas antes
    local count_before=$(psql "$LOCAL_DB_URL" -t -c "SELECT COUNT(*) FROM public.$table_name" 2>/dev/null | tr -d ' ' || echo "0")
    
    # Truncar se necessário
    if [[ "$NO_TRUNCATE" != "true" ]]; then
        psql "$LOCAL_DB_URL" -c "TRUNCATE TABLE public.$table_name CASCADE" 2>/dev/null || true
    fi
    
    # Importar
    if psql "$LOCAL_DB_URL" -f "$sql_file" 2>/dev/null; then
        local count_after=$(psql "$LOCAL_DB_URL" -t -c "SELECT COUNT(*) FROM public.$table_name" 2>/dev/null | tr -d ' ')
        log_success "$table_name: $count_after registros importados (antes: $count_before)"
        return 0
    else
        if [[ "$FORCE" == "true" ]]; then
            log_warning "Erro ao importar $table_name (continuando com --force)"
            return 0
        else
            log_error "Erro ao importar $table_name"
            return 1
        fi
    fi
}

# Importar usando arquivo combinado
import_combined() {
    local combined_file="${IMPORT_DIR}/combined_import.sql"
    
    if [[ ! -f "$combined_file" ]]; then
        log_error "Arquivo combinado não encontrado: $combined_file"
        exit 1
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Importaria arquivo combinado: $combined_file"
        return 0
    fi
    
    log_info "Importando arquivo combinado..."
    
    if psql "$LOCAL_DB_URL" -f "$combined_file"; then
        log_success "Importação combinada concluída"
    else
        log_error "Erro na importação combinada"
        exit 1
    fi
}

# Importar diretório
import_directory() {
    local success_count=0
    local fail_count=0
    local skip_count=0
    
    # Desabilitar triggers
    log_info "Desabilitando triggers..."
    psql "$LOCAL_DB_URL" -c "SET session_replication_role = 'replica'" 2>/dev/null || true
    
    for table in "${IMPORT_ORDER[@]}"; do
        # Verificar se deve importar esta tabela
        if [[ -n "$SPECIFIC_TABLES" ]]; then
            if [[ ! " $SPECIFIC_TABLES " =~ " $table " ]]; then
                continue
            fi
        fi
        
        local sql_file="${IMPORT_DIR}/${table}.sql"
        
        if [[ -f "$sql_file" ]] || [[ -f "${sql_file}.gz" ]]; then
            if import_table "$table" "$sql_file"; then
                ((success_count++))
            else
                ((fail_count++))
            fi
        else
            ((skip_count++))
        fi
    done
    
    # Reabilitar triggers
    log_info "Reabilitando triggers..."
    psql "$LOCAL_DB_URL" -c "SET session_replication_role = 'origin'" 2>/dev/null || true
    
    echo ""
    log_info "Resultados: Sucesso=$success_count | Falhas=$fail_count | Ignoradas=$skip_count"
}

# Verificar integridade
verify_import() {
    log_info "Verificando integridade dos dados..."
    
    local tables_with_data=0
    local total_records=0
    
    for table in "${IMPORT_ORDER[@]}"; do
        local count=$(psql "$LOCAL_DB_URL" -t -c "SELECT COUNT(*) FROM public.$table" 2>/dev/null | tr -d ' ' || echo "0")
        if [[ "$count" -gt 0 ]]; then
            ((tables_with_data++))
            total_records=$((total_records + count))
        fi
    done
    
    log_success "Tabelas com dados: $tables_with_data"
    log_success "Total de registros: $total_records"
}

# Main
main() {
    echo ""
    echo "=========================================="
    echo "  Supabase Local Import"
    echo "=========================================="
    echo ""
    
    # Parse argumentos
    IMPORT_DIR=""
    IMPORT_FILE=""
    USE_COMBINED="false"
    SPECIFIC_TABLES=""
    DRY_RUN="false"
    NO_TRUNCATE="false"
    FORCE="false"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dir) IMPORT_DIR="$2"; shift 2 ;;
            --file) IMPORT_FILE="$2"; shift 2 ;;
            --combined) USE_COMBINED="true"; shift ;;
            --tables) SPECIFIC_TABLES="$2"; shift 2 ;;
            --dry-run) DRY_RUN="true"; shift ;;
            --no-truncate) NO_TRUNCATE="true"; shift ;;
            --force) FORCE="true"; shift ;;
            --help) show_help; exit 0 ;;
            *) log_error "Opção desconhecida: $1"; show_help; exit 1 ;;
        esac
    done
    
    # Validar argumentos
    if [[ -z "$IMPORT_DIR" ]] && [[ -z "$IMPORT_FILE" ]]; then
        log_error "Especifique --dir ou --file"
        show_help
        exit 1
    fi
    
    # Carregar configuração
    load_config
    
    # Verificar Supabase local
    check_local_supabase
    
    echo ""
    
    # Executar importação
    if [[ -n "$IMPORT_FILE" ]]; then
        # Importar arquivo único
        local table_name=$(basename "$IMPORT_FILE" .sql)
        table_name=$(basename "$table_name" .sql.gz)
        import_table "$table_name" "$IMPORT_FILE"
    elif [[ "$USE_COMBINED" == "true" ]]; then
        # Usar arquivo combinado
        import_combined
    else
        # Importar diretório
        if [[ ! -d "$IMPORT_DIR" ]]; then
            log_error "Diretório não encontrado: $IMPORT_DIR"
            exit 1
        fi
        import_directory
    fi
    
    # Verificar
    if [[ "$DRY_RUN" != "true" ]]; then
        echo ""
        verify_import
    fi
    
    echo ""
    echo "=========================================="
    log_success "Importação concluída!"
    echo "=========================================="
    echo ""
}

main "$@"
