# Migração Supabase Cloud - Documentação Final

## Status: ✅ COMPLETO

**Data:** 2025-12-13
**Projeto:** waxgowafohlrfoefwhsf
**URL:** https://waxgowafohlrfoefwhsf.supabase.co

---

## 1. AUTENTICAÇÃO

- **Método:** Supabase GoTrue nativo
- **Auto-confirm email:** ✅ Ativado
- **Signup desabilitado:** ❌ Não
- **Usuários anônimos:** ❌ Desabilitado

### Fluxo de Auth:
1. `AuthContext.tsx` → usa `supabase.auth.signInWithPassword()`
2. Roles carregadas de `public.user_roles`
3. Profiles carregados de `public.profiles`

---

## 2. BANCO DE DADOS

- **Total de tabelas:** 92
- **RLS habilitado:** ✅ Todas as tabelas
- **Usuários ativos:** 3

### Tabelas Principais:
- `profiles` - Dados do usuário
- `user_roles` - Permissões (client/admin/master)
- `iptv_channels` - 22,974 canais
- `subscription_plans` - Planos de assinatura

---

## 3. EDGE FUNCTIONS

### Funções Removidas (self-hosted):
- `custom-auth` - Substituída por GoTrue
- `coolify-api` - Não necessário
- `coolify-secrets` - Não necessário
- `remote-command` - Não necessário
- `ssh-command` - Não necessário
- `main` (router) - Não necessário para Cloud
- `deploy-webhook` - Auto-deploy do Lovable
- Funções diagnóstico GoTrue - Não necessário

### Funções Ativas (75+):
- `iptv-play` - Streaming autenticado
- `mercado-pago-*` - Pagamentos
- `whatsapp-*` - Notificações
- `m3u-*` - Gerenciamento de playlists
- `cdn-*` - CDN e cache

---

## 4. SECRETS CONFIGURADOS

| Secret | Status |
|--------|--------|
| SUPABASE_URL | ✅ |
| SUPABASE_ANON_KEY | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | ✅ |
| JWT_SECRET | ✅ |
| MERCADO_PAGO_ACCESS_TOKEN | ✅ |
| WHATSAPP_APPKEY | ✅ |
| WHATSAPP_AUTHKEY | ✅ |
| R2_* | ✅ CDN |
| CLOUDFLARE_* | ✅ Stream |
| TMDB_API_KEY | ✅ |

### Secrets Obsoletos (podem ser removidos):
- `SELFHOSTED_DB_URL`
- `SELFHOSTED_SERVICE_ROLE_KEY`
- `VPS_SSH_*`
- `COOLIFY_API_TOKEN`

---

## 5. ARQUITETURA FINAL

```
Frontend (React/Vite)
    ↓
Supabase Cloud (waxgowafohlrfoefwhsf)
    ├── Auth (GoTrue)
    ├── Database (PostgreSQL)
    ├── Edge Functions
    ├── Storage
    └── Realtime
```

---

## 6. CHECKLIST DE VALIDAÇÃO

- [x] Auth funcionando com GoTrue
- [x] RLS policies ativas
- [x] Edge Functions deployadas
- [x] Secrets configurados
- [x] Frontend apontando para Cloud
- [x] Referências self-hosted removidas do código principal

---

## 7. PRÓXIMOS PASSOS RECOMENDADOS

1. **Remover secrets obsoletos** via Lovable Settings
2. **Testar login/signup** em produção
3. **Verificar pagamentos** MercadoPago
4. **Testar notificações** WhatsApp
5. **Monitorar logs** de Edge Functions
