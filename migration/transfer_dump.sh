#!/bin/bash
# =============================================================================
# SUPABASE MIGRATION: Transfer Dump to VPS
# Transfere arquivos de dump para a VPS Hostinger
# =============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# CONFIGURAÇÃO - Substituir pelos valores reais
# -----------------------------------------------------------------------------
SSH_HOST="${SSH_HOST:-{{SSH_HOST}}}"
SSH_USER="${SSH_USER:-{{SSH_USER}}}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"  # Caminho para chave SSH (opcional)

DUMP_DIR="${DUMP_DIR:-./dumps}"
REMOTE_DIR="${REMOTE_DIR:-/home/${SSH_USER}/supabase_migration}"

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
    
    if [[ "$SSH_HOST" == "{{SSH_HOST}}" ]]; then
        log_error "Variável SSH_HOST não configurada!"
        log_info "Execute: export SSH_HOST='seu-servidor.hostinger.com'"
        exit 1
    fi
    
    if [[ "$SSH_USER" == "{{SSH_USER}}" ]]; then
        log_error "Variável SSH_USER não configurada!"
        log_info "Execute: export SSH_USER='root'"
        exit 1
    fi
    
    if [[ ! -d "$DUMP_DIR" ]]; then
        log_error "Diretório de dumps não encontrado: $DUMP_DIR"
        exit 1
    fi
    
    # Encontrar o dump mais recente
    LATEST_DUMP=$(ls -t "$DUMP_DIR"/supabase_dump_*.custom 2>/dev/null | head -1)
    LATEST_DUMP_GZ=$(ls -t "$DUMP_DIR"/supabase_dump_*.custom.gz 2>/dev/null | head -1)
    
    if [[ -z "$LATEST_DUMP" && -z "$LATEST_DUMP_GZ" ]]; then
        log_error "Nenhum arquivo de dump encontrado em $DUMP_DIR"
        exit 1
    fi
    
    log_success "Ambiente validado"
}

# -----------------------------------------------------------------------------
# CONSTRUIR OPÇÕES SSH
# -----------------------------------------------------------------------------
get_ssh_opts() {
    local opts="-o StrictHostKeyChecking=no -o ConnectTimeout=30"
    
    if [[ -n "$SSH_KEY" && -f "$SSH_KEY" ]]; then
        opts="$opts -i $SSH_KEY"
    fi
    
    opts="$opts -p $SSH_PORT"
    
    echo "$opts"
}

# -----------------------------------------------------------------------------
# TESTAR CONEXÃO SSH
# -----------------------------------------------------------------------------
test_ssh_connection() {
    log_info "Testando conexão SSH com VPS..."
    
    local ssh_opts=$(get_ssh_opts)
    
    if ssh $ssh_opts "${SSH_USER}@${SSH_HOST}" "echo 'Conexão OK'" &> /dev/null; then
        log_success "Conexão SSH OK"
    else
        log_error "Falha na conexão SSH"
        log_info "Verifique: SSH_HOST, SSH_USER, SSH_KEY, SSH_PORT"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# CRIAR DIRETÓRIO REMOTO
# -----------------------------------------------------------------------------
create_remote_dir() {
    log_info "Criando diretório remoto: $REMOTE_DIR"
    
    local ssh_opts=$(get_ssh_opts)
    
    ssh $ssh_opts "${SSH_USER}@${SSH_HOST}" "mkdir -p $REMOTE_DIR"
    
    log_success "Diretório remoto criado"
}

# -----------------------------------------------------------------------------
# TRANSFERIR ARQUIVOS
# -----------------------------------------------------------------------------
transfer_files() {
    log_info "Iniciando transferência de arquivos..."
    
    local ssh_opts=$(get_ssh_opts)
    local scp_opts="-o StrictHostKeyChecking=no -o ConnectTimeout=30 -P $SSH_PORT"
    
    if [[ -n "$SSH_KEY" && -f "$SSH_KEY" ]]; then
        scp_opts="$scp_opts -i $SSH_KEY"
    fi
    
    # Preferir arquivo comprimido se existir
    if [[ -n "$LATEST_DUMP_GZ" && -f "$LATEST_DUMP_GZ" ]]; then
        log_info "Transferindo dump comprimido: $LATEST_DUMP_GZ"
        TRANSFER_FILE="$LATEST_DUMP_GZ"
    else
        log_info "Transferindo dump: $LATEST_DUMP"
        TRANSFER_FILE="$LATEST_DUMP"
    fi
    
    local file_size=$(du -h "$TRANSFER_FILE" | cut -f1)
    log_info "Tamanho do arquivo: $file_size"
    
    # Usar rsync se disponível (mais eficiente, com progresso)
    if command -v rsync &> /dev/null; then
        log_info "Usando rsync para transferência..."
        
        local rsync_opts="-avz --progress"
        if [[ -n "$SSH_KEY" && -f "$SSH_KEY" ]]; then
            rsync_opts="$rsync_opts -e 'ssh -i $SSH_KEY -p $SSH_PORT'"
        else
            rsync_opts="$rsync_opts -e 'ssh -p $SSH_PORT'"
        fi
        
        eval rsync $rsync_opts "$TRANSFER_FILE" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"
    else
        log_info "Usando scp para transferência..."
        scp $scp_opts "$TRANSFER_FILE" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"
    fi
    
    log_success "Dump transferido"
    
    # Transferir arquivos auxiliares
    log_info "Transferindo arquivos auxiliares..."
    
    # Extensions list
    local ext_file=$(ls -t "$DUMP_DIR"/extensions_list_*.txt 2>/dev/null | head -1)
    if [[ -n "$ext_file" ]]; then
        scp $scp_opts "$ext_file" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"
    fi
    
    # Checksums
    local checksum_file=$(ls -t "$DUMP_DIR"/checksums_*.sha256 2>/dev/null | head -1)
    if [[ -n "$checksum_file" ]]; then
        scp $scp_opts "$checksum_file" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"
    fi
    
    # Table stats
    local stats_file=$(ls -t "$DUMP_DIR"/table_stats_*.txt 2>/dev/null | head -1)
    if [[ -n "$stats_file" ]]; then
        scp $scp_opts "$stats_file" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"
    fi
    
    log_success "Arquivos auxiliares transferidos"
}

# -----------------------------------------------------------------------------
# VERIFICAR TRANSFERÊNCIA
# -----------------------------------------------------------------------------
verify_transfer() {
    log_info "Verificando arquivos no servidor remoto..."
    
    local ssh_opts=$(get_ssh_opts)
    
    ssh $ssh_opts "${SSH_USER}@${SSH_HOST}" "ls -lah $REMOTE_DIR/"
    
    log_success "Verificação concluída"
}

# -----------------------------------------------------------------------------
# TRANSFERIR SCRIPTS DE MIGRAÇÃO
# -----------------------------------------------------------------------------
transfer_migration_scripts() {
    log_info "Transferindo scripts de migração..."
    
    local scp_opts="-o StrictHostKeyChecking=no -P $SSH_PORT"
    if [[ -n "$SSH_KEY" && -f "$SSH_KEY" ]]; then
        scp_opts="$scp_opts -i $SSH_KEY"
    fi
    
    # Transferir scripts principais
    local script_dir="$(dirname "$0")"
    
    for script in migrate_db.sh recreate_extensions.sql verify_counts.sh healthcheck_tests.sh; do
        if [[ -f "${script_dir}/${script}" ]]; then
            scp $scp_opts "${script_dir}/${script}" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"
            log_success "Transferido: $script"
        fi
    done
    
    # Tornar scripts executáveis
    local ssh_opts=$(get_ssh_opts)
    ssh $ssh_opts "${SSH_USER}@${SSH_HOST}" "chmod +x ${REMOTE_DIR}/*.sh 2>/dev/null || true"
}

# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
main() {
    echo "=============================================="
    echo " SUPABASE MIGRATION: TRANSFER TO VPS"
    echo "=============================================="
    echo ""
    
    validate_environment
    test_ssh_connection
    create_remote_dir
    transfer_files
    transfer_migration_scripts
    verify_transfer
    
    echo ""
    echo "=============================================="
    log_success "TRANSFERÊNCIA CONCLUÍDA!"
    echo "=============================================="
    echo ""
    echo "Arquivos transferidos para: ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"
    echo ""
    echo "Próximo passo:"
    echo "  1. SSH para a VPS: ssh ${SSH_USER}@${SSH_HOST}"
    echo "  2. Navegue até: cd ${REMOTE_DIR}"
    echo "  3. Execute: ./migrate_db.sh"
}

main "$@"
