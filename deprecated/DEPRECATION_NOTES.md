# 📦 DEPRECATION NOTES

## Data: 2025-11-29
## Autor: lovable-agent
## Motivo: Consolidação de arquitetura admin

---

## Status Geral

| Item | Status | Data Prevista Remoção |
|------|--------|----------------------|
| Rotas Legacy | 🟡 Redirect Ativo | 2025-12-29 (30 dias) |
| Páginas Órfãs | ✅ Nenhuma identificada | N/A |
| Tabelas DB | ✅ Nenhuma marcada | N/A |

---

## Rotas Legacy (Scheduled for Removal)

As seguintes rotas estão configuradas como redirects e devem ser **REMOVIDAS após 30 dias** (2025-12-29):

### M3U Routes → /admin/m3u
```
/admin/m3u-lists
/admin/m3u-stats
/admin/m3u-custom-dashboard
/admin/m3u/custom
/admin/m3u-usage-report
/admin/m3u-builder
/admin/m3u-import-history
```

### Notification Routes → /admin/notifications
```
/admin/notificacoes
/admin/notification-settings
/admin/auto-notifications
/admin/templates
/admin/notification-queue
```

### Security Routes → /admin/security
```
/admin/security-alerts
/admin/security-monitor
/admin/security-analytics
/admin/security-escalation
/admin/suspicious-logins
/admin/ip-blocking
/admin/ip-whitelist
/admin/2fa-settings
```

### System Routes → /admin/system
```
/admin/system-health
/admin/playlist-health
/admin/backup-system
/admin/customize
/admin/variables
/admin/status-history
/admin/custom-status-badges
```

### User Routes → /admin/users
```
/admin/user-roles
/admin/role-audit
/admin/permission-test
```

### Analytics Routes → /admin/analytics
```
/admin/conversion-dashboard
/admin/coupons
```

### Auth Routes
```
/admin/login → /login
/auth → /login
/admin/dashboard → /dashboard
```

---

## Páginas Sub-componentes (NÃO DEPRECADAS)

As seguintes páginas são usadas como **tabs dentro dos hubs** e NÃO devem ser deprecadas:

### AdminM3UManagement (Hub)
- AdminM3ULists.tsx
- AdminM3UCustomDashboard.tsx
- AdminM3UCustomBuilder.tsx
- AdminM3UImportHistory.tsx
- AdminM3UListStats.tsx
- AdminM3UUsageReport.tsx
- AdminVODStorage.tsx

### AdminNotifications (Hub)
- AdminNotificacoes.tsx
- AdminNotificationSettings.tsx
- AdminAutoNotifications.tsx
- AdminNotificationQueue.tsx
- AdminTemplates.tsx

### AdminSecurity (Hub)
- AdminSecurityAlerts.tsx
- AdminSecurityMonitor.tsx
- AdminSecurityAnalytics.tsx
- AdminSecurityEscalation.tsx
- AdminSuspiciousLogins.tsx
- AdminIPBlocking.tsx
- AdminIPWhitelist.tsx
- Admin2FASettings.tsx

### AdminSystemSettings (Hub)
- AdminSystemHealth.tsx
- AdminPlaylistHealth.tsx
- AdminBackupSystem.tsx
- AdminCustomize.tsx
- AdminVariables.tsx
- AdminStatusHistory.tsx
- AdminCustomStatusBadges.tsx

### AdminUsersPermissions (Hub)
- AdminUserRoles.tsx
- AdminCreateUser.tsx
- AdminRoleAudit.tsx
- AdminPermissionTest.tsx

### AdminAnalyticsHub (Hub)
- AdminAnalytics.tsx
- AdminConversionDashboard.tsx
- AdminCoupons.tsx

---

## Processo de Remoção de Rotas Legacy

### Pré-requisitos (antes de 2025-12-29):
1. [ ] Verificar analytics de uso das rotas legacy
2. [ ] Confirmar que nenhum link externo aponta para rotas antigas
3. [ ] Rodar testes E2E completos
4. [ ] Backup do App.tsx atual

### Passos para Remoção:
1. Remover todas as linhas `<Navigate to="..." replace />` do App.tsx
2. Manter apenas as rotas canônicas
3. Rodar build e testes
4. Deploy para staging
5. Monitorar erros 404 por 7 dias
6. Deploy para produção

### Comando para Remoção (executar após 2025-12-29):
```tsx
// Em App.tsx, remover linhas 120-154 (rotas legacy)
```

---

## Rollback

Para restaurar as rotas legacy:
```bash
git revert <commit-hash-da-remocao>
```

---

## Histórico de Alterações

| Data | Ação | Responsável |
|------|------|-------------|
| 2025-11-29 | Criação do AdminHub consolidado | lovable-agent |
| 2025-11-29 | Configuração de redirects legacy | lovable-agent |
| 2025-11-29 | Documentação de deprecação | lovable-agent |

---

*Última atualização: 2025-11-29*
