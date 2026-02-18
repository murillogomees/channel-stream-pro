

# Arquitetura Sigma Blaze - Controle Admin + Automacoes + Mapeamento de Pacotes

## Resumo

Implementar integracao completa com Sigma Blaze, controlavel via painel admin sem deploy, incluindo: feature flags dinamicas no banco, service layer para gerenciamento de clientes, mapeamento de pacotes interno-Sigma, e fluxo WhatsApp manual.

---

## Fase 1: Banco de Dados (Migrations)

### 1.1 Inserir Feature Flags do Sigma Blaze na tabela `feature_flag_config`

A tabela ja existe. Inserir 4 flags:

| flag_name | enabled | percentage | description |
|---|---|---|---|
| SIGMA_AUTO_CREATE_CLIENT | false | 0 | Criacao automatica de cliente no Sigma Blaze |
| SIGMA_AUTO_DELETE_CLIENT | false | 0 | Exclusao automatica de cliente no Sigma Blaze |
| SIGMA_AUTO_UPDATE_PACKAGE | false | 0 | Atualizacao automatica de pacote no Sigma Blaze |
| SIGMA_WHATSAPP_ACTIVATION | false | 0 | Fluxo de ativacao via WhatsApp (modo manual) |

### 1.2 Criar tabela `sigma_blaze_config`

Armazena credenciais e configuracao da API Sigma Blaze:

- `id` (uuid, PK)
- `api_url` (text) -- URL base da API Sigma Blaze
- `api_key` (text) -- chave de autenticacao
- `admin_whatsapp_number` (text) -- numero WhatsApp para ativacao manual
- `whatsapp_message_template` (text, default "Ola, quero ativar meu acesso.")
- `is_active` (boolean, default false)
- `created_at`, `updated_at`

RLS: somente admin/master pode ler e escrever.

### 1.3 Criar tabela `subscription_package_mapping`

Vincula pacotes internos aos packages do Sigma Blaze:

- `id` (uuid, PK)
- `internal_plan_id` (uuid, FK -> subscription_plans.id)
- `internal_plan_name` (text)
- `sigma_package_id` (text) -- ID do pacote no Sigma Blaze
- `sigma_package_name` (text)
- `is_active` (boolean, default true)
- `created_at`, `updated_at`

Constraint: UNIQUE(internal_plan_id).
RLS: somente admin/master.

### 1.4 Criar tabela `sigma_blaze_logs`

Logs padronizados de todas as operacoes:

- `id` (uuid, PK)
- `action` (text) -- CREATE_CLIENT, DELETE_CLIENT, UPDATE_PACKAGE, SYNC_CLIENT
- `status` (text) -- SUCCESS, ERROR, SKIPPED_BY_FEATURE_FLAG
- `user_id` (uuid, nullable)
- `details` (jsonb)
- `created_at`

RLS: somente admin/master pode ler.

---

## Fase 2: Edge Function - `sigma-blaze-client`

Criar edge function `supabase/functions/sigma-blaze-client/index.ts` com as actions:

- **create** -- Cria cliente no Sigma Blaze (verifica flag SIGMA_AUTO_CREATE_CLIENT)
- **delete** -- Remove cliente (verifica flag SIGMA_AUTO_DELETE_CLIENT)
- **update-package** -- Atualiza pacote (verifica flag SIGMA_AUTO_UPDATE_PACKAGE, consulta mapping)
- **sync** -- Sincroniza dados

Fluxo interno de cada action:
1. Ler flag da tabela `feature_flag_config`
2. Se desabilitada: logar com status SKIPPED_BY_FEATURE_FLAG e retornar
3. Se habilitada: executar chamada a API Sigma Blaze
4. Logar resultado em `sigma_blaze_logs`

Para update-package:
1. Buscar `subscription_package_mapping` pelo `internal_plan_id`
2. Se nao existir mapping: logar erro e NAO executar
3. Se existir: chamar Sigma Blaze com `sigma_package_id`

---

## Fase 3: Integracao com Webhook de Pagamento

Modificar `supabase/functions/mercado-pago-webhook/index.ts`:

Apos pagamento aprovado (linha ~496), adicionar chamada ao `sigma-blaze-client`:
- Se `SIGMA_AUTO_CREATE_CLIENT` ativada: criar cliente
- Se `SIGMA_AUTO_UPDATE_PACKAGE` ativada: atualizar pacote

Apos cancelamento/refund:
- Se `SIGMA_AUTO_DELETE_CLIENT` ativada: deletar cliente

A chamada sera feita via `fetch` direto para a edge function, nao pela UI.

---

## Fase 4: Painel Admin - Aba Sigma Blaze

### 4.1 Novo componente `SigmaBlazeIntegration`

Adicionar como nova aba em `AdminIntegracaoPage.tsx`:

Secoes do componente:

**Configuracao da API**
- Campo URL da API
- Campo API Key
- Campo numero WhatsApp do admin
- Template de mensagem WhatsApp
- Botao testar conexao

**Feature Flags (automacoes)**
- 4 switches (leem/escrevem na `feature_flag_config`):
  - Auto Create Client
  - Auto Delete Client  
  - Auto Update Package
  - WhatsApp Activation Mode

**Mapeamento de Pacotes**
- Tabela mostrando os 4 planos internos (Mensal, Trimestral, Semestral, Anual)
- Para cada plano: campo para informar `sigma_package_id` e `sigma_package_name`
- Status ativo/inativo por mapping
- Botao salvar

**Logs**
- Lista dos ultimos 50 logs de `sigma_blaze_logs`
- Filtro por action e status

### 4.2 Fluxo WhatsApp Manual

Quando `SIGMA_WHATSAPP_ACTIVATION` = true:
- Na tela de pos-pagamento, exibir botao "Ativar pelo WhatsApp"
- Ao clicar: abre `https://wa.me/{numero}?text={mensagem_template}`
- Numero e template vem da tabela `sigma_blaze_config`

---

## Fase 5: Service Layer (Frontend)

Criar `src/services/sigmaBlaze/sigmaBlazeService.ts`:

- `getConfig()` -- le configuracao do banco
- `getFlags()` -- le flags do banco
- `getPackageMappings()` -- le mapeamentos
- `saveConfig()` -- salva configuracao
- `saveMapping()` -- salva mapeamento
- `getLogs()` -- busca logs
- `triggerAction(action, userId)` -- chama edge function manualmente

Todas as chamadas passam pelo banco, nunca diretamente para API Sigma.

---

## Detalhes Tecnicos

### Arquivos a criar:
1. `supabase/functions/sigma-blaze-client/index.ts` -- Edge function principal
2. `src/services/sigmaBlaze/sigmaBlazeService.ts` -- Service layer
3. `src/components/admin/sigma/SigmaBlazeIntegration.tsx` -- Painel admin completo
4. `src/components/admin/sigma/SigmaPackageMapping.tsx` -- Tabela de mapeamento
5. `src/components/admin/sigma/SigmaLogsViewer.tsx` -- Visualizador de logs
6. `src/components/admin/sigma/SigmaFeatureFlags.tsx` -- Controle de flags

### Arquivos a modificar:
1. `src/pages/admin/AdminIntegracaoPage.tsx` -- Adicionar aba "Sigma Blaze"
2. `supabase/functions/mercado-pago-webhook/index.ts` -- Integrar chamada pos-pagamento

### Secrets necessarios:
- Nenhum novo (API key armazenada no banco via `sigma_blaze_config`, acessivel pela edge function via service role)

### Seguranca:
- Todas as tabelas novas com RLS restrito a admin/master via `is_admin_or_master()`
- Edge function valida JWT antes de executar
- API key do Sigma nunca exposta ao frontend (leitura mascarada)

