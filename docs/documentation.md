# IPTVLINK - Documentação Técnica Consolidada

> Versão: 1.1 | Última atualização: 2025-12-05

---

## Sumário

1. [Arquitetura do Sistema](#1-arquitetura-do-sistema)
2. [Autenticação e Autorização](#2-autenticação-e-autorização)
3. [Player e Streaming](#3-player-e-streaming)
4. [Sistema de Notificações](#4-sistema-de-notificações)
5. [CDN e Infraestrutura](#5-cdn-e-infraestrutura)
6. [Gerenciamento de Playlists M3U](#6-gerenciamento-de-playlists-m3u)
7. [Segurança](#7-segurança)
8. [Validação de Formulários](#8-validação-de-formulários)
9. [Webhooks e Integrações](#9-webhooks-e-integrações)
10. [Rate Limiting](#10-rate-limiting)
11. [Playbooks Operacionais](#11-playbooks-operacionais)
12. [Troubleshooting](#12-troubleshooting)
13. [Variáveis de Ambiente](#13-variáveis-de-ambiente)
14. [Deployment](#14-deployment)
15. [Edge Functions Reference](#15-edge-functions-reference)
16. [Backup e Disaster Recovery](#16-backup-e-disaster-recovery)
17. [Changelog](#17-changelog)
18. [API Reference](#18-api-reference)

---

## 1. Arquitetura do Sistema

### Visão Geral

IPTVLINK é uma plataforma IPTV enterprise-grade projetada para:
- **10M+ usuários concorrentes** (escalabilidade)
- **99.9% uptime** (confiabilidade)
- **< 2.5s cold start** (performance)
- **Suporte universal** (Tizen, webOS, Android TV, Fire TV, browsers)

### Macro Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  Smart TV │ Browser │ Mobile │ WebView (Capacitor)          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│              React SPA (Vite + TypeScript)                   │
│         VideoPlayer │ TVGridLayout │ Focus Manager          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    SERVICES LAYER                            │
│        StreamService │ TelemetryService │ AuthService        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                 EDGE FUNCTIONS (Supabase)                    │
│    stream-proxy │ fetch-m3u-url │ generate-m3u-file         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     DATA LAYER                               │
│      PostgreSQL (RLS) │ R2 Storage │ Auth (JWT)             │
└─────────────────────────────────────────────────────────────┘
```

### Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| Framework | React 18 + TypeScript 5 |
| Build | Vite 5 |
| Styling | Tailwind CSS + shadcn/ui |
| State | React hooks + Context API |
| Backend | Supabase (Edge Functions, PostgreSQL) |
| CDN | Cloudflare R2 |
| Mobile | Capacitor |

---

## 2. Autenticação e Autorização

### Arquitetura de 3 Níveis

| Role | Descrição | Acesso |
|------|-----------|--------|
| **client** | Usuários finais | `/app/*` (player) |
| **admin** | Administradores | `/admin/*` (dashboard) |
| **master** | Super-administrador | Controle total (murillo@gmail.com) |

### Componentes

1. **Supabase Auth** (auth.users) - Identidade
2. **profiles** - Dados de usuário/cliente (single source of truth)
3. **user_roles** - Mapeamento usuário → role
4. **Custom Access Token Hook** - Injeta role no JWT

### Fluxo de Login

```
Credenciais → Supabase Auth → custom_access_token_hook → JWT com role → Frontend redireciona
```

### Funções de Permissão

```sql
-- Verifica se é admin ou master
SELECT is_admin_or_master();

-- Verifica role específica
SELECT has_role('admin');
```

### RLS Policies

- **Clients**: Acessam apenas próprios dados
- **Admins/Master**: Acesso total
- **Master exclusivo**: Gerencia roles de outros usuários

---

## 3. Player e Streaming

### Arquitetura do Player

```
┌─────────────────────────────────────────────────────────────┐
│                       UI Components                          │
│  VideoPlayer │ PlayerOverlay │ TVGridLayout │ TVFocusableCard│
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                       Hooks Layer                            │
│  usePlayerController │ useRemoteInput │ useIPTVPlaylist     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                       Core Layer                             │
│  PlayerStateMachine │ TechAdapter │ DeviceDetector          │
│  QoSMonitor │ RemoteKeyMap │ Logger                         │
└─────────────────────────────────────────────────────────────┘
```

### Estados do Player

`idle` → `loading` → `buffering` → `playing` ⟷ `paused` → `stalled` → `retrying` → `error`

### Detecção de Dispositivo

| Plataforma | Detecção |
|------------|----------|
| Tizen | `navigator.userAgent.includes('Tizen')` ou `window.tizen` |
| webOS | `navigator.userAgent.includes('webOS')` ou `window.webOS` |
| Fire TV | `userAgent.includes('AFTT\|AFTS\|AFTM')` |
| Android TV | `userAgent.includes('Android TV')` |

### Mapeamento de Controles Remotos

| Ação | Teclado | Tizen | webOS | Android TV |
|------|---------|-------|-------|------------|
| up | ArrowUp | 38 | 38 | 19/38 |
| ok | Enter | 13 | 13 | 23/13 |
| back | Escape | 10009 | 461 | 8/27 |
| playpause | Space | 10252 | - | 85 |

### Stream Proxy

**Endpoint:** `supabase/functions/stream-proxy`

**Funcionalidades:**
- CORS bypass
- HLS rewriting (reescreve URLs no manifest)
- HTTPS→HTTP fallback
- Retry com exponential backoff
- User-Agent masking (simula VLC)

---

## 4. Sistema de Notificações

### Arquitetura

```
src/services/notifications/
├── core/
│   ├── NotificationService.ts    # Envio principal
│   ├── TemplateEngine.ts         # Templates e variáveis
│   └── WhatsAppAdapter.ts        # API WhatsApp (BotBot)
├── detectors/
│   ├── PaymentDetector.ts        # Detecta pagamentos
│   └── NewClientDetector.ts      # Detecta novos clientes
└── handlers/
    ├── DueDateNotificationHandler.ts    # Vencimento
    ├── EventNotificationHandler.ts      # Boas-vindas, renovação
    └── UpdateNotificationHandler.ts     # Atualizações
```

### Tipos de Eventos

| Evento | Trigger |
|--------|---------|
| `expiration` | Dias antes/depois do vencimento |
| `welcome_trial` | Novo cliente em teste |
| `welcome_plan` | Novo cliente com plano |
| `renewal` | Pagamento detectado |

### Variáveis de Template

- `{nome}` - Nome do cliente
- `{valor}` - Valor formatado
- `{dataVencimento}` - Data de vencimento
- `{plano}` - Plano contratado

---

## 5. CDN e Infraestrutura

### Cloudflare R2

**Bucket:** `iptvlink-cdn` (standard para todas operações CDN)

### CDN Router (Cloudflare Worker)

**Localização:** `workers/cdn-router/`

**Funcionalidades:**
- JWT validation
- Cache key normalization
- Rate limiting
- Referrer checks
- Security headers

### Cache Strategy

| Tipo | Browser Cache | CDN Cache |
|------|---------------|-----------|
| .m3u8 manifests | 10s | 30s |
| .ts segments | 1h | 24h (immutable) |
| outros | 60s | 60s |

### Hybrid Streaming Architecture

```
Player Request
      │
      ▼
Edge Router (Worker)
      │
      ├──→ Cloudflare Stream (VOD)
      ├──→ R2 CDN
      └──→ Origin Server (Live)
```

**Estratégias de Roteamento:**

| Content Type | Strategy |
|--------------|----------|
| VOD | USE_STREAM |
| Live | USE_ORIGIN |
| Agile | USE_ORIGIN |

---

## 6. Gerenciamento de Playlists M3U

### Padrão de Acesso

**IMPORTANTE:** Clientes NÃO têm acesso direto às tabelas M3U.

```
Cliente → CDN URL → M3U Content
Admin → Edge Function → Database → R2 Storage
```

### Edge Functions

| Função | Descrição |
|--------|-----------|
| `generate-m3u-file` | Gera M3U (admin only, JWT required) |
| `fetch-m3u-url` | Importa M3U de URL (proxy server-side) |
| `m3u-sync` | Sincronização de playlists |
| `clean-m3u` | Limpeza e validação |

### Limitações

- **Tamanho máximo de import:** 60MB via Edge Function
- **Alternativa:** Paste direto no admin (client-side parsing)
- **Timeout:** 150 segundos (Supabase limit)

### Estrutura de Storage

```
playlists/
├── cleaned/YYYY/MM/DD/{uuid}-{hash}.m3u
└── archive/YYYY-MM.tar.gz
```

---

## 7. Segurança

### RLS Security Audit

**Tabelas Sensíveis com RLS Obrigatório:**

| Tabela | Dados |
|--------|-------|
| `profiles` | Dados pessoais |
| `user_roles` | Permissões |
| `auth_sessions_log` | Sessões |
| `ip_blacklist` | Segurança |

### Funções de Auditoria

```sql
-- Tabelas sem RLS
SELECT * FROM detect_tables_without_rls();

-- Políticas permissivas
SELECT * FROM detect_permissive_policies();

-- Auditoria completa
SELECT * FROM run_complete_rls_audit();
```

### Sistema de Alertas de Segurança

**Canais:** WhatsApp (BotBot API)

**Funcionalidades:**
- Sistema de plantão com horários
- Confirmação de leitura
- Escalonamento automático

**Configuração de Escalação:**
- Cron job a cada 5 minutos (`escalate-security-alerts`)
- Time window configurável
- Ações: notify_all, notify_secondary

### SECURITY DEFINER Functions

Todas as funções com `SECURITY DEFINER` devem ter:
```sql
SET search_path = public
```

---

## 8. Validação de Formulários

### Regras Globais

| Campo | Validação |
|-------|-----------|
| Telefone | Formato brasileiro, 10-11 dígitos |
| Email | RFC 5322, máx 255 chars |
| Nome | 3-100 chars, sem caracteres especiais |
| Senha | 8-128 chars, verificação HIBP |
| MAC Address | XX:XX:XX:XX:XX:XX |

### Componentes

- `PhoneInput` - Máscara brasileira
- `DatePicker` - Seleção de data
- `PasswordStrengthIndicator` - Força da senha

### Segurança XSS

Campos que requerem sanitização:
- Nome, Email, Telefone, MAC Address, texto livre

---

## 9. Webhooks e Integrações

### WhatsApp Webhook

**URL:** `https://[project].supabase.co/functions/v1/whatsapp-webhook`

**Eventos suportados:**
- `message_read` → status `confirmed`
- `message_delivered` → status `delivered`
- `message_failed` → status `failed`

**Segurança:**
- HMAC signature (`x-webhook-signature`)
- Bearer token (`WHATSAPP_WEBHOOK_SECRET`)

### SmartOne Webhook

**Validação:** HMAC com `SMARTONE_WEBHOOK_SECRET`

---

## 10. Rate Limiting

### Configurações por Endpoint

| Endpoint | Limite | Janela |
|----------|--------|--------|
| `auth_login` | 5 req | 60s |
| `auth_signup` | 3 req | 300s |
| `create_admin_user` | 5 req | 60s |
| `generate_m3u` | 10 req | 3600s |
| `stream_proxy` | 100 req | 60s |
| `webhook_whatsapp` | 1000 req | 60s |

### Auto-Blocking

- **Trigger:** Excede 2x o limite
- **Duração:** 24 horas
- **Registro:** Tabela `ip_blacklist`

---

## 11. Playbooks Operacionais

### Failover de Streaming

**Cloudflare Stream Indisponível:**
1. Edge Router detecta `streamHealthy: false`
2. Requisições redirecionadas para origin
3. Alerta enviado para admin

**Comandos úteis:**
```bash
# Verificar status do worker
curl https://stream-edge-router.workers.dev/health

# Forçar origin para todos
UPDATE streaming_policies SET strategy = 'USE_ORIGIN' WHERE content_type = 'vod';
```

### Controle de Custos

**Cloudflare Stream:**
- Storage: $5/1000 min/mês
- Delivery: $1/1000 min assistidos

**Otimizações:**
- Priorizar "Stream On-Demand"
- Limitar uploads automáticos
- Caching agressivo
- Cleanup de conteúdo antigo

---

## 12. Troubleshooting

### Erros Comuns

#### Player não carrega vídeo
```
Sintoma: Loading infinito, vídeo não inicia
Causa: stream-proxy timeout (150s) ou CORS
Solução:
1. Verificar logs do stream-proxy
2. VOD deve usar R2 direto (bypass proxy)
3. Checar se URL do stream está acessível
```

#### JWT Expired / Sessão Inválida
```
Sintoma: Logout inesperado, erro 401
Causa: Token expirado não renovado
Solução:
1. Limpar localStorage
2. Fazer logout/login
3. Verificar custom_access_token_hook
```

#### M3U Import Falha
```
Sintoma: Erro ao importar playlist
Causa: Arquivo > 60MB ou timeout
Solução:
1. Usar paste direto (client-side) para arquivos grandes
2. Dividir playlist em partes menores
3. Verificar formato M3U válido
```

#### RLS Policy Error
```
Sintoma: "new row violates row-level security"
Causa: Política RLS bloqueando operação
Solução:
1. Verificar role do usuário no JWT
2. Executar SELECT * FROM user_roles WHERE user_id = 'xxx'
3. Ajustar política ou adicionar role
```

### Diagnóstico de Permissões

```sql
-- Verificar role atual
SELECT * FROM user_roles WHERE user_id = auth.uid();

-- Verificar se é admin
SELECT is_admin_or_master();

-- Claims do JWT (via Edge Function)
SELECT auth.jwt() -> 'user_metadata' -> 'role';
```

### Logs e Monitoramento

| Serviço | Localização |
|---------|-------------|
| Edge Functions | Supabase Dashboard > Edge Functions > Logs |
| Database | Supabase Dashboard > Database > Query Logs |
| CDN Worker | Cloudflare Dashboard > Workers > Logs |
| Auth | Supabase Dashboard > Authentication > Logs |

### Comandos de Debug

```bash
# Testar Edge Function
curl -X POST https://[project].supabase.co/functions/v1/[function] \
  -H "Authorization: Bearer [JWT]" \
  -H "Content-Type: application/json" \
  -d '{}'

# Verificar saúde do CDN
curl https://[cdn-worker].workers.dev/health

# Testar conectividade R2
curl -I https://[r2-bucket].r2.cloudflarestorage.com/test.txt
```

---

## 13. Variáveis de Ambiente

### Supabase (Secrets)

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `SUPABASE_URL` | URL do projeto Supabase | ✅ |
| `SUPABASE_ANON_KEY` | Chave pública anon | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (admin) | ✅ |

### WhatsApp (BotBot)

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `WHATSAPP_APPKEY` | App key da API BotBot | ✅ |
| `WHATSAPP_AUTHKEY` | Auth key da API BotBot | ✅ |
| `WHATSAPP_WEBHOOK_SECRET` | Secret para validar webhooks | ✅ |

### Cloudflare

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare | ✅ |
| `CLOUDFLARE_API_TOKEN` | Token de API com permissões R2/Workers | ✅ |
| `R2_ACCESS_KEY_ID` | Access key do R2 | ✅ |
| `R2_SECRET_ACCESS_KEY` | Secret key do R2 | ✅ |
| `R2_BUCKET_NAME` | Nome do bucket (iptvlink-cdn) | ✅ |
| `JWT_SECRET` | Secret para validação JWT no Worker | ✅ |

### SmartOne IPTV

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `SMARTONE_API_URL` | URL base da API SmartOne | ⚠️ |
| `SMARTONE_API_KEY` | Chave de API SmartOne | ⚠️ |
| `SMARTONE_WEBHOOK_SECRET` | Secret para webhooks | ⚠️ |

### MercadoPago

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `MERCADOPAGO_ACCESS_TOKEN` | Token de acesso MP | ⚠️ |
| `MERCADOPAGO_WEBHOOK_SECRET` | Secret para webhooks | ⚠️ |

### Frontend (Vite)

| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do Supabase (público) |
| `VITE_SUPABASE_ANON_KEY` | Anon key (público) |
| `VITE_META_PIXEL_ID` | ID do Meta Pixel |

### Configuração

**Supabase Secrets (Edge Functions):**
```bash
# Via CLI
supabase secrets set WHATSAPP_APPKEY=xxx WHATSAPP_AUTHKEY=xxx

# Via Dashboard
Project Settings > Edge Functions > Secrets
```

**Cloudflare Worker (wrangler.toml):**
```toml
[vars]
SUPABASE_URL = "https://xxx.supabase.co"

[[kv_namespaces]]
binding = "CACHE"
```

---

## 14. Deployment

### Arquitetura de Deploy

```
┌─────────────────────────────────────────────────────────────┐
│                      GitHub Repository                       │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    Lovable      │  │  GitHub Actions │  │    Manual       │
│  (Auto-deploy)  │  │  (CDN Worker)   │  │  (Supabase)     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Frontend      │  │ Cloudflare Edge │  │ Edge Functions  │
│   (Lovable)     │  │    (Worker)     │  │   (Supabase)    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Frontend (Lovable)

1. Push para `main` → Deploy automático
2. Preview em cada PR
3. Rollback via History

### Edge Functions (Supabase)

```bash
# Deploy individual
supabase functions deploy stream-proxy

# Deploy todas
supabase functions deploy

# Listar funções
supabase functions list
```

### CDN Worker (Cloudflare)

**Via GitHub Actions (.github/workflows/deploy-cdn-worker.yml):**
- Trigger: Push em `workers/cdn-router/`
- Secrets necessários: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

**Manual:**
```bash
cd workers/cdn-router
npx wrangler deploy
```

### Database Migrations

```bash
# Criar migration
supabase migration new nome_da_migration

# Aplicar migrations
supabase db push

# Reset (CUIDADO: apaga dados)
supabase db reset
```

### Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Secrets do Supabase atualizados
- [ ] Migrations aplicadas
- [ ] Edge Functions deployadas
- [ ] CDN Worker atualizado
- [ ] Testes de smoke executados
- [ ] Monitoramento ativo

---

## 15. Edge Functions Reference

### stream-proxy

**Descrição:** Proxy de streams com autenticação e cache

```bash
# GET - Stream direto
curl "https://[project].supabase.co/functions/v1/stream-proxy?url=https://example.com/stream.m3u8&clientId=xxx&token=xxx"

# Response: Stream proxiado com headers de cache
```

### fetch-m3u-url

**Descrição:** Importa M3U de URL externa (bypass CORS)

```bash
curl -X POST "https://[project].supabase.co/functions/v1/fetch-m3u-url" \
  -H "Authorization: Bearer [JWT]" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/playlist.m3u"}'

# Response
{
  "success": true,
  "content": "#EXTM3U\n...",
  "size": 1234567,
  "channelCount": 500
}
```

### generate-m3u-file

**Descrição:** Gera arquivo M3U e faz upload para R2

```bash
curl -X POST "https://[project].supabase.co/functions/v1/generate-m3u-file" \
  -H "Authorization: Bearer [JWT]" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "uuid",
    "sourceKey": "source-key",
    "sourceName": "Minha Lista"
  }'

# Response
{
  "success": true,
  "cdnUrl": "https://cdn.example.com/playlists/xxx.m3u",
  "channelCount": 1500,
  "fileSize": 234567
}
```

### generate-m3u-from-sync

**Descrição:** Gera M3U a partir de m3u_sync_entries (server-side, para listas grandes)

```bash
curl -X POST "https://[project].supabase.co/functions/v1/generate-m3u-from-sync" \
  -H "Authorization: Bearer [JWT]" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "uuid",
    "sourceKey": "source-key",
    "sourceName": "Lista Grande"
  }'

# Response
{
  "success": true,
  "cdnUrl": "https://cdn.example.com/...",
  "totalEntries": 209568
}
```

### send-whatsapp

**Descrição:** Envia mensagem WhatsApp via BotBot API

```bash
curl -X POST "https://[project].supabase.co/functions/v1/send-whatsapp" \
  -H "Authorization: Bearer [JWT]" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511999999999",
    "message": "Olá, sua assinatura vence em 3 dias!",
    "templateId": "expiration_reminder"
  }'

# Response
{
  "success": true,
  "messageId": "msg_xxx",
  "status": "sent"
}
```

### create-admin-user

**Descrição:** Cria usuário admin (requer role master)

```bash
curl -X POST "https://[project].supabase.co/functions/v1/create-admin-user" \
  -H "Authorization: Bearer [JWT_MASTER]" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "novo@admin.com",
    "password": "senhaSegura123",
    "name": "Novo Admin",
    "role": "admin"
  }'

# Response
{
  "success": true,
  "userId": "uuid",
  "email": "novo@admin.com"
}
```

### cdn-prewarm

**Descrição:** Pré-aquece cache do CDN para conteúdo popular

```bash
curl -X POST "https://[project].supabase.co/functions/v1/cdn-prewarm" \
  -H "Authorization: Bearer [JWT]" \
  -H "Content-Type: application/json" \
  -d '{
    "r2Keys": ["content/video1.mp4", "content/video2.mp4"],
    "priority": "high"
  }'

# Response
{
  "success": true,
  "jobId": "job_xxx",
  "status": "queued"
}
```

### cache-invalidate

**Descrição:** Invalida cache do CDN

```bash
curl -X POST "https://[project].supabase.co/functions/v1/cache-invalidate" \
  -H "Authorization: Bearer [JWT]" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "pattern",
    "pattern": "playlists/*",
    "scope": "global"
  }'

# Response
{
  "success": true,
  "invalidatedKeys": 45,
  "duration": 234
}
```

---

## 16. Backup e Disaster Recovery

### Estratégia de Backup

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKUP STRATEGY                           │
├─────────────────────────────────────────────────────────────┤
│  Database (PostgreSQL)                                       │
│  └─ Supabase: Point-in-time recovery (7 dias)               │
│  └─ Daily: pg_dump automático                               │
│                                                              │
│  Storage (R2)                                                │
│  └─ Versionamento habilitado                                │
│  └─ Cross-region replication                                │
│                                                              │
│  Código                                                      │
│  └─ GitHub: Branches protegidas                             │
│  └─ Tags para releases                                      │
└─────────────────────────────────────────────────────────────┘
```

### RPO/RTO

| Componente | RPO | RTO |
|------------|-----|-----|
| Database | 5 min | 1 hora |
| Storage (R2) | 0 (versioning) | 15 min |
| Edge Functions | 0 (Git) | 5 min |
| CDN Worker | 0 (Git) | 5 min |

### Procedimentos de Recovery

#### Database Restore (Supabase)

```sql
-- Via Dashboard: Project Settings > Database > Backups > Restore

-- Manual: Restaurar de pg_dump
psql -h [host] -U postgres -d postgres < backup.sql
```

#### R2 Object Recovery

```bash
# Listar versões de um objeto
aws s3api list-object-versions \
  --bucket iptvlink-cdn \
  --prefix "playlists/xxx.m3u"

# Restaurar versão específica
aws s3api copy-object \
  --bucket iptvlink-cdn \
  --copy-source "iptvlink-cdn/playlists/xxx.m3u?versionId=xxx" \
  --key "playlists/xxx.m3u"
```

#### Rollback de Edge Functions

```bash
# Listar deploys anteriores
supabase functions list --project-ref xxx

# Redeploy de versão anterior (via Git)
git checkout [commit-hash] -- supabase/functions/[function-name]
supabase functions deploy [function-name]
```

### Disaster Recovery Checklist

**P0 - Database Down:**
1. Verificar status no Dashboard Supabase
2. Iniciar restore do último backup
3. Notificar equipe via WhatsApp
4. Ativar página de manutenção

**P1 - CDN Down:**
1. Verificar status Cloudflare
2. Ativar fallback para origin direto
3. Invalidar cache corrompido

**P2 - Edge Functions Down:**
1. Verificar logs de erro
2. Rollback para versão anterior
3. Escalar se necessário

### Contatos de Emergência

| Serviço | Suporte |
|---------|---------|
| Supabase | support@supabase.io |
| Cloudflare | Enterprise Dashboard |
| BotBot (WhatsApp) | suporte@botbot.com |

---

## 17. Changelog

### v1.1.0 (2025-12-05)
- ✅ Consolidação completa da documentação
- ✅ Adição de seções: Troubleshooting, Environment Variables, Deployment
- ✅ Adição de seções: Edge Functions Reference, Backup/DR, API Reference
- ✅ Remoção de 35 arquivos .md duplicados/obsoletos

### v1.0.0 (2025-12-01)
- ✅ Sistema de três níveis de roles (client/admin/master)
- ✅ Tabela `profiles` como single source of truth
- ✅ Player otimizado para Smart TVs
- ✅ Sistema de notificações WhatsApp
- ✅ CDN híbrido (R2 + Cloudflare Stream)
- ✅ Sistema de cache inteligente
- ✅ Pipeline de transcode enterprise
- ✅ MercadoPago integração

### Roadmap

| Feature | Status | ETA |
|---------|--------|-----|
| Multi-tenancy | 🔄 Planejado | Q1 2026 |
| App Store Publication | 🔄 Planejado | Q1 2026 |
| Analytics Avançado | 🔄 Planejado | Q2 2026 |
| AI Recommendations | 🔄 Planejado | Q2 2026 |

---

## 18. API Reference

### Autenticação

Todas as APIs requerem autenticação via JWT (exceto webhooks públicos).

**Header:**
```
Authorization: Bearer [JWT_TOKEN]
```

**Obter JWT:**
```javascript
const { data: { session } } = await supabase.auth.getSession()
const jwt = session?.access_token
```

### Endpoints Base

| Ambiente | URL |
|----------|-----|
| Edge Functions | `https://[project].supabase.co/functions/v1/` |
| REST API | `https://[project].supabase.co/rest/v1/` |
| Auth | `https://[project].supabase.co/auth/v1/` |
| Storage | `https://[project].supabase.co/storage/v1/` |

### REST API (Supabase PostgREST)

#### Profiles

```bash
# Listar profiles (admin)
GET /rest/v1/profiles?select=*&order=created_at.desc

# Buscar profile por ID
GET /rest/v1/profiles?id=eq.[uuid]

# Atualizar profile
PATCH /rest/v1/profiles?id=eq.[uuid]
Content-Type: application/json
{"nome": "Novo Nome", "plano": "anual"}

# Buscar por telefone
GET /rest/v1/profiles?contact_phone=eq.5511999999999
```

#### User Roles

```bash
# Listar roles de um usuário
GET /rest/v1/user_roles?user_id=eq.[uuid]

# Adicionar role
POST /rest/v1/user_roles
{"user_id": "uuid", "role": "admin"}

# Remover role
DELETE /rest/v1/user_roles?user_id=eq.[uuid]&role=eq.admin
```

#### M3U Sync

```bash
# Listar fontes de sync
GET /rest/v1/m3u_sync_sources?select=*

# Buscar entradas de uma fonte
GET /rest/v1/m3u_sync_entries?source_id=eq.[uuid]&limit=1000

# Contagem total
GET /rest/v1/m3u_sync_entries?source_id=eq.[uuid]&select=count
Prefer: count=exact
```

### Códigos de Resposta

| Código | Significado |
|--------|-------------|
| 200 | Sucesso |
| 201 | Criado |
| 400 | Bad Request (validação) |
| 401 | Não autenticado |
| 403 | Não autorizado (RLS) |
| 404 | Não encontrado |
| 429 | Rate limit |
| 500 | Erro interno |

### Rate Limits

Ver seção [10. Rate Limiting](#10-rate-limiting).

### Webhooks

#### WhatsApp Webhook

```
POST /functions/v1/whatsapp-webhook
Content-Type: application/json
x-webhook-signature: [HMAC-SHA256]

{
  "event": "message_read",
  "messageId": "msg_xxx",
  "timestamp": "2025-12-05T10:00:00Z"
}
```

#### SmartOne Webhook

```
POST /functions/v1/smartone-webhook
Content-Type: application/json
x-webhook-signature: [HMAC-SHA256]

{
  "event": "playlist_updated",
  "playlistId": "xxx",
  "timestamp": "2025-12-05T10:00:00Z"
}
```

### SDKs

**JavaScript (Frontend):**
```javascript
import { supabase } from '@/integrations/supabase/client'

// Query
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('situacao', 'Ativo')

// Edge Function
const { data, error } = await supabase.functions.invoke('send-whatsapp', {
  body: { phone: '5511999999999', message: 'Olá!' }
})
```

---

## Referências

- [Supabase Docs](https://supabase.com/docs)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare Stream](https://developers.cloudflare.com/stream/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [HLS.js](https://github.com/video-dev/hls.js)
- [Capacitor](https://capacitorjs.com/docs)
- [PostgREST](https://postgrest.org/en/stable/)

---

*Documento consolidado de múltiplas fontes de documentação do projeto IPTVLINK.*
*Versão 1.1 - Atualizado em 2025-12-05*
