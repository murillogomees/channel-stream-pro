# 🔍 AUDITORIA DE SERVIÇOS DUPLICADOS
**Data:** 2025-11-29

---

## 📊 RESUMO EXECUTIVO

- **Total de serviços analisados:** 38
- **Duplicatas identificadas:** 3
- **Serviços similares para consolidar:** 2
- **Código duplicado em implementação:** 1

---

## 🚨 DUPLICATAS CRÍTICAS

### 1. `securityAlertService.ts` vs `securityWhatsAppAlertService.ts`

| Aspecto | securityAlertService | securityWhatsAppAlertService |
|---------|---------------------|------------------------------|
| Linhas | ~206 | ~534 |
| Funcionalidade | Alertas básicos | Sistema completo |
| WhatsApp | Placeholder (não envia) | Implementado |
| Templates | Não | Sim |
| Cooldown | 15 min | 10 min |
| Horário de plantão | Não | Sim |

**⚠️ RECOMENDAÇÃO:** Remover `securityAlertService.ts` - é uma versão incompleta

---

### 2. `m3uHealthService.ts` vs `playlistHealthService.ts`

| Aspecto | m3uHealthService | playlistHealthService |
|---------|------------------|----------------------|
| Linhas | ~166 | ~301 |
| Tabela | `m3u_health_checks` | `playlist_health_checks` |
| Edge Function | `check-m3u-health` | `check-playlist-health` |
| Snooze | Por lista M3U | Por playlist |
| Interface | M3UHealthCheck | PlaylistHealthCheck |

**⚠️ RECOMENDAÇÃO:** Consolidar em um único serviço - ambos fazem health check de M3U

---

### 3. Implementação duplicada de WhatsApp em `criticalStatusAlertService.ts`

O serviço implementa `sendWhatsAppMessage()` diretamente (linhas 202-232) em vez de usar o `whatsapp.ts` centralizado.

```typescript
// ❌ ATUAL - Implementação própria
private async sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  const response = await fetch('https://api.iagentechat.com.br/v2/api/send-message', ...);
}

// ✅ DEVERIA USAR
import { getWhatsAppService } from './whatsapp';
const service = getWhatsAppService();
await service.sendTextMessage(phone, message);
```

**⚠️ RECOMENDAÇÃO:** Refatorar para usar `whatsapp.ts`

---

## 📋 CATEGORIZAÇÃO DOS SERVIÇOS

### ✅ Notificações (7 serviços)

| Serviço | Status | Observação |
|---------|--------|------------|
| `adminNotificationService.ts` | ✅ OK | Notifica admins sobre mensagens |
| `autoNotificationService.ts` | ✅ OK | Scheduler local (localStorage) |
| `prospectNotificationService.ts` | ✅ OK | Notificações de prospects |
| `automaticNotificationRuleService.ts` | ✅ OK | Regras automáticas |
| `notificationScheduler.ts` | ✅ OK | Agendador |
| `notifications/` (pasta) | ✅ OK | Sistema modular |

### ✅ Segurança (6 serviços)

| Serviço | Status | Observação |
|---------|--------|------------|
| `securityWhatsAppAlertService.ts` | ✅ MANTER | Sistema principal de alertas |
| `securityAlertService.ts` | 🗑️ REMOVER | Duplica acima |
| `criticalStatusAlertService.ts` | ⚠️ REFATORAR | Usa WhatsApp próprio |
| `securityMonitoringService.ts` | ✅ OK | Core de logging |
| `securityAnalyticsService.ts` | ✅ OK | Analytics |
| `securityAlertStatsService.ts` | ✅ OK | Estatísticas |

### ✅ M3U / Playlist (8 serviços)

| Serviço | Status | Observação |
|---------|--------|------------|
| `m3uHealthService.ts` | ⚠️ CONSOLIDAR | Similar a playlistHealthService |
| `playlistHealthService.ts` | ⚠️ CONSOLIDAR | Similar a m3uHealthService |
| `m3uConflictService.ts` | ✅ OK | Resolução de conflitos |
| `m3uCustomService.ts` | ✅ OK | Listas customizadas |
| `m3uGeneratorService.ts` | ✅ OK | Geração de M3U |
| `m3uImportService.ts` | ✅ OK | Importação |
| `m3uPlanService.ts` | ✅ OK | Planos |
| `m3uValidationService.ts` | ✅ OK | Validação |

### ✅ Outros (17 serviços) - Todos OK

| Serviço | Funcionalidade |
|---------|----------------|
| `activityLogService.ts` | Logs de atividade |
| `adminBadgeService.ts` | Badges de admin |
| `authLoggingService.ts` | Logs de auth |
| `backupService.ts` | Backups |
| `ipBlockingService.ts` | Bloqueio de IP |
| `ipWhitelistService.ts` | Whitelist de IP |
| `metaPixelService.ts` | Meta Pixel |
| `metricsPersistenceService.ts` | Persistência de métricas |
| `playlistCacheService.ts` | Cache de playlist |
| `playlistSyncService.ts` | Sync de playlist |
| `shortcutService.ts` | Atalhos admin |
| `suspiciousLoginService.ts` | Detecção de login suspeito |
| `systemHealthService.ts` | Saúde do sistema |
| `trialRetentionService.ts` | Retenção de trials |
| `twoFactorAuthService.ts` | 2FA |
| `vodDetectionService.ts` | Detecção de VOD |
| `websocketMetricsService.ts` | Métricas WebSocket |

---

## 🔧 AÇÕES RECOMENDADAS

### Imediato (Impacto Alto)

1. **Remover `securityAlertService.ts`**
   - Buscar usos: `grep -r "securityAlertService" src/`
   - Substituir por `securityWhatsAppAlertService`
   - Arquivo a deletar: `src/services/securityAlertService.ts`

### Médio Prazo (Impacto Médio)

2. **Consolidar health services**
   - Criar `playlistHealthService.ts` unificado
   - Manter tabelas separadas ou unificar
   - Atualizar edge functions correspondentes

3. **Refatorar `criticalStatusAlertService.ts`**
   - Remover método `sendWhatsAppMessage()` interno
   - Usar `getWhatsAppService()` de `whatsapp.ts`

---

## 📁 ESTRUTURA RECOMENDADA

```
src/services/
├── notifications/           # Sistema modular de notificações
│   ├── core/
│   │   ├── WhatsAppAdapter.ts
│   │   ├── WhatsAppClient.ts   # Renomear de whatsapp.ts
│   │   └── ...
│   └── ...
├── security/               # Agrupar serviços de segurança
│   ├── alertService.ts     # Consolidado
│   ├── monitoringService.ts
│   ├── analyticsService.ts
│   └── ...
├── m3u/                    # Agrupar serviços M3U
│   ├── healthService.ts    # Consolidado
│   ├── importService.ts
│   └── ...
└── ...
```

---

*Auditoria de Serviços - 29/11/2025*
