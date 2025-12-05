# M3U Ingest Stream-Safe System - Runbook

## Overview

Sistema de ingest M3U stream-safe que transfere playlists de origens externas para Cloudflare R2 sem buffering em memória.

### Arquitetura

```
┌─────────────┐     ┌──────────────────┐     ┌────────────┐
│   Frontend  │────▶│  m3u-ingest EF   │────▶│  R2 CDN    │
│  (React)    │     │  (Orchestrator)  │     │            │
└─────────────┘     └──────────────────┘     └────────────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │ ingest-m3u-proxy │
                    │ (CF Worker)      │
                    └──────────────────┘
```

### Componentes

| Componente | Localização | Função |
|------------|-------------|--------|
| `m3u-ingest` | `supabase/functions/m3u-ingest/` | Orquestrador principal com retry e fallback |
| `r2-signed-upload` | `supabase/functions/r2-signed-upload/` | Gerador de URLs assinadas |
| `ingest-m3u-proxy` | `workers/ingest-m3u-proxy/` | Worker CF para streaming direto |
| `useM3UIngest` | `src/hooks/useM3UIngest.ts` | Hook React para UI |
| `IngestMetricsDashboard` | `src/components/admin/m3u/` | Dashboard de métricas |

---

## Fluxos de Ingest

### 1. Streaming Direto (Preferido)
```
Origin URL → m3u-ingest → fetch() → buffer chunks → R2.put()
```
- **Quando:** Arquivos < 50MB, origem rápida
- **Limite:** 80s antes de fallback

### 2. Signed URL (Fallback)
```
Origin URL → r2-signed-upload → Presigned URL → PUT direto ao R2
```
- **Quando:** Timeout detectado, origem lenta
- **TTL:** 15 minutos

### 3. Worker Proxy (Alternativo)
```
Origin URL → ingest-m3u-proxy Worker → originResponse.body → R2.put()
```
- **Quando:** Zero-buffer necessário
- **Vantagem:** Streaming verdadeiro sem buffering

---

## Configuração

### Secrets Necessários (Supabase)

```bash
# R2 Cloudflare
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=iptvlink-cdn
R2_CDN_BASE_URL=https://cdn.iptvlink.app

# Interno (opcional)
INTERNAL_SERVICE_TOKEN=your_service_token
```

### Worker (Cloudflare)

```bash
# Deploy do Worker
cd workers/ingest-m3u-proxy
wrangler deploy

# Secrets do Worker
wrangler secret put SERVICE_BASE
wrangler secret put SERVICE_TOKEN
```

---

## Operações

### Iniciar Ingest via API

```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/m3u-ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{
    "originUrl": "http://example.com/playlist.m3u",
    "sourceId": "source-123",
    "forceSignedUrl": false
  }'
```

### Verificar Status do Job

```sql
SELECT * FROM m3u_ingest_jobs 
WHERE object_key = 'your-object-key';
```

### Consultar Métricas

```sql
SELECT * FROM vw_ingest_metrics_summary 
ORDER BY hour DESC 
LIMIT 24;
```

---

## Troubleshooting

### Erro: "Origin fetch failed"

**Causa:** URL de origem inacessível ou timeout

**Solução:**
1. Verificar se a URL está acessível:
   ```bash
   curl -I "http://origin.example/playlist.m3u"
   ```
2. Verificar headers esperados:
   ```bash
   curl -H "User-Agent: M3U-Ingest/1.0" "http://origin.example/playlist.m3u" | head
   ```
3. Tentar com `forceSignedUrl: true`

### Erro: "R2 configuration missing"

**Causa:** Secrets R2 não configurados

**Solução:**
1. Verificar secrets no Supabase Dashboard
2. Garantir que `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` estão definidos

### Erro: "Time limit approaching"

**Causa:** Arquivo muito grande ou conexão lenta

**Solução:**
1. O sistema fará fallback automático para signed URL
2. Se persistir, usar `forceSignedUrl: true` diretamente

### Erro: "Worker timeout"

**Causa:** Worker CF atingiu limite de 100s

**Solução:**
1. Verificar tamanho do arquivo de origem
2. Usar endpoint m3u-ingest ao invés do Worker direto
3. Considerar chunking manual para arquivos > 500MB

---

## Métricas e Alertas

### Métricas Coletadas

| Métrica | Descrição |
|---------|-----------|
| `total_requests` | Total de requisições de ingest |
| `successful` | Ingests bem-sucedidos |
| `failed` | Ingests falhados |
| `avg_bytes` | Bytes médios por ingest |
| `avg_duration_ms` | Duração média em ms |
| `stream_count` | Ingests via streaming |
| `signed_url_count` | Ingests via signed URL |
| `fallback_count` | Ingests com fallback |

### Alertas Recomendados

```sql
-- Taxa de erro > 5%
SELECT 
  COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / COUNT(*) as error_rate
FROM m3u_ingest_metrics
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Duração média > 60s
SELECT AVG(duration_ms) as avg_duration
FROM m3u_ingest_metrics
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Rollback

### Cenário: Bug no m3u-ingest

1. **Reverter Edge Function:**
   ```bash
   # No Supabase Dashboard, reverter para versão anterior
   # Ou redeployar código anterior
   supabase functions deploy m3u-ingest
   ```

2. **Desabilitar temporariamente:**
   ```sql
   -- Marcar jobs pendentes como falhos
   UPDATE m3u_ingest_jobs 
   SET status = 'failed', error_message = 'Rollback manual'
   WHERE status = 'pending';
   ```

### Cenário: Worker CF com problemas

1. **Rollback no Cloudflare:**
   ```bash
   cd workers/ingest-m3u-proxy
   wrangler rollback
   ```

2. **Forçar fallback:**
   - Todos os ingests usarão `forceSignedUrl: true` automaticamente se Worker falhar

### Cenário: R2 inacessível

1. **Verificar status:**
   ```bash
   curl https://cdn.iptvlink.app/_health
   ```

2. **Failover:**
   - Sistema não tem failover automático de storage
   - Aguardar restauração do R2

---

## Testes

### Teste de Ingest Pequeno

```bash
# Arquivo < 1MB
curl -X POST \
  https://your-project.supabase.co/functions/v1/m3u-ingest \
  -H "Content-Type: application/json" \
  -d '{"originUrl": "https://example.com/small.m3u"}'
```

### Teste de Ingest Grande

```bash
# Arquivo > 50MB com signed URL
curl -X POST \
  https://your-project.supabase.co/functions/v1/m3u-ingest \
  -H "Content-Type: application/json" \
  -d '{"originUrl": "https://example.com/large.m3u", "forceSignedUrl": true}'
```

### Teste de Fallback

```bash
# Simular origem lenta (timeout esperado)
curl -X POST \
  https://your-project.supabase.co/functions/v1/m3u-ingest \
  -H "Content-Type: application/json" \
  -d '{"originUrl": "http://slow-server.example/playlist.m3u"}'
```

---

## Manutenção

### Limpeza de Métricas Antigas

```sql
-- Executar mensalmente
SELECT cleanup_old_ingest_metrics(30);
```

### Limpeza de Jobs Antigos

```sql
DELETE FROM m3u_ingest_jobs 
WHERE created_at < NOW() - INTERVAL '90 days'
AND status IN ('finished', 'failed');
```

### Verificação de Saúde

```sql
-- Resumo das últimas 24h
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'finished') as success,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  AVG(duration_ms)::int as avg_ms
FROM m3u_ingest_jobs
WHERE created_at > NOW() - INTERVAL '24 hours';
```

---

## Changelog

### v1.0.0 (2024-12-05)
- Implementação inicial do sistema stream-safe
- Edge Functions: m3u-ingest, r2-signed-upload
- Worker: ingest-m3u-proxy
- Dashboard de métricas
- Hook React useM3UIngest
