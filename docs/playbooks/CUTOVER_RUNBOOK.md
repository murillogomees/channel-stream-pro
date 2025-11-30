# 🎯 CUTOVER RUNBOOK — Fase 8 Final Migration

**Versão:** 1.0  
**Data:** 2025-11-30  
**Criticidade:** 🔴 ALTA  

---

## 📋 Overview

Este runbook detalha o procedimento de cutover para a migração final da Fase 8, incluindo todos os passos, verificações e procedimentos de rollback.

---

## 🚦 Pre-Flight Checklist

### 24 Horas Antes

- [ ] Notificar equipe de suporte sobre janela de manutenção
- [ ] Verificar backup automático executado com sucesso
- [ ] Criar backup manual adicional
- [ ] Validar scripts de migração em staging
- [ ] Testar procedimento de rollback em staging
- [ ] Verificar disponibilidade da equipe de plantão
- [ ] Preparar canal de comunicação (Slack/Teams)

### 1 Hora Antes

- [ ] Verificar métricas baseline (latência, erros, throughput)
- [ ] Confirmar acesso a todos os dashboards de monitoramento
- [ ] Validar conexão com banco de produção
- [ ] Confirmar que não há deploys em andamento
- [ ] Ativar modo de observação no Sentry

### Imediatamente Antes

- [ ] Comunicar início da janela de manutenção
- [ ] Pausar jobs de background não críticos
- [ ] Snapshot do estado atual das feature flags

---

## 🔄 Procedimento de Cutover

### Fase 1: Canary (5%) — T+0

**Duração estimada:** 30 minutos  
**Risco:** Baixo  

```bash
# 1. Ativar feature flags em 5%
curl -X POST https://api.lovable.dev/admin/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "flag": "use_cliente_db_only",
    "percentage": 5,
    "enabled": true
  }'

# 2. Verificar logs de erro
tail -f /var/log/app/error.log | grep -E "(ClienteDb|migration)"

# 3. Monitorar métricas
watch -n 10 'curl -s https://api.lovable.dev/health | jq .latency'
```

**Critérios de Sucesso:**
- [ ] Taxa de erro < 0.1%
- [ ] Latência p99 < 500ms
- [ ] Nenhum erro crítico em 30 minutos

**Rollback Trigger:**
- Taxa de erro > 1%
- Latência p99 > 2000ms
- Qualquer erro de dados

---

### Fase 2: Soft Launch (25%) — T+2h

**Duração estimada:** 2 horas  
**Risco:** Médio  

```bash
# 1. Expandir para 25%
curl -X POST https://api.lovable.dev/admin/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "flag": "use_cliente_db_only",
    "percentage": 25
  }'

# 2. Executar verificação de integridade
psql -c "SELECT COUNT(*) FROM clientes WHERE situacao IS NULL;"
# Esperado: 0

# 3. Verificar conversões
psql -c "
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE data_ultimo_pagamento IS NOT NULL) as with_payment
  FROM clientes 
  WHERE data_cadastro > NOW() - INTERVAL '1 hour';
"
```

**Critérios de Sucesso:**
- [ ] Taxa de erro < 0.1%
- [ ] Conversões funcionando normalmente
- [ ] Nenhuma reclamação de usuário

---

### Fase 3: Full Rollout (100%) — T+4h

**Duração estimada:** 24 horas de observação  
**Risco:** Médio-Alto  

```bash
# 1. Rollout completo
curl -X POST https://api.lovable.dev/admin/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "flag": "use_cliente_db_only",
    "percentage": 100
  }'

# 2. Executar limpeza de dados legados
psql -f migrations/cleanup_old_data_fase8.sql

# 3. Registrar migração
psql -c "
  INSERT INTO migration_audit (migration_name, executed_by, status, metadata)
  VALUES (
    'fase8_full_rollout',
    'devops',
    'completed',
    '{\"percentage\": 100, \"timestamp\": \"$(date -Iseconds)\"}'
  );
"
```

**Critérios de Sucesso:**
- [ ] 24 horas sem incidentes
- [ ] Métricas de negócio estáveis
- [ ] Feedback positivo da equipe de suporte

---

## 🔙 Procedimentos de Rollback

### Rollback Imediato (< 5 minutos)

```bash
#!/bin/bash
# emergency_rollback.sh

echo "🚨 INICIANDO ROLLBACK DE EMERGÊNCIA"

# 1. Desativar todas as feature flags de migração
curl -X POST https://api.lovable.dev/admin/feature-flags/bulk \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "flags": [
      {"flag": "use_cliente_db_only", "enabled": false},
      {"flag": "disable_legacy_routes", "enabled": false}
    ]
  }'

# 2. Limpar cache
curl -X POST https://api.lovable.dev/admin/cache/clear \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Notificar equipe
curl -X POST $SLACK_WEBHOOK \
  -d '{"text": "🚨 ROLLBACK FASE 8 EXECUTADO - Investigação necessária"}'

echo "✅ Rollback imediato concluído"
```

### Rollback de Dados (< 30 minutos)

```sql
-- rollback_data_fase8.sql

BEGIN;

-- 1. Verificar se backup existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_backup_notification_logs') THEN
    RAISE EXCEPTION 'Backup table não encontrada!';
  END IF;
END $$;

-- 2. Restaurar dados
INSERT INTO notification_logs 
SELECT * FROM _backup_notification_logs
ON CONFLICT (id) DO NOTHING;

-- 3. Atualizar audit
UPDATE migration_audit 
SET 
  rollback_executed_at = NOW(),
  status = 'rolled_back'
WHERE migration_name = 'cleanup_old_data_fase8'
  AND rollback_executed_at IS NULL;

-- 4. Verificar restauração
SELECT COUNT(*) as restored_count FROM notification_logs;

COMMIT;
```

### Rollback Completo (< 2 horas)

1. **Restaurar banco de backup**
   ```bash
   pg_restore -d production_db backup_pre_fase8.dump
   ```

2. **Reverter código**
   ```bash
   git revert HEAD~3  # Reverter últimos 3 commits de migração
   git push origin main --force-with-lease
   ```

3. **Invalidar caches**
   ```bash
   redis-cli FLUSHALL
   ```

4. **Restart aplicação**
   ```bash
   kubectl rollout restart deployment/app
   ```

---

## 📊 Monitoramento

### Dashboards Críticos

| Dashboard | URL | Métricas |
|-----------|-----|----------|
| App Health | `/admin/system` | Latência, Erros |
| Database | Supabase Dashboard | Queries, Connections |
| Feature Flags | `/admin/qa` | Flag status |
| Errors | Sentry | Exceptions |

### Queries de Monitoramento

```sql
-- Taxa de erro dos últimos 5 minutos
SELECT 
  date_trunc('minute', created_at) as minute,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'error') / COUNT(*), 2) as error_rate
FROM activity_logs
WHERE created_at > NOW() - INTERVAL '5 minutes'
GROUP BY 1
ORDER BY 1 DESC;

-- Health check geral
SELECT 
  service_name,
  status,
  latency_ms,
  last_check_at
FROM health_snapshots
WHERE timestamp > NOW() - INTERVAL '5 minutes'
ORDER BY timestamp DESC
LIMIT 10;
```

### Alertas Automáticos

```yaml
# alertmanager config
groups:
  - name: fase8_migration
    rules:
      - alert: HighErrorRate
        expr: error_rate > 1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Taxa de erro alta durante migração Fase 8"
          
      - alert: HighLatency
        expr: latency_p99 > 2000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Latência elevada durante migração"
```

---

## 📞 Contatos de Emergência

| Role | Nome | Contato | Disponibilidade |
|------|------|---------|-----------------|
| Tech Lead | - | Slack #tech-oncall | 24/7 |
| DBA | - | Slack #dba-oncall | 24/7 |
| DevOps | - | Slack #devops | 24/7 |
| Product | - | Slack #product | Business hours |

---

## ✅ Post-Cutover Checklist

### Imediatamente Após (T+1h)

- [ ] Confirmar todas as métricas normais
- [ ] Verificar logs de erro zerados
- [ ] Validar funcionalidades críticas manualmente
- [ ] Atualizar status no canal de comunicação

### 24 Horas Após

- [ ] Revisar métricas de negócio
- [ ] Coletar feedback da equipe de suporte
- [ ] Documentar lições aprendidas
- [ ] Agendar remoção de código legacy

### 7 Dias Após

- [ ] Remover feature flags de migração
- [ ] Deletar backups temporários
- [ ] Arquivar código legacy
- [ ] Atualizar documentação final

---

## 📝 Histórico de Execuções

| Data | Ambiente | Status | Executor | Notas |
|------|----------|--------|----------|-------|
| - | - | - | - | - |

---

*Documento controlado - Atualizar após cada execução*
