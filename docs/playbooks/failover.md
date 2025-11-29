# Playbook: Failover de Streaming

## Cenários de Failover

### 1. Cloudflare Stream Indisponível

**Sintomas:**
- Taxa de erro > 5% em requisições para Stream
- Timeout em chamadas de API
- Player reportando erros de manifest

**Ações Automáticas:**
1. Edge Router detecta `streamHealthy: false`
2. Todas requisições USE_STREAM são redirecionadas para origin
3. Métrica `stream.failover` é registrada
4. Alerta enviado para admin

**Ações Manuais:**
```bash
# Verificar status do worker
curl https://stream-edge-router.workers.dev/health

# Forçar todos canais para origin (via Supabase)
UPDATE streaming_policies 
SET strategy = 'USE_ORIGIN' 
WHERE content_type = 'vod';

# Ou criar override global
INSERT INTO channel_routing_overrides (channel_id, strategy, force_origin, reason, expires_at)
SELECT id, 'USE_ORIGIN', true, 'Stream outage', now() + interval '1 hour'
FROM m3u_channels WHERE is_vod = true;
```

**Rollback:**
```bash
# Restaurar política padrão
UPDATE streaming_policies 
SET strategy = 'USE_STREAM' 
WHERE content_type = 'vod';

# Remover overrides temporários
DELETE FROM channel_routing_overrides 
WHERE reason = 'Stream outage';
```

---

### 2. Origin (R2) Indisponível

**Sintomas:**
- Erros 5xx do R2
- Timeout em downloads de manifest
- Canais live fora do ar

**Ações Manuais:**
```bash
# Verificar status do bucket R2
wrangler r2 bucket list

# Forçar VODs para Stream (se disponível)
UPDATE streaming_policies 
SET strategy = 'USE_STREAM' 
WHERE content_type IN ('vod', 'agile');

# Para live, não há fallback automático
# Verificar origin server primário
```

---

### 3. Supabase Indisponível

**Sintomas:**
- Edge Router não consegue consultar policy engine
- Dashboard não carrega

**Ações no Edge Router:**
- Cache local de routing decisions continua funcionando (TTL 60s)
- Após expiração, usa fallback padrão:
  - VOD → tenta Stream primeiro, depois origin
  - Live → sempre origin

**Ações Manuais:**
```bash
# Verificar status do Supabase
curl https://api.supabase.com/status

# Se prolongado, considere cache mais longo no worker
# Altere CACHE_TTL para 300000 (5 min)
```

---

## Checklist de Incidente

### Início
- [ ] Identificar serviço afetado (Stream/R2/Supabase)
- [ ] Verificar `/health` do edge router
- [ ] Confirmar se failover automático está funcionando
- [ ] Notificar stakeholders

### Durante
- [ ] Monitorar métricas de fallback
- [ ] Verificar experiência do usuário final
- [ ] Documentar timeline do incidente

### Resolução
- [ ] Confirmar serviço restaurado
- [ ] Remover overrides temporários
- [ ] Restaurar políticas padrão
- [ ] Documentar root cause
- [ ] Criar post-mortem se necessário

---

## Contatos de Emergência

| Serviço | Página de Status | Suporte |
|---------|------------------|---------|
| Cloudflare Stream | cloudflarestatus.com | Ticket via dashboard |
| Cloudflare R2 | cloudflarestatus.com | Ticket via dashboard |
| Supabase | status.supabase.com | support@supabase.io |

---

## Comandos Úteis

```bash
# Logs do edge router em tempo real
wrangler tail stream-edge-router

# Testar roteamento de um canal específico
curl "https://stream-edge-router.workers.dev/play/UUID_DO_CANAL"

# Verificar métricas
curl "https://stream-edge-router.workers.dev/metrics"

# Limpar cache do worker (redeploy)
wrangler deploy --env production
```
