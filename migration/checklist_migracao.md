# ✅ Checklist de Migração: Supabase Cloud → Self-Hosted

## 📋 Informações da Migração

| Campo | Valor |
|-------|-------|
| **Data Planejada** | __________________ |
| **Responsável** | __________________ |
| **Janela de Manutenção** | __________________ |
| **Tempo Estimado** | 2-4 horas |

---

## 🔴 PRÉ-MIGRAÇÃO

### Preparação do Ambiente

- [ ] VPS Hostinger provisionada e acessível via SSH
- [ ] Docker e Docker Compose instalados na VPS
- [ ] Supabase Self-Hosted instalado e rodando
- [ ] PostgreSQL client instalado (pg_dump, pg_restore, psql)
- [ ] Node.js 18+ instalado (para copy_storage.js)
- [ ] Espaço em disco suficiente (3x tamanho do banco)

### Coleta de Credenciais

- [ ] **PG_URL_ORIG**: Connection string do Supabase Cloud
  ```
  postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
  ```
- [ ] **PG_URL_DEST**: Connection string do Supabase Self-Hosted
  ```
  postgresql://postgres:[PASSWORD]@localhost:5432/postgres
  ```
- [ ] **SUPABASE_URL_ORIG**: URL da API Supabase Cloud
- [ ] **SUPABASE_URL_DEST**: URL da API Supabase Self-Hosted
- [ ] **SUPABASE_SERVICE_KEY_ORIG**: Service role key Cloud
- [ ] **SUPABASE_SERVICE_KEY_DEST**: Service role key Self-Hosted
- [ ] **SSH_HOST**: Hostname da VPS
- [ ] **SSH_USER**: Usuário SSH (geralmente root)
- [ ] **BUCKETS_LIST**: Lista de buckets para migrar

### Backup e Segurança

- [ ] Backup completo do Supabase Cloud realizado
- [ ] Backup verificado e testado
- [ ] Plano de rollback documentado e entendido
- [ ] Comunicação aos usuários sobre janela de manutenção
- [ ] Acesso de emergência ao Supabase Cloud garantido

### Verificações Técnicas

- [ ] Extensions do PostgreSQL listadas
- [ ] Contagem de registros por tabela documentada
- [ ] Tamanho do storage documentado
- [ ] Edge Functions identificadas
- [ ] RLS policies exportadas

---

## 🟡 EXECUÇÃO

### Fase 1: Export do Banco (Cloud)

- [ ] Exportar variáveis de ambiente
  ```bash
  export PG_URL_ORIG="postgresql://..."
  ```
- [ ] Executar dump_db.sh
  ```bash
  ./dump_db.sh
  ```
- [ ] Verificar arquivo de dump gerado
- [ ] Verificar lista de extensions
- [ ] Verificar estatísticas de tabelas

### Fase 2: Transferência para VPS

- [ ] Exportar variáveis SSH
  ```bash
  export SSH_HOST="..."
  export SSH_USER="root"
  ```
- [ ] Executar transfer_dump.sh
  ```bash
  ./transfer_dump.sh
  ```
- [ ] Verificar arquivos transferidos na VPS
- [ ] Verificar checksums

### Fase 3: Restore do Banco (VPS)

- [ ] SSH para VPS
  ```bash
  ssh root@<VPS_HOST>
  ```
- [ ] Exportar variáveis de ambiente
  ```bash
  export PG_URL_DEST="postgresql://..."
  ```
- [ ] Executar recreate_extensions.sql (se necessário)
- [ ] Executar migrate_db.sh
  ```bash
  ./migrate_db.sh
  ```
- [ ] Verificar logs de restore
- [ ] Executar verify_counts.sh

### Fase 4: Migração do Storage

- [ ] Exportar variáveis do Storage
  ```bash
  export SUPABASE_URL_ORIG="https://..."
  export SUPABASE_SERVICE_KEY_ORIG="eyJ..."
  export SUPABASE_URL_DEST="https://..."
  export SUPABASE_SERVICE_KEY_DEST="eyJ..."
  export BUCKETS_LIST="avatars,documents,uploads"
  ```
- [ ] Executar copy_storage.js
  ```bash
  node copy_storage.js
  ```
- [ ] Verificar log de migração
- [ ] Confirmar objetos copiados

### Fase 5: Configuração de Edge Functions

- [ ] Copiar código das Edge Functions para VPS
- [ ] Configurar secrets no ambiente self-hosted
- [ ] Deploy das functions
- [ ] Testar cada function

---

## 🟢 PÓS-MIGRAÇÃO

### Verificações Imediatas

- [ ] Executar healthcheck_tests.sh
  ```bash
  ./healthcheck_tests.sh
  ```
- [ ] Verificar conectividade REST API
- [ ] Verificar autenticação (signup/login)
- [ ] Verificar queries ao banco
- [ ] Verificar upload/download no storage
- [ ] Verificar realtime (se aplicável)
- [ ] Verificar Edge Functions

### Comparação de Dados

- [ ] Executar verify_counts.sh
- [ ] Comparar contagens com origem
- [ ] Verificar tabelas críticas:
  - [ ] profiles
  - [ ] user_roles
  - [ ] user_subscriptions
  - [ ] m3u_sync_entries
  - [ ] m3u_channels

### Atualização de Configurações

- [ ] Atualizar variáveis de ambiente do frontend
  ```env
  VITE_SUPABASE_URL={{SUPABASE_URL_DEST}}
  VITE_SUPABASE_ANON_KEY={{SUPABASE_ANON_KEY_DEST}}
  ```
- [ ] Atualizar variáveis de ambiente do backend
- [ ] Atualizar webhooks externos (MercadoPago, WhatsApp)
- [ ] Atualizar DNS (se aplicável)

### Testes Funcionais

- [ ] Login de usuário existente
- [ ] Cadastro de novo usuário
- [ ] Visualização de dados
- [ ] Upload de arquivo
- [ ] Pagamento (ambiente de teste)
- [ ] Notificações WhatsApp (se aplicável)

### Limpeza e Segurança

- [ ] Remover dumps do servidor local
- [ ] Remover dumps da VPS
- [ ] Rotacionar senhas/keys se expostas
- [ ] Revogar acessos temporários
- [ ] Documentar nova arquitetura

---

## 🔄 CUTOVER (Troca Final)

### Preparação

- [ ] Confirmar que todos os testes passaram
- [ ] Definir horário de cutover
- [ ] Preparar comunicação aos usuários

### Execução

- [ ] Ativar modo manutenção (se disponível)
- [ ] Fazer sync final de dados (se necessário)
- [ ] Atualizar DNS para apontar para nova instância
- [ ] Atualizar configurações de produção
- [ ] Deploy da aplicação com novas configurações

### Verificação Final

- [ ] Testar aplicação em produção
- [ ] Monitorar logs por 30 minutos
- [ ] Confirmar funcionamento com usuários-chave
- [ ] Desativar modo manutenção

---

## 🚨 ROLLBACK (Se Necessário)

Se algo der errado, siga o plano em `rollback_plan.md`:

1. [ ] Reverter DNS para Supabase Cloud
2. [ ] Restaurar variáveis de ambiente originais
3. [ ] Deploy com configuração original
4. [ ] Verificar funcionamento
5. [ ] Documentar problema encontrado

---

## 📊 Métricas de Sucesso

| Métrica | Esperado | Obtido |
|---------|----------|--------|
| Tabelas migradas | 100% | ___% |
| Registros migrados | 100% | ___% |
| Storage migrado | 100% | ___% |
| Tests passando | 100% | ___% |
| Downtime | < 1h | ___ min |

---

## 📝 Notas e Observações

```
Espaço para anotações durante a migração:




```

---

## ✍️ Assinaturas

| Papel | Nome | Data | Assinatura |
|-------|------|------|------------|
| Executor | | | |
| Revisor | | | |
| Aprovador | | | |
