# Migração para Supabase Cloud (sdvyxdghxqmntyoweqbd)

## Dados do Projeto de Produção

| Projeto Supabase Cloud |
|------------------------|
| `sdvyxdghxqmntyoweqbd` |

---

## 1. EXPORTAR BANCO DE DADOS (Backup)

### Via Terminal (pg_dump)

```bash
# Exportar do Supabase Cloud
pg_dump "postgresql://postgres.sdvyxdghxqmntyoweqbd:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres" \
  --no-owner \
  --no-privileges \
  --schema=public \
  --schema=storage \
  --exclude-schema=supabase_functions \
  --exclude-schema=extensions \
  --exclude-schema=graphql \
  --exclude-schema=graphql_public \
  --exclude-schema=realtime \
  --exclude-schema=_realtime \
  --exclude-schema=supabase_migrations \
  --exclude-schema=vault \
  --exclude-schema=pgsodium \
  --exclude-schema=net \
  -Fc \
  -f supabase_cloud_backup.dump
```

### Via Supabase Dashboard (Alternativa)
1. Acesse: https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/settings/database
2. Em "Database Backups" → Download o backup mais recente

---

## 2. IMPORTAR BANCO DE DADOS (Destino)

```bash
# Importar para Supabase Cloud
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  -d "postgresql://postgres.sdvyxdghxqmntyoweqbd:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres" \
  lovable_cloud_backup.dump
```

---

## 3. CONFIGURAR SECRETS NO SUPABASE CLOUD

Acesse: https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/settings/functions

### Secrets Obrigatórios:

| Secret | Descrição |
|--------|-----------|
| `SUPABASE_URL` | `https://sdvyxdghxqmntyoweqbd.supabase.co` |
| `SUPABASE_ANON_KEY` | Anon key do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `MERCADO_PAGO_ACCESS_TOKEN` | Token do MercadoPago |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Secret do webhook MP |
| `WHATSAPP_APPKEY` | AppKey da API WhatsApp |
| `WHATSAPP_AUTHKEY` | AuthKey da API WhatsApp |
| `TMDB_API_KEY` | API key do TMDB |
| `JWT_SECRET` | Secret para tokens JWT |

---

## 4. DEPLOY DAS EDGE FUNCTIONS

As Edge Functions são deployadas automaticamente pelo Lovable quando você faz push do código.

### Funções Principais (75+):
- `iptv-play` - Streaming autenticado
- `stream-proxy` - Proxy de streams
- `mercado-pago-*` - Integrações de pagamento
- `whatsapp-*` - Notificações WhatsApp
- `m3u-*` - Gerenciamento de playlists
- `fetch-m3u` - Import de M3U
- `generate-m3u-from-sync` - Geração de M3U

---

## 5. CONFIGURAR AUTH

Acesse: https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/auth/providers

### Configurações Recomendadas:
- ✅ Enable email confirmations: **OFF** (auto-confirm)
- ✅ Enable email signup: **ON**
- ✅ Secure email change: **ON**

---

## 6. VERIFICAR RLS POLICIES

Após a migração, verificar se as policies foram migradas:

```sql
-- Listar todas as policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## 7. ATUALIZAR WEBHOOKS EXTERNOS

### MercadoPago
URL: `https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/mercado-pago-webhook`

### WhatsApp
URL: `https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/whatsapp-webhook`

---

## 8. VERIFICAÇÃO FINAL

### Testar Conexão:
```sql
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM user_roles;
SELECT COUNT(*) FROM iptv_channels;
```

### Testar Auth:
1. Fazer login com usuário existente
2. Verificar se roles são carregadas corretamente

---

## Status: ✅ Configuração do Cliente Concluída

- [x] URL atualizada para `sdvyxdghxqmntyoweqbd`
- [x] Anon Key configurada
- [x] Service Role Key como secret
- [ ] Migrar dados do banco
- [ ] Configurar secrets nas Edge Functions
- [ ] Testar autenticação
- [ ] Atualizar webhooks externos
