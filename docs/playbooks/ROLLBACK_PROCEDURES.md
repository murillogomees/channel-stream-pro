# 🔙 ROLLBACK PROCEDURES — Fase 8

**Versão:** 1.0  
**Data:** 2025-11-30  
**Criticidade:** 🔴 CRÍTICA  

---

## 📋 Overview

Este documento detalha todos os procedimentos de rollback para a Fase 8 de migração. Cada procedimento inclui pré-requisitos, passos detalhados e verificações.

---

## 🚨 Níveis de Rollback

| Nível | Tempo | Escopo | Quando Usar |
|-------|-------|--------|-------------|
| **L1 - Feature Flag** | < 1 min | Código específico | Bug em feature nova |
| **L2 - Migration** | < 5 min | Dados/schema | Bug em migração |
| **L3 - Full Rollback** | < 30 min | Sistema completo | Falha crítica |
| **L4 - Restore** | < 2h | Backup completo | Corrupção de dados |

---

## 🏃 L1 - Feature Flag Rollback

### Cenário
Uma feature nova está causando erros para usuários.

### Procedimento

```typescript
// Via Admin Dashboard (/admin/qa → Migration Dashboard)
// Ou programaticamente:

import { migrationService } from '@/services/migrationService';

// Desativar flag específica
migrationService.updateMigrationFlag('use_cliente_db_only', {
  enabled: false,
  percentage: 0,
});

// Ou via Supabase
const { error } = await supabase.rpc('toggle_feature_flag', {
  p_flag_name: 'use_cliente_db_only',
  p_enabled: false,
  p_percentage: 0,
});
```

### Verificação
```sql
-- Verificar flag desativada
SELECT flag_name, enabled, percentage 
FROM feature_flag_config 
WHERE flag_name = 'use_cliente_db_only';
-- Esperado: enabled = false, percentage = 0
```

---

## 🔄 L2 - Migration Rollback

### Cenário
Uma migração de dados causou inconsistências.

### Pré-requisitos
- [ ] Backup da tabela existe
- [ ] Rollback script testado
- [ ] Acesso ao Supabase SQL Editor

### Procedimento: Rollback de Cleanup

```sql
-- 1. Verificar backup existe
SELECT COUNT(*) FROM _backup_notification_logs;

-- 2. Restaurar dados
BEGIN;

INSERT INTO notification_logs 
SELECT * FROM _backup_notification_logs
ON CONFLICT (id) DO NOTHING;

-- 3. Registrar rollback
INSERT INTO migration_audit (migration_name, status, metadata)
VALUES ('cleanup_old_data_fase8', 'rolled_back', 
  '{"reason": "data_inconsistency", "restored_rows": <COUNT>}'::JSONB);

COMMIT;

-- 4. Verificar restauração
SELECT COUNT(*) FROM notification_logs;
```

### Procedimento: Rollback de Feature Flag Config

```sql
-- Restaurar configuração anterior
BEGIN;

-- Reset all migration flags
UPDATE feature_flag_config
SET enabled = false, percentage = 0, updated_at = NOW()
WHERE flag_name IN ('use_cliente_db_only', 'disable_legacy_routes');

-- Keep working flags
UPDATE feature_flag_config
SET enabled = true, percentage = 100, updated_at = NOW()
WHERE flag_name IN ('consolidated_whatsapp', 'new_notification_system');

COMMIT;
```

---

## ⚠️ L3 - Full Rollback

### Cenário
Múltiplas features falhando, sistema instável.

### Pré-requisitos
- [ ] Acesso SSH ao servidor
- [ ] Git access
- [ ] Database admin access
- [ ] Notificar equipe

### Procedimento

```bash
#!/bin/bash
# full_rollback_fase8.sh

echo "🚨 INICIANDO FULL ROLLBACK FASE 8"

# 1. Emergency Stop - Desativar todas as flags
echo "Step 1: Emergency Stop..."
curl -X POST https://api.lovable.dev/admin/feature-flags/emergency-stop \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Clear caches
echo "Step 2: Clearing caches..."
curl -X POST https://api.lovable.dev/admin/cache/clear \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Rollback database migrations
echo "Step 3: Rolling back database..."
psql $DATABASE_URL << 'EOF'
BEGIN;

-- Disable all migration flags
UPDATE feature_flag_config
SET enabled = false, percentage = 0
WHERE flag_name IN ('use_cliente_db_only', 'disable_legacy_routes');

-- Log rollback
INSERT INTO migration_audit (migration_name, status, metadata)
VALUES ('full_rollback_fase8', 'completed', 
  '{"timestamp": "'"$(date -Iseconds)"'", "reason": "manual_trigger"}'::JSONB);

COMMIT;
EOF

# 4. Restart services
echo "Step 4: Restarting services..."
# kubectl rollout restart deployment/app
# or: pm2 restart all

# 5. Notify team
echo "Step 5: Notifying team..."
curl -X POST $SLACK_WEBHOOK \
  -d '{"text": "🚨 Full Rollback Fase 8 executado - Sistema restaurado"}'

echo "✅ Full Rollback concluído"
```

### Verificação

```bash
# Verificar health
curl -s https://api.lovable.dev/health | jq .

# Verificar flags
curl -s https://api.lovable.dev/admin/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Verificar logs
tail -100 /var/log/app/error.log | grep -i error
```

---

## 💾 L4 - Full Restore

### Cenário
Corrupção de dados críticos, necessário restaurar backup completo.

### Pré-requisitos
- [ ] Backup disponível e validado
- [ ] Janela de manutenção aprovada
- [ ] Toda equipe notificada
- [ ] Procedimento testado em staging

### Procedimento

```bash
#!/bin/bash
# full_restore_fase8.sh

BACKUP_FILE=$1
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./full_restore.sh <backup_file>"
  exit 1
fi

echo "🔴 INICIANDO FULL RESTORE - $BACKUP_FILE"

# 1. Colocar sistema em manutenção
echo "Step 1: Maintenance mode..."
kubectl scale deployment/app --replicas=0

# 2. Backup atual (safety)
echo "Step 2: Creating safety backup..."
pg_dump $DATABASE_URL > backup_before_restore_$(date +%Y%m%d_%H%M%S).dump

# 3. Restaurar backup
echo "Step 3: Restoring backup..."
pg_restore -d $DATABASE_URL -c $BACKUP_FILE

# 4. Verificar integridade
echo "Step 4: Verifying integrity..."
psql $DATABASE_URL -c "SELECT COUNT(*) FROM clientes;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM notification_logs;"

# 5. Restaurar serviço
echo "Step 5: Restoring service..."
kubectl scale deployment/app --replicas=3

# 6. Verificar health
echo "Step 6: Health check..."
sleep 30
curl -s https://api.lovable.dev/health | jq .

echo "✅ Full Restore concluído"
```

---

## 📊 Verificações Pós-Rollback

### Queries de Validação

```sql
-- 1. Verificar contagem de registros críticos
SELECT 
  'clientes' as tabela, COUNT(*) as total FROM clientes
UNION ALL
SELECT 'notification_logs', COUNT(*) FROM notification_logs
UNION ALL
SELECT 'security_events', COUNT(*) FROM security_events;

-- 2. Verificar último registro de cada tabela
SELECT 
  'clientes' as tabela, 
  MAX(data_cadastro) as ultimo_registro 
FROM clientes
UNION ALL
SELECT 'notification_logs', MAX(created_at) FROM notification_logs
UNION ALL
SELECT 'security_events', MAX(created_at) FROM security_events;

-- 3. Verificar flags após rollback
SELECT flag_name, enabled, percentage, updated_at
FROM feature_flag_config
ORDER BY updated_at DESC;

-- 4. Verificar audit log
SELECT migration_name, status, executed_at, error_message
FROM migration_audit
WHERE executed_at > NOW() - INTERVAL '1 hour'
ORDER BY executed_at DESC;
```

### Checklist Manual

- [ ] Dashboard carrega normalmente
- [ ] Login funciona
- [ ] Listagem de clientes funciona
- [ ] Notificações estão sendo enviadas
- [ ] Logs não mostram erros críticos
- [ ] Métricas de latência normais

---

## 📞 Escalation

Se o rollback falhar:

1. **Minuto 0-5:** Tentar rollback L1 (feature flags)
2. **Minuto 5-10:** Escalar para L2 (migration rollback)
3. **Minuto 10-30:** Escalar para L3 (full rollback)
4. **Minuto 30+:** Escalar para L4 (restore) + Notificar liderança

### Contatos

| Nível | Responsável | Contato |
|-------|-------------|---------|
| L1-L2 | On-call Dev | Slack #tech-oncall |
| L3 | Tech Lead | Slack + Telefone |
| L4 | CTO | Telefone direto |

---

## 📝 Histórico de Rollbacks

| Data | Tipo | Motivo | Duração | Responsável |
|------|------|--------|---------|-------------|
| - | - | - | - | - |

---

*Documento controlado - Atualizar após cada rollback*
