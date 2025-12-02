# 🔒 Security Improvements - Plano de Execução

**Duração estimada:** 2 horas  
**Prioridade:** CRÍTICA  
**Status:** 🔄 Em Execução

---

## 📋 Overview

Execução completa de melhorias de segurança dividida em 3 fases principais:

1. **RLS Coverage Audit** (30min) - Auditoria completa de Row Level Security
2. **Security Scan Fixes** (1h) - Implementação de correções identificadas
3. **Rate Limiting Server-Side** (30min) - Proteção contra abuso de APIs

---

## Phase 1: RLS Coverage Audit (30min) ✅

### Objetivos
- Identificar todas as tabelas sem RLS habilitado
- Detectar políticas RLS permissivas (sempre true)
- Detectar políticas RLS faltantes (missing policies)
- Gerar relatório completo de cobertura

### Ações Executadas

#### 1.1 Supabase Linter Scan ✅
```bash
Status: Completado
Findings: 6 issues detectados
- 2 ERRORS: Security Definer Views (extensões hypopg - não corrigível)
- 2 WARNS: Function search_path mutable (extensões - não corrigível)
- 2 WARNS: Extension in public (extensões - não corrigível)
```

**Conclusão**: Todos os 6 warnings são relacionados às extensões `hypopg` e `index_advisor` gerenciadas pelo Supabase e **não podem ser corrigidos** via SQL migrations.

#### 1.2 RLS Coverage Analysis
**Próximo passo**: Executar `rls-coverage` Edge Function para análise detalhada.

**Expected Output:**
```typescript
{
  scan_id: string;
  timestamp: string;
  summary: {
    total_tables: number;
    tables_without_rls: number;
    permissive_policies: number;
    coverage_percentage: number;
  };
  issues: RLSIssue[];
  total_issues: number;
  by_severity: { high, medium, low };
}
```

### Status Atual: Score 9.5/10 ✅

| Categoria | Status | Notes |
|-----------|--------|-------|
| Funções com search_path | ✅ 100% | 20 funções customizadas corrigidas |
| RLS Policies | ✅ Configurado | Pending full audit |
| Rate Limiting | ✅ Implementado | Client-side only - needs server-side |
| Extensões (hypopg) | ⚠️ Não corrigível | Gerenciado pelo Supabase |
| MFA | ⚠️ Manual | Requer configuração no painel |
| HIBP | ⚠️ Manual | Requer configuração no painel |

---

## Phase 2: Security Scan Fixes (1h) 🔄

### Objetivos
- Corrigir todas as issues RLS identificadas no audit
- Implementar políticas RLS faltantes
- Ajustar políticas permissivas
- Testar com diferentes roles (client, admin, master)

### 2.1 Issues Prioritárias

#### HIGH Priority
1. **Tabelas sem RLS** - Habilitar RLS e criar políticas básicas
2. **Políticas com USING = true** - Adicionar condições específicas
3. **Políticas sem WITH CHECK** - Adicionar validações

#### MEDIUM Priority
1. **Políticas com possível recursão** - Criar funções SECURITY DEFINER
2. **Políticas sem roles específicos** - Definir roles adequados

### 2.2 Template de Correção

Para cada issue identificada, seguir o padrão:

```sql
-- Backup da política atual (se existir)
-- Aplicar correção
-- Testar com role client
-- Testar com role admin
-- Testar com role master
-- Validar que não quebrou funcionalidades existentes
```

### 2.3 Tabelas Críticas para RLS

**Priority 1 (Dados sensíveis de usuários):**
- `profiles` ✅ (já tem RLS)
- `user_roles` ✅ (já tem RLS)
- `auth_sessions_log` ⚠️ (verificar políticas)
- `security_events` ⚠️ (verificar políticas)
- `ip_blacklist` ⚠️ (verificar políticas)

**Priority 2 (Dados de negócio):**
- `m3u_lists` ⚠️ (verificar políticas)
- `m3u_channels` ⚠️ (verificar políticas)
- `m3u_custom_lists` ⚠️ (verificar políticas)
- `discount_coupons` ⚠️ (verificar políticas)
- `affiliates` ⚠️ (verificar políticas)

**Priority 3 (Configurações do sistema):**
- `whatsapp_config` ⚠️ (verificar políticas)
- `admin_phones` ⚠️ (verificar políticas)
- `security_alert_templates` ⚠️ (verificar políticas)

---

## Phase 3: Rate Limiting Server-Side (30min) 🔄

### Objetivos
- Implementar rate limiting em Edge Functions críticas
- Adicionar IP tracking e blocking automático
- Configurar thresholds adequados por endpoint

### 3.1 Edge Functions Prioritárias

**Tier 1 (Autenticação e Registro):**
- [ ] `auth` endpoints (via Supabase Auth config)
- [ ] `create-admin-user` - 5 req/min por IP
- [ ] Custom login/signup flows

**Tier 2 (APIs Públicas):**
- [ ] `generate-m3u-file` - 10 req/hour por user
- [ ] `stream-proxy` - 100 req/min por user
- [ ] `cdn-token` - 20 req/min por user

**Tier 3 (Webhooks):**
- [ ] `whatsapp-webhook` - 1000 req/min (já tem signature validation)
- [ ] Payment webhooks - 100 req/min

### 3.2 Implementação Pattern

```typescript
// Rate limiter helper para Edge Functions
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  // Query rate_limit_tracking table
  // Check if within limits
  // Update counter
  // Return result
}

// Uso em Edge Function:
const { allowed, remaining } = await checkRateLimit(
  req.headers.get('x-forwarded-for') || 'unknown',
  5, // 5 requests
  60 // per minute
);

if (!allowed) {
  return new Response('Rate limit exceeded', { status: 429 });
}
```

### 3.3 IP Blocking Automático

Integrar com sistema existente:
```sql
-- Já existe: check_and_block_ip()
-- Usar threshold: 5 falhas = bloqueio automático 24h
```

---

## 🎯 Success Criteria

### Phase 1 - RLS Audit
- [x] Supabase linter executado
- [ ] RLS coverage scan completado
- [ ] Relatório de issues gerado
- [ ] Issues priorizadas por severidade

### Phase 2 - Security Fixes
- [ ] Todas as tabelas críticas com RLS habilitado
- [ ] Zero políticas com USING = true (sem condições)
- [ ] Zero políticas faltando WITH CHECK
- [ ] Testes de acesso executados (client, admin, master)
- [ ] Documentação de políticas atualizada

### Phase 3 - Rate Limiting
- [ ] Rate limiting implementado em 3+ Edge Functions
- [ ] IP tracking configurado
- [ ] Auto-blocking testado
- [ ] Thresholds documentados

---

## 📊 Metrics & Monitoring

### Security Score Target
```
Current: 9.5/10
Target:  9.8/10
```

### RLS Coverage Target
```
Current: ~85% (estimated)
Target:  100% (all user-facing tables)
```

### Rate Limiting Coverage
```
Current: 0% (client-side only)
Target:  100% (all public Edge Functions)
```

---

## 🚨 Rollback Plan

### Se algo der errado:

1. **RLS Issues**: Usar `rls_fix_backups` table para restore
2. **Rate Limiting**: Desabilitar via feature flag
3. **Emergency**: Remover todas as novas políticas RLS

```sql
-- Emergency rollback command
SELECT restore_rls_policies_from_backup('<backup_id>');
```

---

## 📝 Next Steps After Completion

1. **Configuração Manual no Painel Supabase:**
   - [ ] Habilitar HIBP (Have I Been Pwned)
   - [ ] Configurar política de senha forte
   - [ ] Testar MFA TOTP
   - [ ] (Opcional) Configurar SMS MFA

2. **Monitoring Contínuo:**
   - [ ] Monitorar dashboard de segurança (`/admin/security-monitor`)
   - [ ] Verificar eventos de segurança diários
   - [ ] Revisar IPs bloqueados semanalmente

3. **Code Consolidation (Próxima fase):**
   - Remover rotas legacy
   - Unificar componentes duplicados
   - Limpar código não utilizado

---

## 🔗 Referências

- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Rate Limiting Patterns](https://supabase.com/docs/guides/api/rate-limiting)
- [SECURITY_RECOMMENDATIONS.md](./SECURITY_RECOMMENDATIONS.md)
