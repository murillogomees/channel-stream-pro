# 🚀 CDN Worker Deployment - Quick Guide

**Tempo estimado:** 5 minutos  
**Criticidade:** 🔴 ALTA  
**Status:** ⏳ Pendente

---

## ✅ Pré-requisitos

Antes de começar, certifique-se de ter:

- [ ] Conta Cloudflare ativa
- [ ] Workers subscription (free tier funciona)
- [ ] Bucket R2 `iptvlink-cdn` criado
- [ ] Wrangler CLI instalado (`npm install -g wrangler`)
- [ ] Cloudflare API Token com permissões Workers
- [ ] Secrets disponíveis:
  - `JWT_SECRET` (mesmo usado no Supabase)
  - `SUPABASE_URL` (https://sdvyxdghxqmntyoweqbd.supabase.co)
  - `SUPABASE_ANON_KEY`

---

## 📋 Passo a Passo

### 1. Autenticar com Cloudflare

```bash
wrangler login
```

Isso abrirá o navegador para autorizar o Wrangler.

### 2. Configurar Secrets

```bash
cd workers/cdn-router

# Configurar JWT_SECRET (use o mesmo do Supabase STREAM_PROXY_SECRET)
wrangler secret put JWT_SECRET --env production

# Configurar Supabase URL
wrangler secret put SUPABASE_URL --env production
# Valor: https://sdvyxdghxqmntyoweqbd.supabase.co

# Configurar Supabase Anon Key
wrangler secret put SUPABASE_ANON_KEY --env production
# Valor: [copiar do Supabase Dashboard]
```

### 3. Verificar wrangler.toml

Confirme que o bucket está correto:

```toml
[[env.production.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "iptvlink-cdn"  # ✅ Bucket correto
```

### 4. Deploy para Produção

```bash
wrangler deploy --env production
```

### 5. Verificar Deployment

```bash
# Testar health endpoint
curl https://iptvlink-cdn-router-production.[your-subdomain].workers.dev/health
```

**Resposta esperada:**
```json
{
  "status": "healthy",
  "timestamp": "2025-06-01T10:00:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

---

## 🔍 Troubleshooting

### Erro: "Could not find R2 bucket"

**Causa:** Bucket `iptvlink-cdn` não existe  
**Solução:**
```bash
# Criar bucket via Cloudflare Dashboard
# Ou via Wrangler:
wrangler r2 bucket create iptvlink-cdn
```

### Erro: "Invalid JWT_SECRET"

**Causa:** Secret não configurado ou incorreto  
**Solução:**
```bash
# Reconfigurar secret
wrangler secret put JWT_SECRET --env production
```

### Erro: "Worker exceeded CPU time"

**Causa:** Worker muito pesado ou loop infinito  
**Solução:**
1. Verificar logs: `wrangler tail --env production`
2. Revisar código do worker para otimizações

---

## 📊 Validação Pós-Deploy

### 1. Health Check
```bash
curl https://iptvlink-cdn-router-production.[subdomain].workers.dev/health | jq .
```

### 2. Test Authenticated Request
```bash
# Gerar token JWT válido via Supabase
# Testar rota protegida
curl -H "Authorization: Bearer [JWT_TOKEN]" \
  https://iptvlink-cdn-router-production.[subdomain].workers.dev/content/test.m3u8
```

### 3. Test R2 Integration
```bash
# Upload test file para R2
wrangler r2 object put iptvlink-cdn/test.txt --file=test.txt

# Verificar via worker
curl https://iptvlink-cdn-router-production.[subdomain].workers.dev/test.txt
```

---

## 🎯 GitHub Actions (Opcional)

Para CI/CD automático, configure secrets no GitHub:

1. **Repository Settings → Secrets → Actions**
2. Adicione:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `JWT_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

O workflow `.github/workflows/deploy-cdn-worker.yml` deployará automaticamente ao push para `main`.

---

## 📝 Checklist Final

- [ ] Worker deployado com sucesso
- [ ] Health endpoint respondendo
- [ ] Secrets configurados
- [ ] R2 bucket acessível
- [ ] JWT validation funcionando
- [ ] Logs sem erros no Cloudflare Dashboard
- [ ] GitHub Actions configurado (se aplicável)

---

## 🔗 URLs Importantes

| Recurso | URL |
|---------|-----|
| Cloudflare Dashboard | https://dash.cloudflare.com |
| Workers Dashboard | https://dash.cloudflare.com/workers |
| R2 Dashboard | https://dash.cloudflare.com/r2 |
| Worker Logs | `wrangler tail --env production` |
| Deployment Docs | docs/CDN_WORKER_DEPLOYMENT.md |

---

## ⏭️ Próximos Passos

Após deploy bem-sucedido:

1. ✅ **Atualizar documentação** com URL do worker
2. ✅ **Integrar com frontend** - apontar M3U URLs para CDN Worker
3. ✅ **Configurar alertas** - Cloudflare Analytics
4. ✅ **Monitorar métricas** - Latência, erros, cache hit rate

---

**Deploy estimado:** 5 minutos  
**Impacto:** Crítico para delivery de conteúdo VOD  
**Rollback:** Simples (desativar feature flag ou rollback deployment)
