# 📦 DEPRECATION NOTES

## Data: 2025-12-03
## Autor: lovable-agent
## Status: ✅ FASE 2 COMPLETA - Redirects Removidos

---

## Histórico de Execução

| Fase | Status | Data Execução |
|------|--------|---------------|
| Fase 1 - Consolidação Admin Hubs | ✅ Completo | 2025-11-29 |
| Fase 2 - Remoção Redirects Legacy | ✅ Completo | 2025-12-03 |

---

## Rotas Legacy REMOVIDAS (Fase 2)

### Dashboard Routes (REMOVIDAS)
```
/dashboard → /admin/dashboard ❌ REMOVIDO
/dashboard/* → /admin/dashboard ❌ REMOVIDO
```

### Cliente Routes (REMOVIDAS)
```
/admin/clientes/novo ❌ REMOVIDO
/admin/clientes/editar/:id ❌ REMOVIDO
/admin/clientes/:id/m3u ❌ REMOVIDO
```

### M3U Routes (REMOVIDAS)
```
/admin/m3u-builder ❌ REMOVIDO
/admin/m3u-import-history ❌ REMOVIDO
/admin/m3u-sync ❌ REMOVIDO
/admin/m3u-lists ❌ REMOVIDO
/admin/m3u-stats ❌ REMOVIDO
/admin/m3u-custom-dashboard ❌ REMOVIDO
/admin/m3u/custom ❌ REMOVIDO
/admin/m3u-usage-report ❌ REMOVIDO
```

### Notification Routes (REMOVIDAS)
```
/admin/notifications ❌ REMOVIDO
/admin/notification-queue ❌ REMOVIDO
/admin/notification-settings ❌ REMOVIDO
/admin/auto-notifications ❌ REMOVIDO
/admin/templates ❌ REMOVIDO
```

### Security Routes (REMOVIDAS)
```
/admin/security ❌ REMOVIDO
/admin/security-alerts ❌ REMOVIDO
/admin/security-monitor ❌ REMOVIDO
/admin/security-analytics ❌ REMOVIDO
/admin/security-escalation ❌ REMOVIDO
/admin/suspicious-logins ❌ REMOVIDO
/admin/ip-blocking ❌ REMOVIDO
/admin/ip-whitelist ❌ REMOVIDO
/admin/2fa-settings ❌ REMOVIDO
```

### System Routes (REMOVIDAS)
```
/admin/system ❌ REMOVIDO
/admin/system-health ❌ REMOVIDO
/admin/playlist-health ❌ REMOVIDO
/admin/backup-system ❌ REMOVIDO
/admin/customize ❌ REMOVIDO
/admin/variables ❌ REMOVIDO
/admin/status-history ❌ REMOVIDO
/admin/custom-status-badges ❌ REMOVIDO
/dashboard/homepage ❌ REMOVIDO
/dashboard/plans ❌ REMOVIDO
```

### Analytics Routes (REMOVIDAS)
```
/admin/conversion-dashboard ❌ REMOVIDO
/admin/coupons ❌ REMOVIDO
```

### User Routes (REMOVIDAS)
```
/admin/users ❌ REMOVIDO
/admin/create-user ❌ REMOVIDO
/admin/user-roles ❌ REMOVIDO
/admin/role-audit ❌ REMOVIDO
/admin/permission-test ❌ REMOVIDO
```

### Integration Routes (REMOVIDAS)
```
/admin/integrations ❌ REMOVIDO
/admin/whatsapp-config ❌ REMOVIDO
/admin/cdn ❌ REMOVIDO
/admin/transcode-queue ❌ REMOVIDO
/admin/iptv-test ❌ REMOVIDO
/admin/smart-cache ❌ REMOVIDO
/admin/qa ❌ REMOVIDO
```

### Other Legacy Routes (REMOVIDAS)
```
/admin/login ❌ REMOVIDO
/auth ❌ REMOVIDO
/settings ❌ REMOVIDO
/subscription ❌ REMOVIDO
/install ❌ REMOVIDO
/conta ❌ REMOVIDO
/cliente/account ❌ REMOVIDO
/app/login ❌ REMOVIDO
/app/signup ❌ REMOVIDO
/app/home ❌ REMOVIDO
/app/favorites ❌ REMOVIDO
/app/account ❌ REMOVIDO
```

---

## Rotas Canônicas Ativas

### Public Routes
| Rota | Descrição |
|------|-----------|
| `/` | Landing page |
| `/signup` | Cadastro |
| `/cadastro` | Cadastro (alias PT) |
| `/login` | Login |
| `/checkout` | Checkout |
| `/checkout/success` | Checkout sucesso |
| `/checkout/failure` | Checkout falha |
| `/checkout/pending` | Checkout pendente |
| `/afiliado` | Dashboard afiliado |

### App Routes (IPTV Player)
| Rota | Descrição |
|------|-----------|
| `/app` | Entry point |
| `/app/install` | Instalação |
| `/app/player` | Player principal |
| `/app/profile` | Perfil |
| `/app/mylist` | Minha lista |
| `/tv-player` | TV Player |

### Admin Routes (Hub Pages)
| Rota | Hub | Tabs |
|------|-----|------|
| `/admin/dashboard` | Dashboard | Overview |
| `/admin/clientes` | Clientes | Lista, Criar, Editar |
| `/admin/m3u` | M3U | Listas, Builder, Import, Stats |
| `/admin/notificacoes` | Notificações | Queue, Templates, Config |
| `/admin/seguranca` | Segurança | Monitor, Alertas, IPs, 2FA, RLS |
| `/admin/sistema` | Sistema | Health, Backup, Status, Config |
| `/admin/analytics` | Analytics | Overview, Conversão, Cupons |
| `/admin/usuarios` | Usuários | Lista, Pagamentos, Atividades, Roles |
| `/admin/roles` | Roles | Gestão avançada |
| `/admin/integracao` | Integração | WhatsApp, CDN, Transcode, Cache |
| `/admin/migrations` | Migrations | Schema, Drift, Fixes |
| `/admin/rls-coverage` | RLS | Cobertura, Políticas |
| `/admin/perfil` | Perfil Admin | Settings |
| `/admin/afiliados` | Afiliados | Gestão |

---

## Métricas da Limpeza

| Métrica | Antes | Depois | Redução |
|---------|-------|--------|---------|
| Total de rotas | 85 | 34 | -60% |
| Redirects legacy | 51 | 0 | -100% |
| Linhas App.tsx | 250 | 137 | -45% |
| Bundle size estimado | - | - | ~2KB |

---

## Rollback (se necessário)

Para restaurar os redirects legacy:
```bash
git revert <commit-hash-fase-2>
```

---

## Histórico de Alterações

| Data | Ação | Responsável |
|------|------|-------------|
| 2025-11-29 | Criação AdminHubs consolidados | lovable-agent |
| 2025-11-29 | Configuração redirects legacy | lovable-agent |
| 2025-12-03 | **FASE 2: Remoção de 51 redirects** | lovable-agent |

---

*Última atualização: 2025-12-03*
