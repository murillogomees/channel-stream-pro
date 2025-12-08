# 🚀 Reimplantação de Edge Functions no Self-Hosted

## 📋 Visão Geral

O Supabase Self-Hosted executa Edge Functions via Deno Deploy ou Docker container.
Este guia cobre a reimplantação das 78 Edge Functions do projeto.

---

## 🔍 Inventário de Functions

### Functions Críticas (Prioridade Alta)

| Function | Descrição | Dependências |
|----------|-----------|--------------|
| `mercadopago-webhook` | Webhooks de pagamento | MERCADOPAGO_ACCESS_TOKEN |
| `whatsapp-webhook` | Webhooks WhatsApp | WHATSAPP_TOKEN, WHATSAPP_PHONE_ID |
| `send-whatsapp` | Envio de mensagens | WHATSAPP_TOKEN |
| `create-checkout` | Criação de checkout | MERCADOPAGO_ACCESS_TOKEN |
| `stream-proxy` | Proxy de streams | - |
| `generate-m3u-file` | Geração de M3U | R2 credentials |

### Functions de Suporte (Prioridade Média)

| Function | Descrição |
|----------|-----------|
| `check-secrets` | Verificação de secrets |
| `auth-session-log` | Log de sessões |
| `cleanup-*` | Funções de limpeza |
| `cdn-*` | Funções de CDN |

---

## 🛠️ Método 1: Docker (Recomendado para Self-Hosted)

### 1.1 Estrutura de Arquivos

```
/opt/supabase/
├── docker-compose.yml
├── volumes/
│   └── functions/
│       ├── mercadopago-webhook/
│       │   └── index.ts
│       ├── whatsapp-webhook/
│       │   └── index.ts
│       └── ... (outras functions)
└── .env
```

### 1.2 Copiar Functions do Repositório

```bash
# No seu repositório local
cd /path/to/seu-projeto

# Copiar para VPS
scp -r supabase/functions/* root@{{SSH_HOST}}:/opt/supabase/volumes/functions/
```

### 1.3 Configurar docker-compose.yml

Adicionar ou verificar o serviço `functions`:

```yaml
# docker-compose.yml
services:
  functions:
    image: supabase/edge-runtime:v1.29.1
    restart: unless-stopped
    depends_on:
      - analytics
    environment:
      JWT_SECRET: ${JWT_SECRET}
      SUPABASE_URL: http://kong:8000
      SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}
      SUPABASE_DB_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/postgres
      # Secrets customizados
      MERCADOPAGO_ACCESS_TOKEN: ${MERCADOPAGO_ACCESS_TOKEN}
      MERCADOPAGO_WEBHOOK_SECRET: ${MERCADOPAGO_WEBHOOK_SECRET}
      WHATSAPP_TOKEN: ${WHATSAPP_TOKEN}
      WHATSAPP_PHONE_ID: ${WHATSAPP_PHONE_ID}
      CLOUDFLARE_R2_ACCESS_KEY_ID: ${CLOUDFLARE_R2_ACCESS_KEY_ID}
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: ${CLOUDFLARE_R2_SECRET_ACCESS_KEY}
      CLOUDFLARE_R2_BUCKET: ${CLOUDFLARE_R2_BUCKET}
      CLOUDFLARE_ACCOUNT_ID: ${CLOUDFLARE_ACCOUNT_ID}
    volumes:
      - ./volumes/functions:/home/deno/functions:ro
    command:
      - start
      - --main-service
      - /home/deno/functions/main
```

### 1.4 Criar Main Service

```typescript
// /opt/supabase/volumes/functions/main/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FUNCTION_MAP: Record<string, string> = {
  "mercadopago-webhook": "/home/deno/functions/mercadopago-webhook/index.ts",
  "whatsapp-webhook": "/home/deno/functions/whatsapp-webhook/index.ts",
  "send-whatsapp": "/home/deno/functions/send-whatsapp/index.ts",
  "create-checkout": "/home/deno/functions/create-checkout/index.ts",
  // ... adicionar todas as functions
};

serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  // Expected: /functions/v1/{function-name}
  if (pathParts[0] === "functions" && pathParts[1] === "v1" && pathParts[2]) {
    const functionName = pathParts[2];
    const functionPath = FUNCTION_MAP[functionName];
    
    if (functionPath) {
      try {
        const module = await import(functionPath);
        return module.default(req);
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }
  
  return new Response("Function not found", { status: 404 });
});
```

### 1.5 Reiniciar Serviços

```bash
cd /opt/supabase
docker-compose down functions
docker-compose up -d functions
docker-compose logs -f functions
```

---

## 🛠️ Método 2: Supabase CLI (Se Disponível)

### 2.1 Instalar Supabase CLI na VPS

```bash
# Via npm
npm install -g supabase

# Via brew (se disponível)
brew install supabase/tap/supabase
```

### 2.2 Link ao Projeto Self-Hosted

```bash
# Configurar URL do self-hosted
export SUPABASE_ACCESS_TOKEN="seu-token-local"

# No diretório do projeto
cd /path/to/seu-projeto

# Fazer deploy
supabase functions deploy --project-ref local
```

---

## 🔐 Configuração de Secrets

### 3.1 Listar Secrets Necessários

```bash
# Secrets que precisam ser configurados no Self-Hosted:

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=

# WhatsApp/Z-API
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
WHATSAPP_APPKEY=
WHATSAPP_AUTHKEY=
WHATSAPP_WEBHOOK_SECRET=

# Cloudflare R2
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_ENDPOINT=
CLOUDFLARE_ACCOUNT_ID=

# Supabase (já configurados no Self-Hosted)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### 3.2 Adicionar ao .env do Self-Hosted

```bash
# Editar arquivo de ambiente
nano /opt/supabase/.env

# Adicionar cada secret
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxx
MERCADOPAGO_WEBHOOK_SECRET=xxxxx
# ... etc
```

### 3.3 Reiniciar para Aplicar

```bash
docker-compose down
docker-compose up -d
```

---

## ✅ Verificação de Functions

### 4.1 Script de Teste

```bash
#!/bin/bash
# test_functions.sh

SUPABASE_URL="{{SUPABASE_URL_DEST}}"
ANON_KEY="{{SUPABASE_ANON_KEY_DEST}}"

# Lista de functions para testar
FUNCTIONS=(
  "mercadopago-webhook"
  "whatsapp-webhook"
  "send-whatsapp"
  "create-checkout"
  "check-secrets"
)

echo "Testando Edge Functions..."
echo ""

for fn in "${FUNCTIONS[@]}"; do
  echo -n "Testing $fn: "
  
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    "${SUPABASE_URL}/functions/v1/${fn}" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"test": true}' \
    --connect-timeout 10)
  
  if [[ "$response" == "200" ]] || [[ "$response" == "400" ]] || [[ "$response" == "401" ]]; then
    echo "✅ OK (HTTP $response)"
  else
    echo "❌ FAIL (HTTP $response)"
  fi
done
```

### 4.2 Executar Testes

```bash
chmod +x test_functions.sh
./test_functions.sh
```

---

## 🔄 Atualização de Functions

### Workflow para Atualizações Futuras

1. **Desenvolver localmente:**
   ```bash
   # No seu ambiente de desenvolvimento
   supabase functions serve function-name
   ```

2. **Testar:**
   ```bash
   curl -X POST http://localhost:54321/functions/v1/function-name
   ```

3. **Copiar para VPS:**
   ```bash
   scp supabase/functions/function-name/* root@{{SSH_HOST}}:/opt/supabase/volumes/functions/function-name/
   ```

4. **Reiniciar container:**
   ```bash
   ssh root@{{SSH_HOST}} "cd /opt/supabase && docker-compose restart functions"
   ```

---

## 🐛 Troubleshooting

### Function não encontrada

```bash
# Verificar se arquivo existe
ls -la /opt/supabase/volumes/functions/function-name/

# Verificar logs
docker-compose logs functions | grep "function-name"
```

### Erro de import

```bash
# Verificar dependências no import_map.json
cat /opt/supabase/volumes/functions/import_map.json
```

### Timeout

```bash
# Aumentar timeout no Kong
# Editar kong.yml ou configuração do API Gateway
```

### Secret não disponível

```bash
# Verificar se está no .env
grep "SECRET_NAME" /opt/supabase/.env

# Verificar se container tem acesso
docker-compose exec functions env | grep "SECRET_NAME"
```

---

## 📊 Monitoramento

### Logs em Tempo Real

```bash
# Todas as functions
docker-compose logs -f functions

# Filtrar por function específica
docker-compose logs -f functions | grep "mercadopago"
```

### Métricas

```bash
# Status do container
docker stats supabase-functions

# Health check
curl -s ${SUPABASE_URL}/functions/v1/health
```

---

## 📝 Checklist de Reimplantação

- [ ] Functions copiadas para `/opt/supabase/volumes/functions/`
- [ ] docker-compose.yml configurado com serviço functions
- [ ] Secrets adicionados ao .env
- [ ] Container reiniciado
- [ ] Cada function testada individualmente
- [ ] Webhooks externos atualizados com nova URL
- [ ] Logs monitorados por 30 minutos
- [ ] Documentação atualizada
