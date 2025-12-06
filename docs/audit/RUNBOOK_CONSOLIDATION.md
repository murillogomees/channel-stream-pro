# Runbook: Consolidação de Código Duplicado

## Visão Geral

Este runbook descreve o processo seguro para consolidar código duplicado identificado no Deep Audit.

---

## 1. Consolidação de Hooks de Performance (LOW Risk)

### Pré-requisitos
- [ ] Backup do código atual
- [ ] Testes unitários passando
- [ ] Feature flag criada: `USE_PERFORMANCE_V2`

### Passos

#### 1.1 Criar Alias de Deprecation

```typescript
// src/hooks/useFastStartup.ts
/** @deprecated Use useFastStartupV2 instead. Will be removed in v2.0 */
export { useFastStartupV2 as useFastStartup } from './useFastStartupV2';
export { useFastStartupV2 as default } from './useFastStartupV2';
```

#### 1.2 Atualizar Consumidores

```bash
# Arquivos a atualizar:
# - src/hooks/useOptimizedPlayer.ts
# - src/hooks/usePlayerPerformance.ts
```

#### 1.3 Verificação

```bash
npm run build
npm run test
npm run lint
```

### Rollback

```bash
git revert HEAD
npm run build
```

---

## 2. Consolidação de Hooks de Preload (MED Risk)

### Pré-requisitos
- [ ] Feature flag: `USE_UNIFIED_PRELOAD`
- [ ] Testes de integração
- [ ] Monitoramento de métricas de preload

### Passos

#### 2.1 Criar Hook Unificado

```typescript
// src/hooks/useUnifiedPreload.ts
import { useChannelPreload } from './useChannelPreload';
import { useWorkerPreloader } from './useWorkerPreloader';

export function useUnifiedPreload(options) {
  const channelPreload = useChannelPreload();
  const workerPreloader = useWorkerPreloader(options);
  
  // Combinar funcionalidades
  return {
    ...channelPreload,
    workerEnabled: workerPreloader.enabled,
  };
}
```

#### 2.2 Migração Gradual

1. Deploy com feature flag OFF
2. Ativar para 10% dos usuários
3. Monitorar métricas por 24h
4. Se OK, aumentar para 50%
5. Se OK, ativar 100%

#### 2.3 Deprecar Hooks Antigos

Após 30 dias de uso sem problemas:

```typescript
// src/hooks/usePreloadStreams.ts
/** @deprecated Use useUnifiedPreload instead */
export { useUnifiedPreload as usePreloadStreams } from './useUnifiedPreload';
```

### Rollback

1. Desativar feature flag
2. Verificar logs
3. Se necessário: `git revert`

---

## 3. Cleanup de Tabelas Não Usadas (HIGH Risk)

### ⚠️ ATENÇÃO: Requer aprovação manual

### Pré-requisitos
- [ ] Backup completo do banco
- [ ] Snapshot do Supabase
- [ ] Aprovação do DBA/Lead
- [ ] Janela de manutenção agendada

### Passos

#### 3.1 Verificação Final

```sql
-- Verificar se tabela realmente não tem dados importantes
SELECT COUNT(*) FROM public.table_name;

-- Verificar dependências
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'table_to_check';
```

#### 3.2 Criar Migration

```sql
-- Migration: drop_unused_tables
-- Revert: available in rls_fix_backups

-- Backup first
INSERT INTO rls_fix_backups (table_name, backup_data, created_at)
SELECT 'table_name', row_to_json(t), now() FROM public.table_name t;

-- Then drop
DROP TABLE IF EXISTS public.table_name;
```

#### 3.3 Deploy

1. Deploy em staging primeiro
2. Verificar por 24h
3. Deploy em produção
4. Monitorar por 7 dias

### Rollback

```sql
-- Restaurar do backup
CREATE TABLE public.table_name AS
SELECT * FROM jsonb_populate_recordset(
  null::public.table_name_backup_type,
  (SELECT backup_data FROM rls_fix_backups WHERE table_name = 'table_name')
);
```

---

## Checklist de Segurança

- [ ] Backup realizado
- [ ] Testes passando
- [ ] Feature flag configurada
- [ ] Monitoramento ativo
- [ ] Rollback testado
- [ ] Documentação atualizada

---

## Contatos de Emergência

- **On-call:** [Definir]
- **DBA:** [Definir]
- **Tech Lead:** [Definir]

---

## Histórico de Execuções

| Data | Ação | Responsável | Status |
|------|------|-------------|--------|
| - | - | - | Pendente |
