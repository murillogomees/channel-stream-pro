# IPTVLINK - Documentação Técnica Consolidada

> Versão: 1.0 | Última atualização: 2025-12-05

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

## Referências

- [Supabase Docs](https://supabase.com/docs)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare Stream](https://developers.cloudflare.com/stream/)
- [HLS.js](https://github.com/video-dev/hls.js)
- [Capacitor](https://capacitorjs.com/docs)

---

*Documento consolidado de múltiplas fontes de documentação do projeto IPTVLINK.*
