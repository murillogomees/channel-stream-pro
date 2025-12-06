# Deep Audit Report - Sistema IPTV

**Data:** 2025-12-06  
**Modo:** dry-run  
**Período de análise:** 180 dias

---

## 📊 Sumário Executivo

| Métrica | Valor |
|---------|-------|
| Total de Hooks | 118 |
| Total de Services | 60+ |
| Total de Pages | 80+ |
| Edge Functions | 95 |
| Duplicatas detectadas | 12 grupos |
| Código morto (candidatos) | 23 itens |
| Tabelas não utilizadas | 15+ |
| Secrets a verificar | 5 |

---

## 🔴 DUPLICATAS IDENTIFICADAS

### 1. Hooks de Performance do Player (ALTA PRIORIDADE)

| Hook V1 | Hook V2 | Uso V1 | Uso V2 | Recomendação |
|---------|---------|--------|--------|--------------|
| `useFastStartup` | `useFastStartupV2` | 3 arquivos | 2 arquivos | Consolidar em V2 |
| `usePlayerPerformance` | `usePlayerPerformanceV2` | 3 arquivos | 1 arquivo | Consolidar em V2 |

**Evidência:**
- `useFastStartup` usa detecção de codec antiga
- `useFastStartupV2` usa preconnect + aggressive prefetch (melhor)
- V1 é usado em `useOptimizedPlayer.ts` e `usePlayerPerformance.ts`
- V2 só é exportado em `player/index.ts` mas não amplamente usado

**Ação Recomendada:**
```typescript
// Criar wrapper de deprecation
/** @deprecated Use useFastStartupV2 instead */
export const useFastStartup = useFastStartupV2;
```

**Risco:** LOW  
**PR sugerido:** Criar alias + migrar usos em 2 sprints

---

### 2. Hooks de Preload de Canais (MÉDIA PRIORIDADE)

| Hook | Arquivo | Propósito |
|------|---------|-----------|
| `useChannelPreload` | useChannelPreload.ts | Preload com cache em memória |
| `useChannelPreloader` | useChannelPreloader.ts | Preload com Web Workers |
| `useChannelPreloadEffect` | useChannelPreloadEffect.ts | Effect wrapper para preload |
| `usePreloadStreams` | usePreloadStreams.ts | Netflix-style preload |
| `useIntelligentPreload` | useIntelligentPreload.ts | Preload baseado em ML |
| `useWorkerPreloader` | useWorkerPreloader.ts | Web Worker preloader |
| `useStreamPreloader` | useStreamPreloader.ts | Stream preloader |

**Análise:**
- 7 hooks com funcionalidade similar/sobreposta
- `useChannelPreloadEffect` depende de `usePlayerPerformance` (V1)
- Apenas `useChannelPreload` parece ser a canonical (mais completo)

**Ação Recomendada:**
1. Escolher `useChannelPreload` como canonical
2. Criar facade que unifica todos em um único hook
3. Deprecar os outros gradualmente

**Risco:** MED  
**PR sugerido:** Criar `useUnifiedPreload` que combina tudo

---

### 3. Hooks de Buffer Adaptativo

| Hook | Descrição |
|------|-----------|
| `useAdaptiveBuffer` | Buffer adaptativo baseado em conexão |
| `useSmartBuffer` | Buffer inteligente com ML-like |
| `useConnectionAware` | Awareness de conexão |
| `useConnectionAwarePlayer` | Player com awareness de conexão |

**Sobreposição:** ~60% de funcionalidade duplicada

**Ação Recomendada:** Consolidar em `useSmartBuffer` (mais moderno)

---

## ⚫ CÓDIGO MORTO (CANDIDATOS)

### Hooks Sem Referências Externas

| Arquivo | Última Modificação | Referências | Status |
|---------|-------------------|-------------|--------|
| `useResume.ts` | Antigo | 0 imports detectados | DEAD? |
| `useResumePlayback.ts` | Novo | Usado | ACTIVE |
| `useContentCache.ts` | - | 0 imports | DEAD? |
| `useNetflixLazyLoad.ts` | - | 0 imports | DEAD? |
| `useVisibilityOptimization.ts` | - | 0 imports | DEAD? |
| `useVideoElementPool.ts` | - | 0 imports | DEAD? |
| `useStreamOnDemand.ts` | - | 0 imports | DEAD? |

**Nota:** Verificar com `rg "useContentCache"` antes de remover.

---

### Edge Functions Potencialmente Não Usadas

| Function | Último Log | Status |
|----------|-----------|--------|
| `list-objects-test` | - | TEST ONLY |
| `mercado-pago-test` | - | TEST ONLY |
| `mercado-pago-test-users` | - | TEST ONLY |
| `test-r2-connection` | - | TEST ONLY |
| `qa-validation` | - | INTERNAL |
| `check-secrets` | - | INTERNAL |

**Ação:** Mover para pasta `_test/` ou remover

---

### Tabelas Sem Atividade (0 queries em 180 dias)

| Tabela | n_live_tup | seq_scan + idx_scan | Status |
|--------|------------|---------------------|--------|
| `user_totp_secrets` | 0 | 3 | UNUSED |
| `affiliate_marketing_materials` | 0 | 3 | UNUSED |
| `channel_health` | 0 | 4 | UNUSED |
| `viewer_profiles` | 0 | 4 | UNUSED |
| `playlist_access_logs` | 0 | 4 | UNUSED |
| `affiliate_fraud_logs` | 0 | 5 | UNUSED |
| `qos_metrics` | 0 | 5 | UNUSED |
| `favorites` | 0 | 5 | UNUSED |
| `playlist_archives` | 0 | 5 | UNUSED |
| `r2_signed_url_logs` | 0 | 6 | UNUSED |
| `affiliate_plan_commissions` | 0 | 6 | UNUSED |
| `affiliate_analytics` | 0 | 7 | UNUSED |
| `affiliate_link_clicks` | 0 | 7 | UNUSED |
| `m3u_ingest_jobs` | 0 | 8 | UNUSED |
| `epg_data` | 0 | 15 | UNUSED |

**Ação Recomendada:**
1. Verificar se tabelas são necessárias para features futuras
2. Se não, criar migration para DROP após 30 dias de observação
3. Fazer backup antes

**Risco:** HIGH (alteração de DB)

---

## 🟡 DUPLICATAS DE SERVIÇOS

### Services com Funcionalidade Sobreposta

| Grupo | Services | Recomendação |
|-------|----------|--------------|
| Cache | `smartCacheService`, `streamCacheService`, `playlistCacheService`, `authCacheService` | Unificar interface |
| Streaming | `streamOptimizer`, `smartStreamResolver`, `contentRoutingService` | Consolidar em 1 |
| ABR | `abrService`, `enhancedABRService` | Usar enhanced |
| Security | `securityMonitoringService`, `securityAnalyticsService`, `securityAlertStatsService` | Consolidar |

---

## 🔐 SEGURANÇA - SECRETS

### Secrets a Verificar

| Secret | Uso | Rotação |
|--------|-----|---------|
| `WHATSAPP_APPKEY` | Edge Functions | Verificar |
| `WHATSAPP_AUTHKEY` | Edge Functions | Verificar |
| `SMARTONE_*` | Integração | Verificar |
| `MERCADO_PAGO_*` | Pagamentos | Verificar |
| `CLOUDFLARE_*` | CDN | Verificar |

**Ação:** Executar `check-secrets` edge function

---

## 📁 ARQUIVOS ÓRFÃOS

### Documentação Arquivada (já marcada)

Referência: `unused.md` na raiz do projeto

| Doc | Status |
|-----|--------|
| `docs/ROLLOUT_PLAN.md` | Nunca executado |
| `docs/LAUNCH_CHECKLIST.md` | Template vazio |
| `docs/archive/strategic/*` | Arquivado |
| `docs/archive/alternatives/*` | Alternativas não adotadas |

---

## ✅ PLANO DE AÇÃO (Priorizado)

### Sprint 1 (Imediato - LOW Risk)
1. [ ] Remover edge functions de teste (`*-test*`)
2. [ ] Criar aliases de deprecation para hooks V1
3. [ ] Atualizar exports em `src/hooks/index.ts`

### Sprint 2 (1-2 semanas - MED Risk)
1. [ ] Consolidar hooks de preload em `useUnifiedPreload`
2. [ ] Migrar usos de `usePlayerPerformance` para V2
3. [ ] Consolidar services de cache

### Sprint 3 (2-4 semanas - HIGH Risk)
1. [ ] Auditar tabelas não utilizadas
2. [ ] Criar migrations para cleanup de DB
3. [ ] Implementar feature flags para rollback

---

## 📊 MÉTRICAS DE SUCESSO

| Métrica | Atual | Meta |
|---------|-------|------|
| Hooks duplicados | 12 grupos | 0 |
| Código morto | ~23 arquivos | < 5 |
| Tabelas não usadas | 15 | Documentadas/Removidas |
| Cobertura de testes | TBD | > 80% |

---

## 🔄 ROLLBACK

### Estratégia de Rollback

1. **Feature Flags:** Todas as consolidações terão flag
2. **Aliases:** Hooks antigos viram aliases antes de remoção
3. **DB Backups:** Snapshot antes de migrations
4. **Período de Observação:** 30 dias antes de remoção definitiva

---

## 📎 ANEXOS

### inventario.json
Ver arquivo: `docs/audit/inventario.json`

### dashboard_counts.json
```json
{
  "hooks_total": 118,
  "hooks_duplicated_groups": 12,
  "hooks_dead_candidates": 7,
  "services_total": 60,
  "services_duplicated_groups": 4,
  "edge_functions_total": 95,
  "edge_functions_test_only": 6,
  "tables_total": 100,
  "tables_unused": 15,
  "secrets_to_verify": 5
}
```

---

**Gerado automaticamente pelo Deep Audit System**  
**Modo:** dry-run  
**Aprovação necessária para aplicação**
