# M3U Sync System - Runbook

## Visão Geral

Sistema de sincronização automática de playlists M3U/M3U8 usando Supabase Edge Functions + Storage.

## Arquitetura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Admin Dashboard │────▶│  m3u-sync        │────▶│  Supabase DB    │
│  /admin/m3u-sync │     │  Edge Function   │     │  m3u_sync_*     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌──────────────────┐
                        │  External M3U    │
                        │  URLs            │
                        └──────────────────┘
```

## Componentes

### Edge Functions

| Função | Descrição | Endpoint |
|--------|-----------|----------|
| `m3u-sync` | Sincronização principal, API REST | `/functions/v1/m3u-sync` |
| `m3u-playlist` | Serve playlists (.m3u, .json, .gz) | `/functions/v1/m3u-playlist` |
| `m3u-cron-sync` | Trigger para CRON jobs | `/functions/v1/m3u-cron-sync` |

### Tabelas do Banco de Dados

| Tabela | Descrição |
|--------|-----------|
| `m3u_sync_sources` | Fontes M3U configuradas |
| `m3u_sync_jobs` | Histórico de jobs de sincronização |
| `m3u_sync_entries` | Entradas de canais sincronizados |
| `m3u_sync_files` | Arquivos gerados (.m3u, .json) |
| `m3u_sync_errors` | Log de erros |

### Funções SQL

- `get_m3u_sync_stats()` - Estatísticas gerais
- `search_m3u_entries()` - Busca em entradas
- `cleanup_old_m3u_sync_data()` - Limpeza de dados antigos

## Endpoints da API

### GET /health
Status do sistema.

```bash
curl https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/m3u-sync/health
```

### GET /sources
Lista todas as fontes configuradas.

```bash
curl https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/m3u-sync/sources
```

### POST /source
Cria nova fonte.

```bash
curl -X POST https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/m3u-sync/source \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Minha Playlist",
    "key": "minha-playlist",
    "url": "https://example.com/playlist.m3u",
    "sync_interval_minutes": 60
  }'
```

### POST /sync
Inicia sincronização.

```bash
# Todas as fontes
curl -X POST https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/m3u-sync/sync

# Fonte específica
curl -X POST https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/m3u-sync/sync \
  -H "Content-Type: application/json" \
  -d '{"source_key": "minha-playlist"}'
```

### GET /source/:key
Detalhes de uma fonte.

```bash
curl https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/m3u-sync/source/minha-playlist
```

### GET /search?q=
Busca em entradas.

```bash
curl "https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/m3u-sync/search?q=globo&limit=50"
```

## Servindo Playlists

### M3U Raw
```
https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/m3u-playlist/minha-playlist.m3u
```

### M3U Gzip
```
https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/m3u-playlist/minha-playlist.m3u.gz
```

### JSON Index
```
https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/m3u-playlist/minha-playlist.json
```

## Configuração do CRON

### Habilitar Extensões (executar uma vez)

```sql
-- Habilitar pg_cron e pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Criar CRON Job

```sql
-- Sincronização a cada 30 minutos
SELECT cron.schedule(
  'm3u-sync-cron',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/m3u-cron-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak"}'::jsonb,
    body := concat('{"triggered_at": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);
```

### Verificar CRON Jobs

```sql
SELECT * FROM cron.job ORDER BY jobid DESC;
```

### Remover CRON Job

```sql
SELECT cron.unschedule('m3u-sync-cron');
```

### Verificar Histórico de Execuções

```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

## Troubleshooting

### Problema: Sync não está executando

1. Verificar se a fonte está habilitada:
```sql
SELECT * FROM m3u_sync_sources WHERE enabled = true;
```

2. Verificar logs do edge function:
   - Acessar: https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/functions/m3u-sync/logs

3. Verificar últimos jobs:
```sql
SELECT * FROM m3u_sync_jobs 
ORDER BY started_at DESC 
LIMIT 10;
```

### Problema: Entradas inválidas

1. Verificar erros:
```sql
SELECT * FROM m3u_sync_errors 
ORDER BY created_at DESC 
LIMIT 20;
```

2. Verificar entradas marcadas como inválidas:
```sql
SELECT source_id, COUNT(*) as invalid_count 
FROM m3u_sync_entries 
WHERE is_valid = false 
GROUP BY source_id;
```

### Problema: Timeout no fetch

1. Aumentar timeout na fonte:
```sql
UPDATE m3u_sync_sources 
SET timeout_seconds = 60 
WHERE key = 'minha-playlist';
```

### Limpeza de Dados Antigos

```sql
SELECT cleanup_old_m3u_sync_data();
```

## Monitoramento

### Dashboard Admin
Acessar: `/admin/m3u-sync`

### Estatísticas via SQL
```sql
SELECT * FROM get_m3u_sync_stats();
```

### Métricas Importantes

| Métrica | Query |
|---------|-------|
| Total de fontes | `SELECT COUNT(*) FROM m3u_sync_sources` |
| Fontes ativas | `SELECT COUNT(*) FROM m3u_sync_sources WHERE enabled = true` |
| Total de entradas | `SELECT COUNT(*) FROM m3u_sync_entries WHERE is_valid = true` |
| Jobs nas últimas 24h | `SELECT COUNT(*) FROM m3u_sync_jobs WHERE started_at > now() - interval '24 hours'` |
| Taxa de sucesso | `SELECT COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) FROM m3u_sync_jobs` |

## Secrets Necessários

Nenhum secret adicional é necessário para o funcionamento básico. Os secrets padrão do Supabase já estão disponíveis:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Links Úteis

- [Edge Function Logs - m3u-sync](https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/functions/m3u-sync/logs)
- [Edge Function Logs - m3u-playlist](https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/functions/m3u-playlist/logs)
- [Edge Function Logs - m3u-cron-sync](https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/functions/m3u-cron-sync/logs)
- [SQL Editor](https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/sql/new)
