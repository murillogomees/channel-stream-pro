# RLS Security Audit Guide

## Overview

Este documento consolida as práticas de auditoria de Row-Level Security (RLS) para o projeto IPTVLink.

## Ferramentas Disponíveis

### 1. Database Functions

```sql
-- Verificar tabelas sem RLS
SELECT * FROM detect_tables_without_rls();

-- Verificar políticas permissivas
SELECT * FROM detect_permissive_policies();

-- Obter resumo de cobertura
SELECT * FROM get_rls_coverage_summary();

-- Auditoria completa
SELECT * FROM run_complete_rls_audit();
```

### 2. Edge Function

```bash
# Executar scan de RLS
curl -X POST https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/rls-coverage \
  -H "Authorization: Bearer <token>"
```

### 3. Admin Dashboard

Acesse `/admin/security` → Tab "RLS Coverage" para visualização interativa.

## Critérios de Segurança

### Nível Crítico (Deve Corrigir Imediatamente)
- Tabelas sem RLS habilitado
- Políticas com `USING (true)` em tabelas sensíveis
- Dados de usuário sem proteção

### Nível Alto (Corrigir em 24h)
- Políticas muito permissivas
- Missing `WITH CHECK` em INSERT/UPDATE
- Falta de índices em colunas de política

### Nível Médio (Corrigir em 1 semana)
- Políticas não otimizadas
- Redundância em políticas
- Documentação desatualizada

## Tabelas Sensíveis

| Tabela | Dados | RLS Obrigatório |
|--------|-------|-----------------|
| `profiles` | Dados pessoais | ✅ Sim |
| `user_roles` | Permissões | ✅ Sim |
| `clientes` | Info clientes | ✅ Sim |
| `user_subscriptions` | Assinaturas | ✅ Sim |
| `auth_sessions_log` | Sessões | ✅ Sim |
| `ip_blacklist` | Segurança | ✅ Sim |

## Padrões de Política

### Para dados do próprio usuário

```sql
CREATE POLICY "users_own_data" ON table_name
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Para admin/master acesso total

```sql
CREATE POLICY "admin_full_access" ON table_name
  FOR ALL
  USING (is_admin_or_master(auth.uid()))
  WITH CHECK (is_admin_or_master(auth.uid()));
```

### Para dados públicos (leitura)

```sql
CREATE POLICY "public_read" ON table_name
  FOR SELECT
  USING (is_public = true);
```

## Checklist de Auditoria

- [ ] Todas as tabelas têm RLS habilitado
- [ ] Nenhuma política usa `USING (true)` sem justificativa
- [ ] Tabelas sensíveis têm políticas restritivas
- [ ] Funções SECURITY DEFINER usam `SET search_path`
- [ ] Índices existem em colunas usadas em políticas
- [ ] Auditoria executada nos últimos 7 dias

## Automação

O sistema executa auditoria automática via:
- Cron job semanal (Segunda, 03:00 AM)
- Trigger em alterações de schema
- Manual via admin dashboard

## Alertas

Alertas são enviados quando:
- Nova tabela criada sem RLS
- Política permissiva detectada
- Score de segurança < 80%

---

*Última atualização: 2025-12-03*
