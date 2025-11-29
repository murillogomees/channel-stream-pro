# Playbook: Controle de Custos de Streaming

## Estrutura de Custos

### Cloudflare Stream
| Item | Custo | Unidade |
|------|-------|---------|
| Storage | $5.00 | por 1000 min armazenados/mês |
| Encoding | Incluído | - |
| Delivery | $1.00 | por 1000 min assistidos |

### Cloudflare R2
| Item | Custo | Unidade |
|------|-------|---------|
| Storage | $0.015 | por GB/mês |
| Class A ops (PUT) | $4.50 | por milhão |
| Class B ops (GET) | $0.36 | por milhão |
| Egress | Grátis | - |

### Workers
| Item | Custo | Unidade |
|------|-------|---------|
| Requests | Grátis | primeiros 100k/dia |
| Requests | $0.50 | por milhão após |
| CPU time | Grátis | primeiros 10ms |

---

## Alertas de Custo

### Configurar Alertas no Cloudflare

1. Acesse **Cloudflare Dashboard > Billing**
2. Configure alertas para:
   - Stream minutes stored > 50,000
   - Stream minutes delivered > 100,000
   - R2 storage > 100 GB
   - Worker requests > 10M/mês

### Query para Estimar Custos (Supabase)

```sql
-- Estimativa de custo mensal do Stream
SELECT 
  (total_duration_hours * 60 / 1000) * 5 as storage_cost_usd,
  (total_duration_hours * 60 * 10 / 1000) * 1 as delivery_cost_estimate_usd
FROM get_cf_stream_statistics();
```

---

## Estratégias de Otimização

### 1. Priorizar Stream On-Demand

Para conteúdo com baixa audiência, use `STREAM_ON_DEMAND`:

```sql
-- VODs com menos de 100 views não pré-transcodificam
UPDATE streaming_policies 
SET strategy = 'STREAM_ON_DEMAND',
    conditions = '{"min_views_for_transcode": 100}'
WHERE content_type = 'vod' AND priority < 50;
```

### 2. Limitar Upload para Stream

```sql
-- Apenas VODs populares vão para Stream
-- Outros ficam só no R2
UPDATE m3u_channels 
SET cf_stream_uid = NULL 
WHERE is_vod = true 
  AND id NOT IN (
    SELECT channel_id FROM channel_usage_stats 
    WHERE view_count > 50
  );
```

### 3. Cache Agressivo no Edge

No `wrangler.toml`:
```toml
[vars]
CACHE_TTL = "300000"  # 5 minutos
```

Manifests podem ser cacheados por mais tempo:
```javascript
// No edge router
newHeaders.set('Cache-Control', 'public, max-age=300'); // 5 min
```

### 4. Deletar Conteúdo Antigo

```sql
-- Identificar VODs não assistidos há 90+ dias
SELECT c.id, c.name, c.cf_stream_uid
FROM m3u_channels c
LEFT JOIN channel_usage_stats s ON c.id = s.channel_id
WHERE c.is_vod = true 
  AND c.cf_stream_uid IS NOT NULL
  AND (s.last_watched_at IS NULL OR s.last_watched_at < now() - interval '90 days');

-- Marcar para remoção do Stream (mantenha no R2)
-- Executar manualmente via API do Cloudflare
```

---

## Monitoramento de Custos

### Dashboard Query (executar mensalmente)

```sql
-- Resumo de uso
SELECT 
  (SELECT COUNT(*) FROM m3u_channels WHERE cf_stream_uid IS NOT NULL) as vods_on_stream,
  (SELECT SUM(cf_stream_duration_seconds)/3600 FROM m3u_channels WHERE cf_stream_uid IS NOT NULL) as total_hours,
  (SELECT SUM(cf_stream_size_bytes)/1073741824 FROM m3u_channels WHERE cf_stream_uid IS NOT NULL) as total_gb,
  (SELECT COUNT(*) FROM streaming_metrics WHERE metric_type = 'request' AND recorded_at > now() - interval '30 days') as requests_30d;
```

### Estimativa Mensal

```
Storage (Stream): {total_hours} × 60 min × $5/1000 = $X
Delivery (estimado 10x): {total_hours} × 60 × 10 × $1/1000 = $Y
R2 Storage: {total_gb} × $0.015 = $Z
---
Total Estimado: $X + $Y + $Z
```

---

## Ações de Emergência (Cost Spike)

Se custos aumentarem inesperadamente:

1. **Identificar causa**
   ```sql
   SELECT metric_type, COUNT(*), SUM(value)
   FROM streaming_metrics 
   WHERE recorded_at > now() - interval '24 hours'
   GROUP BY metric_type;
   ```

2. **Forçar origin para todo conteúdo**
   ```sql
   UPDATE streaming_policies SET strategy = 'USE_ORIGIN';
   ```

3. **Pausar uploads para Stream**
   ```sql
   UPDATE cf_stream_uploads SET status = 'paused' WHERE status = 'queued';
   ```

4. **Revisar e limpar conteúdo não utilizado**

---

## Budget Guardrails (Implementação Futura)

```javascript
// No edge router - exemplo de implementação
async function checkBudget() {
  const monthlyForecast = await getMonthlyForecast();
  const budgetThreshold = 500; // USD
  
  if (monthlyForecast > budgetThreshold) {
    // Força STREAM_ON_DEMAND para novos conteúdos
    console.log('[Budget] Threshold exceeded, switching to on-demand');
    return 'STREAM_ON_DEMAND';
  }
  return null;
}
```
