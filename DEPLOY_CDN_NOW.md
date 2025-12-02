# 🚀 DEPLOY CDN WORKER AGORA - Passo a Passo

**⏱️ Tempo:** 5 minutos  
**🎯 Objetivo:** Colocar CDN Worker em produção

---

## 📋 Checklist Pré-Deploy

Antes de começar, tenha em mãos:

```bash
✅ Cloudflare Account ativo
✅ Wrangler CLI instalado (npm install -g wrangler)
✅ R2 Bucket "iptvlink-cdn" criado
✅ JWT_SECRET (mesmo do Supabase STREAM_PROXY_SECRET)
✅ SUPABASE_URL: https://sdvyxdghxqmntyoweqbd.supabase.co
✅ SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🎬 COMANDOS EXATOS (Copy-Paste)

### Passo 1: Login no Cloudflare
```bash
wrangler login
```
↳ Abre navegador → Autorize o Wrangler

### Passo 2: Navegar para o worker
```bash
cd workers/cdn-router
```

### Passo 3: Configurar Secrets (UM POR VEZ)
```bash
# Secret 1: JWT_SECRET
wrangler secret put JWT_SECRET --env production
# ↳ Cole o valor quando solicitar (mesma secret do Supabase STREAM_PROXY_SECRET)

# Secret 2: SUPABASE_URL
wrangler secret put SUPABASE_URL --env production
# ↳ Cole: https://sdvyxdghxqmntyoweqbd.supabase.co

# Secret 3: SUPABASE_ANON_KEY
wrangler secret put SUPABASE_ANON_KEY --env production
# ↳ Cole a chave anon do Supabase
```

### Passo 4: Deploy! 🚀
```bash
wrangler deploy --env production
```

**Output esperado:**
```
✨  Successfully published your script to
   https://iptvlink-cdn-router-production.YOUR-SUBDOMAIN.workers.dev
```

### Passo 5: Testar Health Check
```bash
curl https://iptvlink-cdn-router-production.YOUR-SUBDOMAIN.workers.dev/health | jq .
```

**Resposta esperada:**
```json
{
  "status": "healthy",
  "timestamp": "2025-06-01T...",
  "version": "1.0.0",
  "config": {
    "rateLimit": "200 req/min",
    "bandwidth": "500 MB/min",
    "manifestCache": "10s browser, 30s edge",
    "segmentCache": "3600s browser, 86400s edge"
  }
}
```

---

## ✅ Validação Completa

### 1. Verificar Secrets Configurados
```bash
wrangler secret list --env production
```

**Output esperado:**
```
JWT_SECRET
SUPABASE_URL
SUPABASE_ANON_KEY
```

### 2. Verificar R2 Binding
```bash
wrangler r2 bucket list
```

**Deve mostrar:**
```
iptvlink-cdn
```

### 3. Verificar Worker no Dashboard
1. Acesse: https://dash.cloudflare.com/workers
2. Veja: `iptvlink-cdn-router-production`
3. Status: ✅ Running

---

## 🐛 Troubleshooting

### ❌ Erro: "Could not find R2 bucket 'iptvlink-cdn'"

**Solução:**
```bash
wrangler r2 bucket create iptvlink-cdn
```

### ❌ Erro: "Invalid JWT_SECRET"

**Solução:**
```bash
# Reconfigurar o secret
wrangler secret put JWT_SECRET --env production
```

### ❌ Erro: "Unauthorized" no teste

**Causa:** JWT_SECRET diferente entre Supabase e Worker  
**Solução:** Usar EXATAMENTE a mesma secret em ambos

### ❌ Worker não responde

**Debug:**
```bash
# Ver logs em tempo real
wrangler tail --env production

# Fazer request e ver log
curl https://iptvlink-cdn-router-production.YOUR-SUBDOMAIN.workers.dev/health
```

---

## 📊 Métricas Pós-Deploy

### Dashboard Cloudflare

Acesse: https://dash.cloudflare.com/workers → `iptvlink-cdn-router-production`

**Métricas para monitorar:**
- ✅ Requests/minute
- ✅ Success rate (deve ser > 99%)
- ✅ P50/P99 latency
- ✅ Errors (deve ser 0)

### Logs em Tempo Real
```bash
wrangler tail --env production --format pretty
```

---

## 🎯 Próximos Passos Após Deploy

1. ✅ **Atualizar Frontend**
   - Apontar M3U URLs para o CDN Worker
   - Usar URL: `https://iptvlink-cdn-router-production.YOUR-SUBDOMAIN.workers.dev/`

2. ✅ **Configurar Custom Domain** (opcional)
   - Cloudflare Dashboard → Workers → Custom Domains
   - Adicionar: `cdn.iptvlink.com.br`

3. ✅ **Configurar Alertas**
   - Cloudflare Dashboard → Notifications
   - Alert on: Error rate > 1%, Latency > 2s

4. ✅ **GitHub Actions** (já configurado!)
   - Adicionar secrets no GitHub:
     - `CLOUDFLARE_API_TOKEN`
     - `CLOUDFLARE_ACCOUNT_ID`
     - `JWT_SECRET`
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY`
   - Push para `main` → Deploy automático

---

## 🔥 Quick Test Script

Salve como `test-cdn.sh` e execute:

```bash
#!/bin/bash
WORKER_URL="https://iptvlink-cdn-router-production.YOUR-SUBDOMAIN.workers.dev"

echo "🧪 Testing CDN Worker..."

# Test 1: Health check
echo -e "\n1️⃣ Health Check:"
curl -s "$WORKER_URL/health" | jq -r '.status'

# Test 2: Manifest without JWT (should fail)
echo -e "\n2️⃣ Manifest without JWT (expect 401):"
curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL/test.m3u8"

# Test 3: CORS preflight
echo -e "\n3️⃣ CORS Preflight:"
curl -s -X OPTIONS "$WORKER_URL/test.m3u8" -I | grep "Access-Control"

echo -e "\n✅ Tests complete!"
```

---

## 📞 Suporte

**Problemas?**
- 📖 Docs completa: `docs/CDN_WORKER_DEPLOYMENT.md`
- 🔍 Troubleshooting: `docs/CDN_WORKER_DEPLOYMENT_QUICK_GUIDE.md`
- 💬 Cloudflare Community: https://community.cloudflare.com/

---

**⏱️ Deploy deve levar < 5 minutos**  
**🎯 Após deploy, volte aqui para continuar com Security Improvements!**
