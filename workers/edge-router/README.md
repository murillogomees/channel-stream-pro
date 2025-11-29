# Stream Edge Router - Cloudflare Worker

Roteador de streaming inteligente que direciona requisições baseado no Policy Engine.

## Funcionalidades

- **Roteamento por política**: VOD → Cloudflare Stream, Live → Origin direto
- **URLs assinadas**: Tokens HMAC-SHA256 para VODs seguros
- **Cache em memória**: Decisões de roteamento com TTL de 60s
- **Health check**: Fallback automático se Stream estiver indisponível
- **Métricas**: Registra acessos para análise

## Endpoints

| Endpoint | Descrição |
|----------|-----------|
| `/play/:channelId` | Redireciona para melhor fonte baseado em política |
| `/manifest/:channelId` | Alias para `/play` |
| `/stream/:cfStreamUid` | Proxy direto para Cloudflare Stream |
| `/health` | Status do worker |
| `/metrics` | Métricas básicas |

## Deploy

### 1. Instalar Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. Configurar Secrets

```bash
wrangler secret put SUPABASE_URL_VAR
wrangler secret put SUPABASE_ANON_KEY_VAR
wrangler secret put CF_ACCOUNT_ID
wrangler secret put CF_STREAM_SIGNING_KEY  # Opcional
```

### 3. Deploy

```bash
# Development
wrangler deploy --env dev

# Production
wrangler deploy --env production
```

### 4. Configurar Rota (opcional)

No `wrangler.toml`, descomente e ajuste as rotas:

```toml
routes = [
  { pattern = "stream.seudominio.com/*", zone_name = "seudominio.com" }
]
```

## Uso no Player

```javascript
// Em vez de usar a URL direta do canal
const channelId = 'uuid-do-canal';

// Use o edge router
const streamUrl = `https://stream-edge-router.workers.dev/play/${channelId}`;

// O worker vai redirecionar para:
// - Cloudflare Stream (se VOD com signed URL)
// - Origin R2 (se live ou fallback)
// - Origin direto (se nenhum dos anteriores)
```

## Fluxo de Decisão

```
Request → Cache Check → Policy Engine (Supabase)
                              ↓
                   ┌─────────────────────┐
                   │ Routing Decision    │
                   └─────────────────────┘
                              ↓
         ┌────────────────────┼────────────────────┐
         ↓                    ↓                    ↓
   USE_STREAM           USE_ORIGIN         STREAM_ON_DEMAND
         ↓                    ↓                    ↓
   CF Stream URL         R2/Origin URL      Origin + Trigger
   (signed)              (cached)           Transcode Job
```

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `SUPABASE_URL_VAR` | Sim | URL do projeto Supabase |
| `SUPABASE_ANON_KEY_VAR` | Sim | Chave anônima do Supabase |
| `CF_ACCOUNT_ID` | Sim | ID da conta Cloudflare |
| `CF_STREAM_SIGNING_KEY` | Não | Chave para assinar URLs |

## Monitoramento

Acesse `/health` para verificar status:

```json
{
  "status": "ok",
  "streamHealthy": true,
  "lastHealthCheck": "2024-01-15T10:30:00Z",
  "cacheSize": 42
}
```

## Troubleshooting

### Worker não encontra canal
- Verifique se o UUID está correto
- Confirme que o canal existe no Supabase

### URLs não estão assinadas
- Verifique se `CF_STREAM_SIGNING_KEY` está configurado
- O secret deve ser o mesmo usado no Cloudflare Stream

### Fallback constante para origin
- Verifique `/health` - se `streamHealthy: false`, há problema na conectividade com CF Stream
- Verifique logs do worker em `wrangler tail`
