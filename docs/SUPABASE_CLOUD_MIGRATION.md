# Supabase Cloud - Documentação de Produção

## Status: ✅ COMPLETO

**Data:** 2025-12-18
**Projeto:** sdvyxdghxqmntyoweqbd
**URL:** https://sdvyxdghxqmntyoweqbd.supabase.co

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
- `iptv_channels` - Canais IPTV
- `subscription_plans` - Planos de assinatura

---

## 3. EDGE FUNCTIONS

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

---

## 5. ARQUITETURA FINAL

```
Frontend (React/Vite)
    ↓
Supabase Cloud (sdvyxdghxqmntyoweqbd)
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
- [x] Todas as referências atualizadas para sdvyxdghxqmntyoweqbd

---

## 7. VARIÁVEIS DE AMBIENTE

```env
VITE_SUPABASE_URL=https://sdvyxdghxqmntyoweqbd.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=sdvyxdghxqmntyoweqbd
```
