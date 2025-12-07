# 🔄 Supabase Cloud ↔ Local Sync

Scripts para sincronizar dados entre Supabase Cloud (produção) e Supabase Local (desenvolvimento).

## 📋 Pré-requisitos

1. **PostgreSQL Client** (psql, pg_dump)
   ```bash
   # macOS
   brew install postgresql
   
   # Ubuntu/Debian
   sudo apt-get install postgresql-client
   
   # Windows
   # Instale o PostgreSQL e adicione ao PATH
   ```

2. **Supabase CLI** (para ambiente local)
   ```bash
   npm install -g supabase
   # ou
   brew install supabase/tap/supabase
   ```

3. **Docker Desktop** (para Supabase local)
   - [Download Docker Desktop](https://www.docker.com/products/docker-desktop)

## 🚀 Quick Start

### 1. Configurar Ambiente Local

```bash
# Na raiz do projeto
supabase start

# Isso irá:
# - Iniciar containers Docker (PostgreSQL, GoTrue, Storage, etc)
# - Aplicar todas as migrations existentes
# - Exibir URLs e chaves locais
```

### 2. Configurar Credenciais

```bash
cd scripts

# Copiar template de configuração
cp sync-config.env.example sync-config.env

# Editar com suas credenciais
nano sync-config.env  # ou seu editor preferido
```

**Importante:** Obtenha a senha do banco Cloud em:
https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/settings/database

### 3. Exportar do Cloud

```bash
# Exportar todas as tabelas (exceto logs)
./supabase-export.sh --all

# Exportar apenas tabelas críticas
./supabase-export.sh --critical-only

# Exportar tabelas específicas
./supabase-export.sh --tables profiles,user_roles,clientes

# Dry-run (ver o que seria exportado)
./supabase-export.sh --all --dry-run
```

### 4. Importar no Local

```bash
# Importar do último export
./supabase-import.sh --dir exports/2025-12-07_10-30-00

# Usar arquivo combinado (mais rápido)
./supabase-import.sh --dir exports/2025-12-07_10-30-00 --combined

# Importar tabelas específicas
./supabase-import.sh --dir exports/latest --tables profiles,user_roles
```

## 📁 Estrutura de Arquivos

```
scripts/
├── supabase-export.sh      # Script principal de export
├── supabase-import.sh      # Script principal de import
├── export-tables.sql       # Queries SQL para export via COPY
├── import-tables.sql       # Queries SQL para import via COPY
├── sync-config.env.example # Template de configuração
├── sync-config.env         # Suas configurações (não commitar!)
├── README-sync.md          # Esta documentação
└── exports/                # Diretório com exports (auto-criado)
    └── 2025-12-07_10-30-00/
        ├── profiles.sql
        ├── user_roles.sql
        ├── m3u_sync_entries.sql.gz  # Comprimido
        ├── combined_import.sql      # Script combinado
        └── manifest.json            # Metadados do export
```

## 📊 Categorias de Tabelas

### 🔴 Críticas (Sempre exportar)
Dados essenciais para o funcionamento do sistema:
- `profiles` - Usuários unificados
- `user_roles` - Permissões
- `clientes` - Dados legados
- `subscription_plans` - Planos de assinatura
- `user_subscriptions` - Assinaturas ativas
- `whatsapp_config` - Configuração WhatsApp
- `mercado_pago_config` - Configuração pagamentos
- `app_feature_flags` - Feature flags
- `admin_phones` - Telefones admin
- `affiliates` - Afiliados
- `discount_coupons` - Cupons

### 🟡 Conteúdo (Exportar para ambiente completo)
Dados de conteúdo M3U e EPG:
- `m3u_sync_sources` - Fontes M3U
- `m3u_sync_entries` - Entries sincronizados (~209k registros)
- `m3u_custom_lists` - Listas customizadas
- `m3u_categories` - Categorias
- `m3u_channels` - Canais (~23k registros)
- `content_metadata` - Metadados
- `epg_data` - Programação

### 🟢 Opcionais (Logs - geralmente excluídos)
Dados de auditoria e métricas:
- `activity_logs` - Logs de atividade
- `auth_sessions_log` - Logs de sessão
- `metrics_snapshots` - Métricas
- `health_snapshots` - Health checks
- `r2_migration_logs` - Logs de migração R2

## 🔧 Opções dos Scripts

### supabase-export.sh

| Opção | Descrição |
|-------|-----------|
| `--all` | Exportar todas as tabelas |
| `--critical-only` | Apenas tabelas críticas |
| `--content-only` | Apenas tabelas de conteúdo |
| `--tables T1,T2` | Tabelas específicas |
| `--exclude-logs` | Excluir logs (padrão) |
| `--include-logs` | Incluir logs |
| `--dry-run` | Simular sem executar |
| `--compress` | Comprimir arquivos >10MB |

### supabase-import.sh

| Opção | Descrição |
|-------|-----------|
| `--dir DIRECTORY` | Diretório com exports |
| `--file FILE` | Arquivo SQL único |
| `--combined` | Usar combined_import.sql |
| `--tables T1,T2` | Tabelas específicas |
| `--dry-run` | Simular sem executar |
| `--no-truncate` | Não limpar antes |
| `--force` | Continuar em caso de erro |

## ⚠️ Considerações Importantes

### Dados de Autenticação
Os usuários em `auth.users` são gerenciados pelo Supabase Auth e **não são exportados**. Para ambiente local:
- Crie usuários manualmente via `supabase auth signup`
- Ou use o Supabase Dashboard local: http://localhost:54323

### Storage e CDN
Arquivos no Cloudflare R2 e Storage **não são migrados** por este script. O storage local é separado.

### Secrets e Configurações
Secrets de produção (API keys, tokens) **não devem** ser usados em desenvolvimento. Configure secrets locais:
```bash
# Criar arquivo de secrets para Edge Functions locais
cat > supabase/.env.local << EOF
CLOUDFLARE_R2_ACCESS_KEY_ID=local_key
MERCADOPAGO_ACCESS_TOKEN=TEST-xxx
WHATSAPP_TOKEN=local_token
EOF
```

### Foreign Keys
Os scripts respeitam a ordem de dependência de foreign keys. Se encontrar erros:
1. Use `--force` para continuar
2. Verifique se todas as tabelas dependentes foram exportadas

## 🔄 Workflow Recomendado

```bash
# 1. Atualizar ambiente local com dados de produção
./supabase-export.sh --critical-only
./supabase-import.sh --dir exports/latest --combined

# 2. Desenvolver localmente
supabase functions serve
npm run dev

# 3. Quando precisar de dados de conteúdo completos
./supabase-export.sh --all --compress
./supabase-import.sh --dir exports/latest

# 4. Resetar ambiente local (limpar tudo)
supabase db reset  # Aplica migrations do zero
./supabase-import.sh --dir exports/latest  # Reimporta dados
```

## 🐛 Troubleshooting

### "Connection refused"
```bash
# Verificar se Supabase local está rodando
supabase status

# Se não estiver, iniciar
supabase start
```

### "Permission denied" nos scripts
```bash
chmod +x supabase-export.sh supabase-import.sh
```

### "FATAL: password authentication failed"
Verifique a senha do banco em `sync-config.env`. Para o Cloud, obtenha em:
https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/settings/database

### Arquivos muito grandes
Use a opção `--compress` no export para comprimir automaticamente.

### Timeout em tabelas grandes
Aumente o timeout em `sync-config.env`:
```env
QUERY_TIMEOUT=600
```

## 📝 Notas

- Os exports são salvos com timestamp para histórico
- O arquivo `manifest.json` contém checksums para verificação
- Use `--dry-run` antes de operações destrutivas
- Mantenha `sync-config.env` fora do git (já está no .gitignore)
