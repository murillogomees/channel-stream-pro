# 🔧 Atualização de Variáveis de Ambiente

## Após a migração, atualize as seguintes variáveis:

---

## 📱 Frontend (React/Vite)

### Arquivo: `.env` ou `.env.production`

```env
# ============================================
# SUPABASE - ATUALIZAR PARA SELF-HOSTED
# ============================================

# URL da API Supabase (ANTES: Cloud)
VITE_SUPABASE_URL={{SUPABASE_URL_DEST}}

# Chave pública/anon (ANTES: Cloud)
VITE_SUPABASE_ANON_KEY={{SUPABASE_ANON_KEY_DEST}}

# URL do Storage (derivada da URL principal)
VITE_SUPABASE_STORAGE_URL={{SUPABASE_URL_DEST}}/storage/v1

# URL do Realtime (WebSocket)
VITE_SUPABASE_REALTIME_URL=wss://{{SUPABASE_HOST_DEST}}/realtime/v1
```

### Se usando Vercel

```bash
# Via CLI
vercel env rm VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_URL production
# Colar: {{SUPABASE_URL_DEST}}

vercel env rm VITE_SUPABASE_ANON_KEY production  
vercel env add VITE_SUPABASE_ANON_KEY production
# Colar: {{SUPABASE_ANON_KEY_DEST}}

# Redeploy
vercel --prod
```

### Se usando Netlify

```bash
# Via CLI
netlify env:set VITE_SUPABASE_URL "{{SUPABASE_URL_DEST}}"
netlify env:set VITE_SUPABASE_ANON_KEY "{{SUPABASE_ANON_KEY_DEST}}"

# Redeploy
netlify deploy --prod
```

---

## ⚙️ Backend / Edge Functions

### Arquivo: `.env` ou secrets do Supabase

```env
# ============================================
# SUPABASE - SERVICE ROLE (BACKEND)
# ============================================

# URL da API Supabase
SUPABASE_URL={{SUPABASE_URL_DEST}}

# Chave de serviço (acesso total)
SUPABASE_SERVICE_ROLE_KEY={{SUPABASE_SERVICE_KEY_DEST}}

# Chave anon (para operações públicas)
SUPABASE_ANON_KEY={{SUPABASE_ANON_KEY_DEST}}

# JWT Secret (para verificação de tokens)
SUPABASE_JWT_SECRET={{JWT_SECRET_DEST}}
```

### Secrets no Supabase Self-Hosted

```bash
# Via Docker Compose, editar .env do Supabase:
# /opt/supabase/.env ou onde está instalado

POSTGRES_PASSWORD={{POSTGRES_PASSWORD}}
JWT_SECRET={{JWT_SECRET}}
ANON_KEY={{SUPABASE_ANON_KEY_DEST}}
SERVICE_ROLE_KEY={{SUPABASE_SERVICE_KEY_DEST}}
```

---

## 🔗 Integrações Externas

### MercadoPago Webhooks

Atualizar URL do webhook no painel MercadoPago:
- **Antes:** `https://{{PROJECT_ORIG}}.supabase.co/functions/v1/mercadopago-webhook`
- **Depois:** `{{SUPABASE_URL_DEST}}/functions/v1/mercadopago-webhook`

### WhatsApp/Z-API Webhooks

Atualizar URL do webhook no painel Z-API:
- **Antes:** `https://{{PROJECT_ORIG}}.supabase.co/functions/v1/whatsapp-webhook`
- **Depois:** `{{SUPABASE_URL_DEST}}/functions/v1/whatsapp-webhook`

### Cloudflare R2 (se aplicável)

```env
# Manter as mesmas credenciais R2 (não muda com migração Supabase)
CLOUDFLARE_R2_ACCESS_KEY_ID={{MANTÉM_IGUAL}}
CLOUDFLARE_R2_SECRET_ACCESS_KEY={{MANTÉM_IGUAL}}
CLOUDFLARE_R2_BUCKET={{MANTÉM_IGUAL}}
CLOUDFLARE_R2_ENDPOINT={{MANTÉM_IGUAL}}
```

---

## 🌐 DNS (Se Aplicável)

### Se usando domínio customizado para API

```dns
# Antes (apontando para Supabase Cloud)
api.seudominio.com CNAME sdvyxdghxqmntyoweqbd.supabase.co

# Depois (apontando para VPS Hostinger)
api.seudominio.com A {{IP_VPS_HOSTINGER}}
```

### Nginx/Reverse Proxy na VPS

```nginx
# /etc/nginx/sites-available/supabase
server {
    listen 443 ssl;
    server_name api.seudominio.com;
    
    ssl_certificate /etc/letsencrypt/live/api.seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.seudominio.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:8000;  # Kong Gateway do Supabase
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 📋 Checklist de Atualização

### Frontend
- [ ] VITE_SUPABASE_URL atualizada
- [ ] VITE_SUPABASE_ANON_KEY atualizada
- [ ] VITE_SUPABASE_STORAGE_URL atualizada (se usada)
- [ ] VITE_SUPABASE_REALTIME_URL atualizada (se usada)
- [ ] Aplicação redeployada

### Backend
- [ ] SUPABASE_URL atualizada
- [ ] SUPABASE_SERVICE_ROLE_KEY atualizada
- [ ] SUPABASE_JWT_SECRET atualizada
- [ ] Edge Functions redeployadas

### Integrações
- [ ] Webhook MercadoPago atualizado
- [ ] Webhook WhatsApp atualizado
- [ ] Outros webhooks atualizados

### Infraestrutura
- [ ] DNS atualizado (se aplicável)
- [ ] SSL configurado (se domínio customizado)
- [ ] Nginx/proxy configurado

---

## 🔐 Segurança Pós-Atualização

1. **Rotacionar credenciais antigas:**
   - Gerar novas chaves no Self-Hosted se possível
   - Revogar tokens antigos

2. **Verificar acesso:**
   - Testar que credenciais antigas não funcionam mais
   - Confirmar que novas credenciais funcionam

3. **Limpar arquivos sensíveis:**
   ```bash
   # Remover dumps e arquivos temporários
   rm -rf /tmp/supabase_migration/
   rm -f ~/supabase_dump*.custom*
   ```

4. **Atualizar documentação:**
   - Atualizar README com novos endpoints
   - Atualizar documentação de deploy

---

## 📊 Tabela de Referência Rápida

| Variável | Valor Antigo (Cloud) | Valor Novo (Self-Hosted) |
|----------|---------------------|--------------------------|
| SUPABASE_URL | `https://sdvyxdghxqmntyoweqbd.supabase.co` | `{{SUPABASE_URL_DEST}}` |
| ANON_KEY | `eyJhbG...` (Cloud) | `{{SUPABASE_ANON_KEY_DEST}}` |
| SERVICE_KEY | `eyJhbG...` (Cloud) | `{{SUPABASE_SERVICE_KEY_DEST}}` |
| PG_URL | `postgresql://...supabase.co` | `{{PG_URL_DEST}}` |
