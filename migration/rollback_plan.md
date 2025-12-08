# 🔄 Plano de Rollback: Supabase Migration

## ⚠️ Quando Executar Rollback

Execute o rollback se:
- Testes de healthcheck falharem criticamente
- Dados estiverem corrompidos ou faltando
- Aplicação não funcionar após 30 minutos de troubleshooting
- Usuários reportarem problemas críticos
- Performance estiver degradada significativamente

---

## 🚨 Procedimento de Rollback Emergencial

### Tempo Estimado: 15-30 minutos

### Passo 1: Comunicação (2 min)

```bash
# Notificar equipe
echo "ROLLBACK INICIADO - $(date)" 

# Se possível, ativar página de manutenção
```

### Passo 2: Reverter DNS (5 min)

Se o DNS foi alterado para apontar para o Self-Hosted:

```bash
# Voltar DNS para Supabase Cloud original
# No seu provedor DNS, alterar:
# 
# DE: api.seudominio.com → IP_VPS_HOSTINGER
# PARA: api.seudominio.com → supabase.co (ou CNAME original)

# Verificar propagação
dig api.seudominio.com +short
```

### Passo 3: Restaurar Variáveis de Ambiente (5 min)

#### Frontend (.env / Vercel / Netlify)

```env
# RESTAURAR VALORES ORIGINAIS:
VITE_SUPABASE_URL={{SUPABASE_URL_ORIG}}
VITE_SUPABASE_ANON_KEY={{SUPABASE_ANON_KEY_ORIG}}
```

#### Backend / Edge Functions

```env
# RESTAURAR VALORES ORIGINAIS:
SUPABASE_URL={{SUPABASE_URL_ORIG}}
SUPABASE_SERVICE_ROLE_KEY={{SUPABASE_SERVICE_KEY_ORIG}}
```

### Passo 4: Redeploy da Aplicação (10 min)

```bash
# Se usando Lovable
# Publicar novamente com configurações originais

# Se usando Vercel
vercel --prod

# Se usando Netlify
netlify deploy --prod

# Se usando Docker
docker-compose down
docker-compose up -d
```

### Passo 5: Verificação (5 min)

```bash
# Testar endpoints críticos
curl -I "{{SUPABASE_URL_ORIG}}/rest/v1/profiles" \
  -H "apikey: {{SUPABASE_ANON_KEY_ORIG}}"

# Testar login
curl -X POST "{{SUPABASE_URL_ORIG}}/auth/v1/token?grant_type=password" \
  -H "apikey: {{SUPABASE_ANON_KEY_ORIG}}" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### Passo 6: Comunicação Final (2 min)

```bash
# Notificar equipe
echo "ROLLBACK CONCLUÍDO - Sistema restaurado - $(date)"

# Desativar página de manutenção
```

---

## 📋 Checklist de Rollback

- [ ] Equipe notificada do rollback
- [ ] DNS revertido (se alterado)
- [ ] Variáveis de ambiente frontend restauradas
- [ ] Variáveis de ambiente backend restauradas
- [ ] Webhooks reconfigurados para URL original
- [ ] Aplicação redeployada
- [ ] Testes básicos passando
- [ ] Usuários conseguem fazer login
- [ ] Dados estão acessíveis
- [ ] Página de manutenção desativada
- [ ] Post-mortem agendado

---

## 🔧 Scripts de Rollback

### rollback_quick.sh

```bash
#!/bin/bash
# Rollback rápido - apenas configurações
set -euo pipefail

echo "=========================================="
echo " ROLLBACK: Restaurando configuração original"
echo "=========================================="

# Variáveis originais (PREENCHER)
export SUPABASE_URL_ORIG="{{SUPABASE_URL_ORIG}}"
export SUPABASE_ANON_KEY_ORIG="{{SUPABASE_ANON_KEY_ORIG}}"
export SUPABASE_SERVICE_KEY_ORIG="{{SUPABASE_SERVICE_KEY_ORIG}}"

# Verificar conexão com Supabase Cloud original
echo "Verificando Supabase Cloud original..."
curl -s -o /dev/null -w "%{http_code}" \
  "${SUPABASE_URL_ORIG}/rest/v1/" \
  -H "apikey: ${SUPABASE_ANON_KEY_ORIG}"

echo ""
echo "Supabase Cloud acessível!"
echo ""
echo "PRÓXIMOS PASSOS MANUAIS:"
echo "1. Atualizar .env com valores originais"
echo "2. Redeploy da aplicação"
echo "3. Reverter DNS se necessário"
```

### verify_original.sh

```bash
#!/bin/bash
# Verificar que Supabase Cloud original está funcionando
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL_ORIG:-{{SUPABASE_URL_ORIG}}}"
SUPABASE_KEY="${SUPABASE_ANON_KEY_ORIG:-{{SUPABASE_ANON_KEY_ORIG}}}"

echo "Verificando Supabase Cloud..."

# REST API
echo -n "REST API: "
curl -s -o /dev/null -w "%{http_code}\n" \
  "${SUPABASE_URL}/rest/v1/" \
  -H "apikey: ${SUPABASE_KEY}"

# Auth
echo -n "Auth API: "
curl -s -o /dev/null -w "%{http_code}\n" \
  "${SUPABASE_URL}/auth/v1/health" \
  -H "apikey: ${SUPABASE_KEY}"

# Storage
echo -n "Storage API: "
curl -s -o /dev/null -w "%{http_code}\n" \
  "${SUPABASE_URL}/storage/v1/bucket" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY_ORIG:-${SUPABASE_KEY}}"

echo ""
echo "Verificação concluída!"
```

---

## 🔄 Rollback de Dados (Se Necessário)

Se dados foram corrompidos no Self-Hosted e você precisa restaurar:

### Opção 1: Usar Backup Existente

O Supabase Cloud mantém backups automáticos. Acesse:
`https://supabase.com/dashboard/project/[PROJECT]/settings/database`

### Opção 2: Re-importar do Dump Original

Se você manteve o dump da migração:

```bash
# Na VPS, se precisar limpar e reimportar
pg_restore \
  --verbose \
  --clean \
  --if-exists \
  --no-acl \
  --no-owner \
  --dbname="{{PG_URL_DEST}}" \
  /path/to/original_backup.custom
```

---

## 📊 Matriz de Decisão de Rollback

| Problema | Severidade | Ação |
|----------|------------|------|
| Auth não funciona | CRÍTICO | Rollback imediato |
| Dados faltando | CRÍTICO | Rollback imediato |
| Storage inacessível | ALTO | Rollback em 15 min |
| Performance lenta | MÉDIO | Troubleshoot 30 min |
| Edge Functions falham | MÉDIO | Troubleshoot 30 min |
| Logs com erros | BAIXO | Investigar, não rollback |

---

## 📝 Template de Post-Mortem

Após qualquer rollback, preencher:

```markdown
## Post-Mortem: Rollback de Migração

**Data:** _______________
**Duração do incidente:** _______________
**Impacto:** _______________

### O que aconteceu?


### Por que aconteceu?


### Como foi resolvido?


### Ações para evitar recorrência:
1. 
2. 
3. 

### Lições aprendidas:

```

---

## 📞 Contatos de Emergência

| Papel | Nome | Contato |
|-------|------|---------|
| Responsável Técnico | | |
| DBA | | |
| DevOps | | |
| Suporte Hostinger | | suporte@hostinger.com |
| Suporte Supabase | | support@supabase.io |

---

## ⏰ SLA de Rollback

| Fase | Tempo Máximo |
|------|--------------|
| Decisão de rollback | 15 minutos |
| Execução | 30 minutos |
| Verificação | 15 minutos |
| **Total** | **1 hora** |

Se o rollback levar mais de 1 hora, escalar para próximo nível de suporte.
