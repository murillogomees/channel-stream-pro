# 🔍 AUDITORIA COMPLETA DO PROJETO
**Data:** 2025-11-29
**Status:** EM ANÁLISE

---

## 📊 RESUMO EXECUTIVO

### Estrutura do Projeto
- **Total de Páginas Admin:** 48 arquivos em `src/pages/`
- **Total de Hooks:** 35 arquivos em `src/hooks/`
- **Total de Services:** 38 arquivos em `src/services/`
- **Total de Utils:** 8 arquivos em `src/utils/`
- **Edge Functions:** 33 funções em `supabase/functions/`
- **Tabelas no Banco:** 84 tabelas

---

## 🔴 PROBLEMAS CRÍTICOS ENCONTRADOS

### 1. ARQUIVO ÓRFÃO: src/outbox.js
**Severidade:** MÉDIA  
**Arquivo:** `src/outbox.js`

**Problema:** Este arquivo NÃO é importado em nenhum lugar do código. A funcionalidade de outbox já existe em:
- `src/lib/utils/indexedDB.ts` - implementação mais completa
- `public/sw.js` - Service Worker que processa o outbox

**Ação recomendada:** Mover para `deprecated/unused/outbox.js`

---

### 2. PARSERS M3U (NÃO É DUPLICAÇÃO)
**Severidade:** BAIXA (são diferentes)
**Arquivos:**
- `src/utils/m3uParser.ts` - Para admin/import (retorna `categories: string[]`)
- `src/modules/player/m3u/M3UParser.ts` - Para player (retorna `categories: M3UCategory[]`)

**Status:** ✅ OK - São interfaces diferentes para casos de uso diferentes

---

### 2. TABELAS COM ZERO REGISTROS (37 tabelas)
**Severidade:** MÉDIA  
**Potencialmente não utilizadas:**

| Tabela | Rows | Status |
|--------|------|--------|
| channel_usage_stats | 0 | ⚠️ REVISAR |
| notification_templates | 0 | ⚠️ REVISAR |
| activation_keys | 0 | ⚠️ REVISAR |
| security_alert_deliveries | 0 | ⚠️ REVISAR |
| admin_leaderboard_history | 0 | ⚠️ REVISAR |
| admin_badge_notifications | 0 | ⚠️ REVISAR |
| playlist_health_checks | 0 | ⚠️ REVISAR |
| admin_shortcuts | 0 | ⚠️ REVISAR |
| ip_whitelist | 0 | ⚠️ REVISAR |
| permission_discrepancy_alerts | 0 | ⚠️ REVISAR |
| custom_status_badges | 0 | ⚠️ REVISAR |
| status_change_history | 0 | ⚠️ REVISAR |
| smartone_sync_retry_queue | 0 | ⚠️ REVISAR |
| m3u_health_checks | 0 | ⚠️ REVISAR |
| notification_retry_queue | 0 | ⚠️ REVISAR |
| discount_coupons | 0 | ⚠️ REVISAR |
| conversion_metrics | 0 | ⚠️ REVISAR |
| ab_test_offers | 0 | ⚠️ REVISAR |
| trial_behavior_tracking | 0 | ⚠️ REVISAR |
| coupon_usage | 0 | ⚠️ REVISAR |
| ab_test_results | 0 | ⚠️ REVISAR |
| client_m3u_custom_assignments | 0 | ⚠️ REVISAR |
| notification_history | 0 | ⚠️ REVISAR |
| m3u_import_changes | 0 | ⚠️ REVISAR |
| notification_schedule | 0 | ⚠️ REVISAR |
| watch_history | 0 | ⚠️ REVISAR |
| watch_progress | 0 | ⚠️ REVISAR |
| user_favorites | 0 | ⚠️ REVISAR |
| user_watchlist | 0 | ⚠️ REVISAR |
| content_metadata | 0 | ⚠️ REVISAR |
| trending_rankings | 0 | ⚠️ REVISAR |
| recommendations_cache | 0 | ⚠️ REVISAR |
| epg_data | 0 | ⚠️ REVISAR |
| series_episodes | 0 | ⚠️ REVISAR |
| player_analytics | 0 | ⚠️ REVISAR |
| m3u_sync_sources | 0 | ⚠️ REVISAR |
| m3u_sync_jobs | 0 | ⚠️ REVISAR |
| m3u_sync_entries | 0 | ⚠️ REVISAR |
| m3u_sync_files | 0 | ⚠️ REVISAR |
| m3u_sync_errors | 0 | ⚠️ REVISAR |

---

### 3. ESTRUTURAS PARALELAS (NÃO DUPLICADAS - COMPLEMENTARES)
**Severidade:** BAIXA (são complementares, não duplicados)

- `src/features/player/` - Hooks para watch progress, continue watching, trending
- `src/modules/player/` - M3U parsing, stream service, focus manager

**Status:** ✅ OK - São usados juntos em AppPlayer.tsx

---

## 🟡 ARQUIVOS PARA REVISÃO

### Páginas que redirecionam para outras (legado)
Rotas configuradas apenas como redirects em App.tsx (já consolidadas):
- `/admin/m3u-lists` → `/admin/m3u`
- `/admin/m3u-stats` → `/admin/m3u`
- `/admin/m3u-custom-dashboard` → `/admin/m3u`
- `/admin/notificacoes` → `/admin/notifications`
- `/admin/security-alerts` → `/admin/security`
- `/admin/system-health` → `/admin/system`
- ... (e mais 20+ redirects)

**Status:** ✅ Bem organizado - páginas consolidadas em Hubs

---

### Arquivos que podem ser movidos para deprecated/

#### Utils possivelmente redundantes:
- `src/utils/m3uParser.ts` - **DUPLICADO** (usar versão em modules/player/m3u)

#### Arquivo órfão:
- `src/outbox.js` - Verificar se é utilizado

---

## 🟢 BEM ORGANIZADOS

### Páginas Admin
As páginas standalone são corretamente compostas em "Hub Pages":
- `AdminAnalyticsHub` → usa AdminAnalytics, AdminConversionDashboard, AdminCoupons
- `AdminNotifications` → usa AdminNotificacoes, AdminNotificationSettings, AdminAutoNotifications
- `AdminSecurity` → usa componentes de segurança
- `AdminSystemSettings` → usa AdminSystemHealth, AdminPlaylistHealth, AdminBackupSystem
- `AdminM3UManagement` → usa componentes M3U

### Hooks
Todos os hooks em `src/hooks/` são importados em pelo menos um lugar.

### Services
A maioria dos services está sendo utilizada.

---

## 📋 AÇÕES RECOMENDADAS

### FASE 1: Correções Críticas (IMEDIATO)
1. ✅ Atualizar `m3uCustomService.ts` para importar de `@/modules/player/m3u`
2. ⬜ Mover `src/utils/m3uParser.ts` para `deprecated/`
3. ⬜ Verificar uso de `src/outbox.js`

### FASE 2: Limpeza de Banco (APÓS VALIDAÇÃO)
1. ⬜ Criar migration para remover tabelas vazias não utilizadas
2. ⬜ Documentar quais tabelas são "preparação para funcionalidades futuras"

### FASE 3: Refatoração de Código
1. ⬜ Consolidar imports M3U em todo o projeto
2. ⬜ Remover código morto identificado

---

## 📁 ESTRUTURA RECOMENDADA

```
deprecated/
├── unused/
│   └── m3uParser.ts (mover de src/utils/)
└── README.md
```

---

## ⚠️ NOTAS IMPORTANTES

1. **NÃO REMOVER** tabelas vazias sem validar - podem ser para funcionalidades futuras
2. **MANTER** estrutura features/ e modules/ - são complementares
3. **TESTAR** após cada mudança para garantir funcionamento

---

## 📊 MÉTRICAS FINAIS

| Métrica | Valor |
|---------|-------|
| Arquivos totais analisados | ~200+ |
| Duplicações encontradas | 1 crítica (m3uParser) |
| Tabelas vazias | 37 |
| Redirects legados | 25+ |
| Páginas bem organizadas | ✅ Sim |
| Hooks bem organizados | ✅ Sim |
| Services bem organizados | ✅ Maioria |

---

*Relatório gerado automaticamente pela auditoria Lovable*
