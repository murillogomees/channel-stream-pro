# Smart Cache Audit Report

**Data:** 2025-12-02  
**Auditor:** Senior Systems Architect  
**Status:** ⚠️ GAPS IDENTIFICADOS

## 1. Estado Atual

### Arquivos Localizados
- `src/components/admin/cache/SmartCacheMonitor.tsx` - Dashboard UI
- `src/hooks/useSmartCache.ts` - Hook frontend para cache inteligente
- `src/pages/AdminSmartCache.tsx` - Página admin
- Integrado em `AppPlayer.tsx` para preloading

### ✅ Implementado
- Dashboard de monitoramento com UI funcional
- Hook `useSmartCache` com tracking de views
- Integração básica no player

### ❌ GAPS CRÍTICOS

#### A. Config Storage & Modeling
**Status:** ❌ NÃO ENCONTRADO
- Nenhuma tabela `cache_rules` ou `cache_config` no banco
- Nenhuma migration detectada
- **Evidência:** Busca em types.ts não retornou schema

**Ação Requerida:**
```sql
CREATE TABLE cache_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  match_pattern TEXT NOT NULL,
  ttl INTEGER NOT NULL,
  stale_while_revalidate INTEGER,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  scope TEXT CHECK (scope IN ('path','host','query')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### B. Runtime Application
**Status:** ❌ PARCIAL
- Hook frontend existe mas não há evidência de worker CDN consumindo regras
- `workers/cdn-router/` não mostra integração com cache_rules
- **Gap:** Worker não lê configuração dinâmica

#### C. Cache Key Normalization
**Status:** ⚠️ NÃO VERIFICÁVEL
- Nenhuma função `cacheKey()` encontrada
- Sem normalização de query params
- Sem tratamento de headers Vary

**Ação Requerida:**
- Implementar `generateCacheKey(req)` em worker
- Normalizar query params (ordenação, strip utm_*)
- Tests unitários

#### D. Invalidation/Purge
**Status:** ❌ NÃO IMPLEMENTADO
- Nenhum endpoint `/admin/cache/purge` encontrado
- Sem API de invalidação
- **Risco:** Cache stale sem forma de limpar

#### E. Observability
**Status:** ⚠️ LIMITADO
- UI mostra stats mas origem dos dados não clara
- Sem métricas hit/miss no worker
- Sem logs estruturados

## 2. Severidade dos Gaps

| Gap | Severidade | Impacto | Esforço |
|-----|-----------|---------|---------|
| Falta cache_rules table | 🔴 ALTA | Config não persiste | Pequeno |
| Worker não lê config | 🔴 ALTA | Cache não funciona dinamicamente | Médio |
| Sem invalidation API | 🟡 MÉDIA | Impossível limpar cache | Médio |
| Sem key normalization | 🟡 MÉDIA | Cache fragmentado | Pequeno |
| Métricas limitadas | 🟢 BAIXA | Dificulta debug | Pequeno |

## 3. Plano de Correção

### Fase 1 - Database (1-2h)
- [ ] Migration: `cache_rules` table
- [ ] Migration: `cache_stats` table
- [ ] Seed: regras padrão

### Fase 2 - Worker Integration (3-4h)
- [ ] Worker lê `cache_rules` do R2/Durable Object
- [ ] Implementar `generateCacheKey()`
- [ ] Tests unitários normalization

### Fase 3 - API & Invalidation (2-3h)
- [ ] Edge Function: `cache-invalidate`
- [ ] Admin endpoint: POST `/admin/cache/purge`
- [ ] UI: botão Purge Cache

### Fase 4 - Tests (2h)
- [ ] Integration: cache hit/miss
- [ ] E2E: purge + revalidate

## 4. Testes Propostos

```typescript
// tests/unit/cacheKey.test.ts
describe('generateCacheKey', () => {
  it('normalizes query param order', () => {
    expect(generateCacheKey('/?b=2&a=1')).toBe(generateCacheKey('/?a=1&b=2'));
  });
  
  it('strips UTM params', () => {
    expect(generateCacheKey('/?utm_source=fb&id=1')).toBe(generateCacheKey('/?id=1'));
  });
});
```

## 5. Próximos Passos

1. **Imediato:** Criar migration `cache_rules`
2. **Curto prazo:** Patch worker para ler config
3. **Médio prazo:** API invalidation
4. **Longo prazo:** Métricas avançadas

## 6. Rollback Plan

- Migration tem `DOWN` script
- Worker deploy via GitHub Actions com rollback instantâneo
- Feature flag para desabilitar smart cache

---

**Recomendação:** Priorizar Fase 1 e 2 antes de produção.
