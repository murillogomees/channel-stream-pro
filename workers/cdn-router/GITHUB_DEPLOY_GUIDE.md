# Guia de Deploy via GitHub Actions

Este guia explica como configurar o deploy automático do CDN Worker usando GitHub Actions.

## 📋 Pré-requisitos

### 1. Conta Cloudflare
1. Acesse [cloudflare.com](https://cloudflare.com)
2. Crie uma conta gratuita se não tiver
3. Verifique seu email

### 2. Obter Account ID
1. Faça login no [Dashboard Cloudflare](https://dash.cloudflare.com)
2. No menu lateral, clique em **Workers & Pages**
3. Copie o **Account ID** que aparece na URL ou no painel direito
4. Anote este ID para usar depois

### 3. Criar API Token
1. No Dashboard Cloudflare, clique no seu perfil (canto superior direito)
2. Vá em **My Profile** → **API Tokens**
3. Clique em **Create Token**
4. Escolha o template **Edit Cloudflare Workers**
5. Configure as permissões:
   - **Account** → **Workers Scripts** → **Edit**
   - **Account** → **Workers R2 Storage** → **Edit**
6. Em **Account Resources**, selecione sua conta
7. Clique em **Continue to summary** → **Create Token**
8. **⚠️ IMPORTANTE**: Copie o token agora - ele só será exibido uma vez!

### 4. Criar R2 Bucket
1. No Dashboard Cloudflare, vá em **R2**
2. Clique em **Create bucket**
3. Nome do bucket: `iptvlink-cdn`
4. Região: escolha a mais próxima dos seus usuários
5. Clique em **Create bucket**

Repita para criar os buckets de staging/preview se necessário:
- `iptvlink-cdn-staging`
- `iptvlink-cdn-preview`

---

## 🔐 Configurar Secrets no GitHub

### 1. Acessar Settings do Repositório
1. Vá até seu repositório no GitHub
2. Clique em **Settings** (aba no topo)
3. No menu lateral, vá em **Secrets and variables** → **Actions**

### 2. Adicionar Secrets

Clique em **New repository secret** para cada um:

#### Secret 1: `CLOUDFLARE_API_TOKEN`
- **Name**: `CLOUDFLARE_API_TOKEN`
- **Value**: Cole o API Token que você copiou anteriormente

#### Secret 2: `CLOUDFLARE_ACCOUNT_ID`
- **Name**: `CLOUDFLARE_ACCOUNT_ID`
- **Value**: Cole o Account ID da sua conta Cloudflare

#### Secret 3: `JWT_SECRET`
- **Name**: `JWT_SECRET`
- **Value**: O mesmo valor usado no Supabase (STREAM_PROXY_SECRET)
- **Como obter**: Vá em Supabase → Project Settings → Edge Functions → Secrets

#### Secret 4: `SUPABASE_URL`
- **Name**: `SUPABASE_URL`
- **Value**: `https://sdvyxdghxqmntyoweqbd.supabase.co`

#### Secret 5: `SUPABASE_ANON_KEY`
- **Name**: `SUPABASE_ANON_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak`

### 3. Verificar Configuração
Após adicionar todos os secrets, você deve ver 5 secrets listados:
- ✅ CLOUDFLARE_API_TOKEN
- ✅ CLOUDFLARE_ACCOUNT_ID
- ✅ JWT_SECRET
- ✅ SUPABASE_URL
- ✅ SUPABASE_ANON_KEY

---

## 🚀 Deploy Automático

### Como Funciona
O GitHub Actions detecta automaticamente mudanças em `workers/cdn-router/` e faz o deploy:

1. **Trigger**: Push para branch `main` com mudanças na pasta do worker
2. **Processo**:
   - Instala dependências
   - Faz deploy para Cloudflare
   - Configura secrets de produção
   - Verifica se o deploy funcionou

### Fazer o Primeiro Deploy
1. Faça qualquer alteração em `workers/cdn-router/` (ex: adicione um comentário)
2. Commit e push para `main`:
   ```bash
   git add workers/cdn-router/
   git commit -m "chore: trigger CDN worker deploy"
   git push origin main
   ```

3. Acompanhe o deploy:
   - Vá no GitHub → **Actions**
   - Clique no workflow em execução
   - Aguarde ~2-3 minutos

### Verificar se Funcionou
1. Após o deploy concluir, copie a URL do worker dos logs
2. Acesse o health check:
   ```
   https://iptvlink-cdn-router-production.<seu-subdomain>.workers.dev/health
   ```

3. Você deve ver uma resposta JSON:
   ```json
   {
     "status": "healthy",
     "timestamp": "2024-12-02T...",
     "environment": "production",
     "version": "1.0.0",
     "r2_connected": true
   }
   ```

---

## 🔧 Configurações Avançadas

### Custom Domain
1. No Dashboard Cloudflare, vá em **Workers & Pages**
2. Clique no seu worker (`iptvlink-cdn-router-production`)
3. Vá em **Settings** → **Triggers** → **Custom Domains**
4. Clique em **Add Custom Domain**
5. Digite: `cdn.iptvlink.com` (ou seu domínio)
6. Configure o DNS automaticamente ou manualmente

### Monitoramento
- **Logs em tempo real**: `wrangler tail --env production`
- **Métricas**: Dashboard Cloudflare → Workers → seu worker → Analytics
- **Alertas**: Configure no Cloudflare para notificar sobre erros

### Troubleshooting

#### Deploy falha com "Authentication error"
- Verifique se `CLOUDFLARE_API_TOKEN` está correto
- Gere um novo token se necessário

#### R2 Bucket não encontrado
- Verifique se o bucket `iptvlink-cdn` existe
- Confirme o nome exato no `wrangler.toml`

#### Secrets não aplicados
- Re-execute o workflow manualmente em **Actions**
- Ou configure manualmente: `wrangler secret put JWT_SECRET --env production`

---

## 📊 Monitoramento de Saúde

Use o script incluído para monitoramento contínuo:

```bash
chmod +x workers/cdn-router/health-monitor.sh
./workers/cdn-router/health-monitor.sh
```

Configure webhook para alertas automáticos editando:
```bash
ALERT_WEBHOOK="https://seu-webhook-url.com/alerts"
```

---

## 🔄 Próximos Passos

Após o deploy bem-sucedido:

1. ✅ Testar a URL do health check
2. ✅ Configurar custom domain (opcional)
3. ✅ Atualizar URLs no Supabase Edge Functions para usar o CDN
4. ✅ Configurar monitoramento e alertas
5. ✅ Executar testes de carga

---

## 📞 Suporte

- **Documentação Cloudflare**: [developers.cloudflare.com/workers](https://developers.cloudflare.com/workers)
- **Wrangler CLI**: [developers.cloudflare.com/workers/wrangler](https://developers.cloudflare.com/workers/wrangler)
- **R2 Storage**: [developers.cloudflare.com/r2](https://developers.cloudflare.com/r2)
