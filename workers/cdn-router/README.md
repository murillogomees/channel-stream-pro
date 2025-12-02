# IPTVLINK CDN Router - Cloudflare Worker

Cloudflare Worker que atua como edge router para o CDN, gerenciando:
- Validação JWT em requisições de manifest
- Normalização de cache-key (remoção de JWT em segments)
- Rate limiting por IP
- Verificação de referrer
- Headers de segurança (CORS, CSP)

## Arquitetura

```
Cliente → Cloudflare Worker → R2 Storage
          ↓
          Validação JWT
          Rate Limiting
          Referrer Check
          Cache Normalization
```

## Pré-requisitos

1. Conta Cloudflare com Workers habilitado
2. R2 Storage habilitado
3. Wrangler CLI instalado: `npm install -g wrangler`
4. Autenticação configurada: `wrangler login`

## Deploy

### 1. Criar R2 Bucket

```bash
# Produção
wrangler r2 bucket create iptvlink-cdn

# Staging
wrangler r2 bucket create iptvlink-cdn-staging

# Preview
wrangler r2 bucket create iptvlink-cdn-preview
```

### 2. Configurar Secrets

```bash
# JWT Secret (mesmo valor do STREAM_PROXY_SECRET no Supabase)
wrangler secret put JWT_SECRET --env production
# Cole o valor do secret quando solicitado

# Supabase URL
wrangler secret put SUPABASE_URL --env production
# Exemplo: https://seu-projeto.supabase.co

# Supabase Anon Key
wrangler secret put SUPABASE_ANON_KEY --env production
# Cole a anon key do projeto
```

### 3. Deploy do Worker

```bash
# Staging
wrangler deploy --env staging

# Production
wrangler deploy --env production
```

### 4. Configurar Custom Domain (Opcional)

No dashboard do Cloudflare:
1. Workers & Pages → iptvlink-cdn-router-production
2. Settings → Domains & Routes
3. Add Custom Domain: `cdn.iptvlink.com`

## Configuração de Variáveis

### wrangler.toml

Edite as variáveis conforme necessário:

```toml
[vars]
ALLOWED_REFERRERS = "iptvlink.com,app.iptvlink.com"
```

### Secrets (via CLI)

Nunca commite secrets no código. Use sempre `wrangler secret put`:

| Secret | Descrição | Exemplo |
|--------|-----------|---------|
| `JWT_SECRET` | Chave de assinatura JWT | `your-256-bit-secret` |
| `SUPABASE_URL` | URL do projeto Supabase | `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | Anon key do Supabase | `eyJhbG...` |

## Testando Localmente

```bash
# Inicie servidor de desenvolvimento
wrangler dev

# Teste manifest request (requer JWT válido)
curl "http://localhost:8787/vod/channel123/manifest.m3u8?jwt=YOUR_JWT_TOKEN"

# Teste segment request (JWT opcional, é normalizado)
curl "http://localhost:8787/vod/channel123/segment001.ts"
```

## Funcionamento

### 1. Manifest Requests (.m3u8)

- **Requer JWT válido** na query string `?jwt=TOKEN`
- Valida assinatura HMAC-SHA256
- Verifica expiração do token
- Verifica restrição de IP (se especificada no token)
- Cache: `max-age=30s, stale-while-revalidate=60s`

### 2. Segment Requests (.ts, .m4s, .mp4)

- **JWT opcional** (é removido para normalizar cache)
- Cache compartilhado entre todos os usuários válidos
- Cache: `max-age=86400s` (24 horas)
- Segments só são acessíveis se manifest foi validado

### 3. Rate Limiting

- **100 requisições/minuto** por IP
- **100 MB/minuto** de bandwidth por IP
- Resposta 429 se excedido
- Header `Retry-After: 60` incluído

### 4. Referrer Check

Valida se requisição vem de domínio permitido:
- `iptvlink.com`
- `localhost` (dev)
- `127.0.0.1` (dev)

Configurável via `ALLOWED_REFERRERS` no wrangler.toml.

## Monitoramento

### Logs em Tempo Real

```bash
# Ver logs do worker em produção
wrangler tail --env production

# Filtrar apenas erros
wrangler tail --env production --status error
```

### Métricas no Dashboard

Cloudflare Dashboard → Workers & Pages → iptvlink-cdn-router-production → Metrics

Métricas disponíveis:
- Requests per second
- Success rate (2xx, 4xx, 5xx)
- CPU time
- Duration

## Troubleshooting

### Erro 401: Unauthorized

**Causa**: JWT inválido ou expirado
**Solução**: Verificar que JWT está sendo gerado corretamente no backend e tem o mesmo `JWT_SECRET`

### Erro 403: Forbidden

**Causa**: Referrer inválido ou IP restrito
**Solução**: Adicionar domínio em `ALLOWED_REFERRERS` ou verificar restrição de IP no token

### Erro 404: Not Found

**Causa**: Arquivo não existe no R2
**Solução**: Verificar que arquivo foi uploaded para o bucket correto

### Erro 429: Rate Limit

**Causa**: Muitas requisições do mesmo IP
**Solução**: Implementar retry com backoff no cliente ou aumentar limite

### Erro 500: Internal Error

**Causa**: `JWT_SECRET` não configurado ou erro no R2
**Solução**: Verificar secrets com `wrangler secret list --env production`

## Otimizações

### Cache Strategy

```javascript
// Manifests: curto TTL, permite stale
Cache-Control: public, max-age=30, stale-while-revalidate=60

// Segments: longo TTL, imutável
Cache-Control: public, max-age=86400, immutable

// Vary by encoding
Vary: Accept-Encoding
```

### Compression

Cloudflare automaticamente aplica Brotli/Gzip se cliente suportar.

### CDN Cache vs Worker Cache

- **CDN Cache** (Cloudflare): Automático para GET requests
- **Worker Cache** (caches.default): Normaliza cache-key removendo JWT

## Segurança

✅ **Implementado**:
- HMAC-SHA256 JWT validation
- IP-based rate limiting
- Referrer validation
- CORS headers
- CSP headers
- Cache key normalization

⚠️ **Próximos Passos**:
- DDoS protection via Cloudflare
- Bot management
- Geographic restrictions
- Advanced rate limiting (KV/Durable Objects)

## Custas

### Workers

- **Grátis**: 100.000 req/dia
- **Paid ($5/mês)**: 10M req/mês + $0.50/milhão extra

### R2 Storage

- **Grátis**: 10 GB storage
- **Storage**: $0.015/GB-mês
- **Class A Operations**: $4.50/milhão (PUT, LIST)
- **Class B Operations**: $0.36/milhão (GET, HEAD)
- **Egress**: **GRÁTIS** (principal vantagem vs S3)

## Referências

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [R2 Storage Docs](https://developers.cloudflare.com/r2/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [JWT Validation Best Practices](https://developers.cloudflare.com/workers/examples/signing-requests/)
