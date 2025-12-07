#!/bin/bash

# =============================================================================
# Supabase Cloud → Local Export Script
# Exporta dados do Supabase Cloud para arquivos SQL
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
EXPORT_DIR="${SCRIPT_DIR}/exports"
CONFIG_FILE="${SCRIPT_DIR}/sync-config.env"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

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
    echo "  --all              Exportar todas as tabelas"
    echo "  --critical-only    Exportar apenas tabelas críticas"
    echo "  --content-only     Exportar apenas tabelas de conteúdo"
    echo "  --tables TABLE1,TABLE2  Exportar tabelas específicas"
    echo "  --exclude-logs     Excluir tabelas de logs (padrão: true)"
    echo "  --include-logs     Incluir tabelas de logs"
    echo "  --dry-run          Mostrar o que seria exportado sem executar"
    echo "  --compress         Comprimir arquivos grandes (>10MB)"
    echo "  --help             Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0 --all"
    echo "  $0 --critical-only"
    echo "  $0 --tables profiles,user_roles,clientes"
}

# Carregar configuração
load_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        log_error "Arquivo de configuração não encontrado: $CONFIG_FILE"
        log_info "Copie o template: cp sync-config.env.example sync-config.env"
        exit 1
    fi
    source "$CONFIG_FILE"
    
    if [[ -z "$CLOUD_DB_URL" ]]; then
        log_error "CLOUD_DB_URL não configurado em $CONFIG_FILE"
        exit 1
    fi
}

# Criar diretório de exports
setup_export_dir() {
    mkdir -p "$EXPORT_DIR"
    CURRENT_EXPORT_DIR="${EXPORT_DIR}/${TIMESTAMP}"
    mkdir -p "$CURRENT_EXPORT_DIR"
    log_info "Diretório de export: $CURRENT_EXPORT_DIR"
}

# Tabelas críticas (sempre exportar)
CRITICAL_TABLES=(
    "profiles"
    "user_roles"
    "clientes"
    "subscription_plans"
    "user_subscriptions"
    "whatsapp_config"
    "mercado_pago_config"
    "app_feature_flags"
    "storage_config"
    "admin_phones"
    "affiliate_tiers"
    "affiliates"
    "discount_coupons"
    "homepage_content"
    "homepage_faqs"
    "notification_templates"
    "system_settings"
)

# Tabelas de conteúdo
CONTENT_TABLES=(
    "m3u_sync_sources"
    "m3u_sync_entries"
    "m3u_custom_lists"
    "m3u_categories"
    "m3u_channels"
    "m3u_lists"
    "content_metadata"
    "epg_data"
    "favorites"
    "viewer_profiles"
    "user_profiles"
    "watch_history"
    "channel_usage_stats"
)

# Tabelas de logs (opcionais)
LOG_TABLES=(
    "activity_logs"
    "auth_sessions_log"
    "metrics_snapshots"
    "health_snapshots"
    "r2_migration_logs"
    "security_events"
    "notification_logs"
    "m3u_sync_jobs"
    "m3u_sync_errors"
)

# Exportar uma tabela
export_table() {
    local table_name=$1
    local output_file="${CURRENT_EXPORT_DIR}/${table_name}.sql"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Exportaria: $table_name"
        return 0
    fi
    
    log_info "Exportando: $table_name..."
    
    # Usar pg_dump para exportar apenas dados da tabela
    PGPASSWORD=$(echo "$CLOUD_DB_URL" | sed -n 's/.*:\([^@]*\)@.*/\1/p') \
    pg_dump "$CLOUD_DB_URL" \
        --data-only \
        --table="public.$table_name" \
        --no-owner \
        --no-privileges \
        --disable-triggers \
        --column-inserts \
        --on-conflict-do-nothing \
        > "$output_file" 2>/dev/null || {
            log_warning "Falha ao exportar $table_name (tabela pode não existir)"
            rm -f "$output_file"
            return 1
        }
    
    # Verificar se o arquivo tem dados
    if [[ -s "$output_file" ]]; then
        local line_count=$(wc -l < "$output_file")
        local file_size=$(du -h "$output_file" | cut -f1)
        log_success "$table_name: $line_count linhas ($file_size)"
        
        # Comprimir se muito grande
        if [[ "$COMPRESS" == "true" ]]; then
            local size_bytes=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null)
            if [[ $size_bytes -gt 10485760 ]]; then # > 10MB
                log_info "Comprimindo $table_name..."
                gzip "$output_file"
                log_success "Comprimido: ${output_file}.gz"
            fi
        fi
        
        return 0
    else
        log_warning "$table_name: tabela vazia ou sem dados"
        rm -f "$output_file"
        return 1
    fi
}

# Exportar conjunto de tabelas
export_tables() {
    local tables=("$@")
    local success_count=0
    local fail_count=0
    
    for table in "${tables[@]}"; do
        if export_table "$table"; then
            ((success_count++))
        else
            ((fail_count++))
        fi
    done
    
    log_info "Exportadas: $success_count | Falhas/Vazias: $fail_count"
}

# Gerar arquivo de manifest
generate_manifest() {
    local manifest_file="${CURRENT_EXPORT_DIR}/manifest.json"
    
    echo "{" > "$manifest_file"
    echo "  \"timestamp\": \"$TIMESTAMP\"," >> "$manifest_file"
    echo "  \"source\": \"cloud\"," >> "$manifest_file"
    echo "  \"files\": [" >> "$manifest_file"
    
    local first=true
    for file in "$CURRENT_EXPORT_DIR"/*.sql "$CURRENT_EXPORT_DIR"/*.sql.gz; do
        if [[ -f "$file" ]]; then
            local filename=$(basename "$file")
            local size=$(du -h "$file" | cut -f1)
            local checksum=$(md5sum "$file" 2>/dev/null | cut -d' ' -f1 || md5 -q "$file" 2>/dev/null)
            
            if [[ "$first" == "true" ]]; then
                first=false
            else
                echo "," >> "$manifest_file"
            fi
            echo -n "    {\"file\": \"$filename\", \"size\": \"$size\", \"checksum\": \"$checksum\"}" >> "$manifest_file"
        fi
    done
    
    echo "" >> "$manifest_file"
    echo "  ]" >> "$manifest_file"
    echo "}" >> "$manifest_file"
    
    log_success "Manifest gerado: $manifest_file"
}

# Gerar script SQL combinado
generate_combined_sql() {
    local combined_file="${CURRENT_EXPORT_DIR}/combined_import.sql"
    
    echo "-- Combined import script generated at $TIMESTAMP" > "$combined_file"
    echo "-- Run this file to import all data" >> "$combined_file"
    echo "" >> "$combined_file"
    echo "BEGIN;" >> "$combined_file"
    echo "" >> "$combined_file"
    echo "-- Disable triggers temporarily" >> "$combined_file"
    echo "SET session_replication_role = 'replica';" >> "$combined_file"
    echo "" >> "$combined_file"
    
    # Ordem de importação (respeitando FKs)
    local import_order=(
        "subscription_plans"
        "affiliate_tiers"
        "profiles"
        "user_roles"
        "clientes"
        "user_subscriptions"
        "affiliates"
        "discount_coupons"
        "m3u_sync_sources"
        "m3u_custom_lists"
        "m3u_categories"
        "m3u_channels"
        "m3u_sync_entries"
    )
    
    for table in "${import_order[@]}"; do
        local sql_file="${CURRENT_EXPORT_DIR}/${table}.sql"
        if [[ -f "$sql_file" ]]; then
            echo "-- Import: $table" >> "$combined_file"
            echo "TRUNCATE TABLE public.$table CASCADE;" >> "$combined_file"
            cat "$sql_file" >> "$combined_file"
            echo "" >> "$combined_file"
        fi
    done
    
    echo "-- Re-enable triggers" >> "$combined_file"
    echo "SET session_replication_role = 'origin';" >> "$combined_file"
    echo "" >> "$combined_file"
    echo "COMMIT;" >> "$combined_file"
    
    log_success "Script combinado: $combined_file"
}

# Main
main() {
    echo ""
    echo "=========================================="
    echo "  Supabase Cloud → Local Export"
    echo "=========================================="
    echo ""
    
    # Parse argumentos
    EXPORT_MODE="all"
    EXCLUDE_LOGS="true"
    DRY_RUN="false"
    COMPRESS="false"
    SPECIFIC_TABLES=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --all) EXPORT_MODE="all"; shift ;;
            --critical-only) EXPORT_MODE="critical"; shift ;;
            --content-only) EXPORT_MODE="content"; shift ;;
            --tables) SPECIFIC_TABLES="$2"; shift 2 ;;
            --exclude-logs) EXCLUDE_LOGS="true"; shift ;;
            --include-logs) EXCLUDE_LOGS="false"; shift ;;
            --dry-run) DRY_RUN="true"; shift ;;
            --compress) COMPRESS="true"; shift ;;
            --help) show_help; exit 0 ;;
            *) log_error "Opção desconhecida: $1"; show_help; exit 1 ;;
        esac
    done
    
    # Carregar configuração
    load_config
    
    # Criar diretório
    setup_export_dir
    
    # Determinar tabelas a exportar
    TABLES_TO_EXPORT=()
    
    if [[ -n "$SPECIFIC_TABLES" ]]; then
        IFS=',' read -ra TABLES_TO_EXPORT <<< "$SPECIFIC_TABLES"
        log_info "Exportando tabelas específicas: ${TABLES_TO_EXPORT[*]}"
    else
        case $EXPORT_MODE in
            all)
                TABLES_TO_EXPORT+=("${CRITICAL_TABLES[@]}")
                TABLES_TO_EXPORT+=("${CONTENT_TABLES[@]}")
                if [[ "$EXCLUDE_LOGS" != "true" ]]; then
                    TABLES_TO_EXPORT+=("${LOG_TABLES[@]}")
                fi
                log_info "Exportando todas as tabelas (logs excluídos: $EXCLUDE_LOGS)"
                ;;
            critical)
                TABLES_TO_EXPORT+=("${CRITICAL_TABLES[@]}")
                log_info "Exportando apenas tabelas críticas"
                ;;
            content)
                TABLES_TO_EXPORT+=("${CONTENT_TABLES[@]}")
                log_info "Exportando apenas tabelas de conteúdo"
                ;;
        esac
    fi
    
    echo ""
    log_info "Total de tabelas: ${#TABLES_TO_EXPORT[@]}"
    echo ""
    
    # Exportar
    export_tables "${TABLES_TO_EXPORT[@]}"
    
    # Gerar manifest e script combinado
    if [[ "$DRY_RUN" != "true" ]]; then
        echo ""
        generate_manifest
        generate_combined_sql
    fi
    
    echo ""
    echo "=========================================="
    log_success "Export concluído!"
    echo "=========================================="
    echo ""
    echo "Próximos passos:"
    echo "  1. Verifique os arquivos em: $CURRENT_EXPORT_DIR"
    echo "  2. Execute: ./supabase-import.sh --dir $CURRENT_EXPORT_DIR"
    echo ""
}

main "$@"
