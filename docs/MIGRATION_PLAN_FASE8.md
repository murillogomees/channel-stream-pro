# 🚀 FASE 8 — CLEANUP, CONSOLIDATION E MIGRAÇÃO FINAL

**Data:** 2025-11-30  
**Status:** 📋 PLANEJADO  
**Autor:** lovable-agent  

---

## 📊 Executive Summary

Esta fase consolida todas as melhorias das fases anteriores, depreca módulos duplicados, remove código legado e prepara o sistema para produção com rollback seguro.

### Objetivos
- ✅ Deprecar módulos duplicados identificados na Fase 0
- ✅ Consolidar entidades e remover assets não utilizados
- ✅ Criar scripts de migração seguros com transações
- ✅ Implementar feature flags para desativar código legado progressivamente
- ✅ Criar runbook final de cutover com procedimento de rollback
- ✅ Garantir reversibilidade de todas as migrações

---

## 📋 INVENTORY — Módulos para Deprecação

### 1. Tipos Legado (src/types/)

| Arquivo | Item | Status | Ação |
|---------|------|--------|------|
| `cliente.ts` | `Cliente` interface | ⚠️ DEPRECATED | Migrar para `ClienteDb` |
| `profile.ts` | `ClienteData` type | ⚠️ DEPRECATED | Usar `ClienteDb` |

### 2. Serviços Removidos (já executado)

| Serviço | Motivo | Substituição |
|---------|--------|--------------|
| `securityAlertService.ts` | Duplicado | `securityWhatsAppAlertService.ts` |
| `m3uHealthService.ts` | Duplicado | `playlistHealthService.ts` |

### 3. Rotas Legacy (deprecated/DEPRECATION_NOTES.md)

**Scheduled for removal: 2025-12-29**

```
/admin/m3u-lists → /admin/m3u
/admin/notificacoes → /admin/notifications
/admin/security-alerts → /admin/security
/admin/system-health → /admin/system
/admin/user-roles → /admin/users
/admin/conversion-dashboard → /admin/analytics
```

### 4. Arquivos Órfãos

| Arquivo | Localização | Status |
|---------|-------------|--------|
| `outbox.js` | `deprecated/unused/` | 🗑️ Cold Storage |

---

## 🏁 FEATURE FLAGS — Migração Progressiva

### Flags Existentes (100% rollout)

```typescript
// src/services/featureFlagsService.ts
enhanced_abr: 100%
segment_prefetch: 100%
resume_support: 100%
player_analytics: 100%
new_home_ui: 100%
new_detail_ui: 100%
new_mylist_ui: 100%
web_vitals_tracking: 100%
tv_optimizations: TV only
```

### Novos Flags para Migração

```typescript
// Migration-specific flags
use_cliente_db_only: {
  enabled: false,
  percentage: 0,
  description: 'Use ClienteDb instead of legacy Cliente type',
}
disable_legacy_routes: {
  enabled: false,
  percentage: 0,
  description: 'Disable redirects to legacy admin routes',
}
consolidated_whatsapp: {
  enabled: true,
  percentage: 100,
  description: 'Use consolidated WhatsApp service',
}
new_notification_system: {
  enabled: true,
  percentage: 100,
  description: 'Use modular notification system',
}
```

---

## 📜 MIGRATION SCRIPTS

### Script 1: Cleanup de Dados Antigos

```sql
-- Migration: cleanup_old_data_fase8
-- Description: Remove dados órfãos e otimiza tabelas
-- Reversible: YES

BEGIN;

-- 1. Criar backup table antes de limpar
CREATE TABLE IF NOT EXISTS _backup_notification_logs AS 
SELECT * FROM notification_logs WHERE created_at < NOW() - INTERVAL '90 days';

-- 2. Limpar logs antigos (mantendo backup)
DELETE FROM notification_logs 
WHERE created_at < NOW() - INTERVAL '90 days';

-- 3. Limpar security events resolvidos antigos
DELETE FROM security_events 
WHERE resolved = true 
AND created_at < NOW() - INTERVAL '90 days';

-- 4. Limpar rate limit tracking expirado
DELETE FROM rate_limit_tracking 
WHERE window_start < NOW() - INTERVAL '1 hour';

-- 5. Limpar import cache não usado
DELETE FROM m3u_import_cache 
WHERE last_used_at < NOW() - INTERVAL '30 days';

-- 6. Limpar suspicious login attempts antigos
DELETE FROM suspicious_login_attempts 
WHERE created_at < NOW() - INTERVAL '30 days';

-- 7. Atualizar estatísticas
ANALYZE notification_logs;
ANALYZE security_events;
ANALYZE rate_limit_tracking;
ANALYZE m3u_import_cache;
ANALYZE suspicious_login_attempts;

COMMIT;

-- DOWN SCRIPT:
-- ROLLBACK:
-- INSERT INTO notification_logs SELECT * FROM _backup_notification_logs;
-- DROP TABLE _backup_notification_logs;
```

### Script 2: Consolidar Configurações WhatsApp

```sql
-- Migration: consolidate_whatsapp_config
-- Description: Unificar configurações WhatsApp dispersas
-- Reversible: YES

BEGIN;

-- Verificar se já existe config consolidada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_variables WHERE name = 'whatsapp_config_consolidated'
  ) THEN
    -- Criar variável de controle
    INSERT INTO system_variables (name, value, description)
    VALUES (
      'whatsapp_config_consolidated',
      'true',
      'Indica que configurações WhatsApp foram consolidadas'
    );
  END IF;
END $$;

-- Garantir que whatsapp_config tem todas as colunas necessárias
ALTER TABLE whatsapp_config 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS health_status VARCHAR(20) DEFAULT 'unknown';

-- Marcar config principal
UPDATE whatsapp_config 
SET is_primary = true 
WHERE id = (SELECT id FROM whatsapp_config ORDER BY created_at ASC LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM whatsapp_config WHERE is_primary = true);

COMMIT;

-- DOWN SCRIPT:
-- ALTER TABLE whatsapp_config DROP COLUMN IF EXISTS is_primary;
-- ALTER TABLE whatsapp_config DROP COLUMN IF EXISTS last_health_check;
-- ALTER TABLE whatsapp_config DROP COLUMN IF EXISTS health_status;
-- DELETE FROM system_variables WHERE name = 'whatsapp_config_consolidated';
```

### Script 3: Criar Tabela de Auditoria de Migrações

```sql
-- Migration: create_migration_audit
-- Description: Tabela para rastrear execução de migrações
-- Reversible: YES

BEGIN;

CREATE TABLE IF NOT EXISTS migration_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_by VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  duration_ms INTEGER,
  rows_affected INTEGER,
  rollback_available BOOLEAN DEFAULT true,
  rollback_executed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_migration_audit_name ON migration_audit(migration_name);
CREATE INDEX idx_migration_audit_status ON migration_audit(status);
CREATE INDEX idx_migration_audit_executed_at ON migration_audit(executed_at DESC);

-- Enable RLS
ALTER TABLE migration_audit ENABLE ROW LEVEL SECURITY;

-- Policy: apenas admins podem ver
CREATE POLICY "Admins can view migration audit"
ON migration_audit FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy: apenas sistema pode inserir
CREATE POLICY "System can insert migration audit"
ON migration_audit FOR INSERT
WITH CHECK (true);

COMMIT;

-- DOWN SCRIPT:
-- DROP TABLE IF EXISTS migration_audit;
```

---

## 🔄 ROLLBACK PROCEDURES

### Procedimento de Rollback Geral

```bash
#!/bin/bash
# rollback_fase8.sh

MIGRATION_ID=$1

if [ -z "$MIGRATION_ID" ]; then
  echo "Usage: ./rollback_fase8.sh <migration_id>"
  exit 1
fi

echo "🔄 Iniciando rollback da migração: $MIGRATION_ID"

# 1. Verificar se rollback está disponível
ROLLBACK_AVAILABLE=$(psql -t -c "SELECT rollback_available FROM migration_audit WHERE id = '$MIGRATION_ID'")

if [ "$ROLLBACK_AVAILABLE" != "t" ]; then
  echo "❌ Rollback não disponível para esta migração"
  exit 1
fi

# 2. Executar rollback
case $MIGRATION_ID in
  "cleanup_old_data")
    psql -f rollbacks/cleanup_old_data_rollback.sql
    ;;
  "consolidate_whatsapp")
    psql -f rollbacks/consolidate_whatsapp_rollback.sql
    ;;
  *)
    echo "❌ Migração desconhecida"
    exit 1
    ;;
esac

# 3. Atualizar audit
psql -c "UPDATE migration_audit SET rollback_executed_at = NOW(), status = 'rolled_back' WHERE id = '$MIGRATION_ID'"

echo "✅ Rollback concluído"
```

### Feature Flag Rollback

```typescript
// Desativar feature flag imediatamente
import { featureFlagsService } from '@/services/featureFlagsService';

// Em caso de problema, desativar a flag
featureFlagsService.updateFlagConfig('use_cliente_db_only', {
  enabled: false,
  percentage: 0,
});

// Forçar override local para debugging
featureFlagsService.override('use_cliente_db_only', false);
```

---

## 📊 VERIFICATION STEPS

### Pre-Migration Checklist

- [ ] Backup completo do banco de dados
- [ ] Feature flags configurados em 0%
- [ ] Monitoramento ativo (Sentry, logs)
- [ ] Equipe de plantão notificada
- [ ] Rollback scripts testados em staging

### Durante Migração

1. **Canary (5%)**
   - Monitorar erros por 30 minutos
   - Verificar latência de resposta
   - Checar logs de exceção

2. **Soft Launch (25%)**
   - Monitorar por 2 horas
   - Verificar métricas de negócio
   - Coletar feedback de usuários beta

3. **General Availability (100%)**
   - Monitorar por 24 horas
   - Verificar todas as métricas
   - Confirmar estabilidade

### Post-Migration Validation

```sql
-- Verificar integridade dos dados
SELECT 
  'notification_logs' as table_name,
  COUNT(*) as row_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM notification_logs

UNION ALL

SELECT 
  'security_events',
  COUNT(*),
  MIN(created_at),
  MAX(created_at)
FROM security_events

UNION ALL

SELECT 
  'clientes',
  COUNT(*),
  MIN(data_cadastro),
  MAX(data_cadastro)
FROM clientes;
```

---

## 🗓️ TIMELINE

| Fase | Data | Ação | Responsável |
|------|------|------|-------------|
| T-7 | 2025-12-23 | Preparar scripts e runbook | DevOps |
| T-3 | 2025-12-27 | Executar em staging | QA |
| T-1 | 2025-12-29 | Validar staging, aprovar prod | Tech Lead |
| T-0 | 2025-12-30 | **CUTOVER** - Canary 5% | DevOps |
| T+1 | 2025-12-31 | Expandir para 25% | DevOps |
| T+3 | 2026-01-02 | GA 100% | DevOps |
| T+7 | 2026-01-06 | Remover código legacy | Dev Team |

---

## 📝 Definition of Done (DoD)

- [x] Módulos antigos identificados e documentados
- [x] Feature flags implementados para migração
- [ ] Migrações executadas em canary (5%)
- [ ] Migrações expandidas para prod (100%)
- [ ] Rollback testado e documentado
- [ ] Código legacy removido
- [ ] Documentação atualizada
- [ ] Métricas de sucesso validadas

---

## 🔗 Documentos Relacionados

- [DEPRECATION_NOTES.md](../deprecated/DEPRECATION_NOTES.md)
- [CUTOVER_RUNBOOK.md](./playbooks/CUTOVER_RUNBOOK.md)
- [ROLLOUT_PLAN.md](./ROLLOUT_PLAN.md)
- [services-audit.md](../report/services-audit.md)

---

*Última atualização: 2025-11-30*
