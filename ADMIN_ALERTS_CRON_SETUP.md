# Configuração dos Alertas Administrativos Automáticos

Este documento explica como configurar os alertas administrativos automáticos: resumos diários, semanais e alertas em tempo real.

## ✅ O Que Já Foi Implementado

### 1. Alertas em Tempo Real
- ✅ Serviço `adminNotificationService.ts` criado
- ✅ Integrado ao `NotificationService` para alertar admins a cada mensagem enviada
- ✅ Alertas incluem: nome do cliente, telefone, template usado, status (sucesso/erro) e timestamp
- ✅ **Já está funcionando automaticamente** - não requer configuração adicional

### 2. Estrutura de Dados
- ✅ Campo `is_recorrente` adicionado na tabela `clientes`
- ✅ View `vw_expiration_summary` criada para facilitar resumos
- ✅ **Já está disponível** - pode começar a marcar clientes como recorrentes

### 3. Edge Functions
- ✅ `daily-expiration-summary` - Resumo diário de vencimentos
- ✅ `weekly-expiration-summary` - Resumo semanal às segundas-feiras
- ✅ **Já deployadas** - aguardando apenas configuração dos cron jobs

---

## 🔧 Configuração Necessária: Cron Jobs

Para que os resumos automáticos funcionem, você precisa configurar 2 cron jobs no Supabase.

### Pré-requisitos

1. Acesse o Supabase Dashboard: https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd
2. Vá em **SQL Editor**
3. Certifique-se de que as extensions `pg_cron` e `pg_net` estão habilitadas

```sql
-- Verificar extensions (executar primeiro)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

---

## 📊 Resumo Diário (08:00 todos os dias)

Execute o SQL abaixo no **SQL Editor** do Supabase:

```sql
-- Agendar resumo diário de vencimentos
SELECT cron.schedule(
  'daily-expiration-summary',
  '0 8 * * *', -- 08:00 todos os dias
  $$
  SELECT net.http_post(
    url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/daily-expiration-summary',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

**O que este resumo inclui:**
- 📋 Total de clientes com vencimento no dia
- 🟢 Clientes ativos (com detalhes: nome, plano, valor, se é recorrente, último pagamento)
- 🟡 Clientes em período de teste
- 🔴 Clientes devendo
- 💵 Total de receita esperada para o dia

---

## 📅 Resumo Semanal (08:00 todas as segundas-feiras)

Execute o SQL abaixo no **SQL Editor** do Supabase:

```sql
-- Agendar resumo semanal de vencimentos
SELECT cron.schedule(
  'weekly-expiration-summary',
  '0 8 * * 1', -- 08:00 todas as segundas-feiras
  $$
  SELECT net.http_post(
    url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/weekly-expiration-summary',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

**O que este resumo inclui:**
- 📊 Total de vencimentos nos próximos 7 dias
- 📍 Resumo por dia da semana (quantos clientes, receita esperada)
- 🎯 Destaques:
  - ⭐ Quantidade de clientes recorrentes
  - 💰 Cliente com maior valor
  - ⚠️ Clientes em risco (devendo)
- 💵 Projeção total de receita para a semana

---

## 🔍 Verificar Cron Jobs

Para verificar se os cron jobs foram criados corretamente:

```sql
-- Listar cron jobs ativos
SELECT * FROM cron.job 
WHERE jobname IN ('daily-expiration-summary', 'weekly-expiration-summary');

-- Ver histórico de execuções
SELECT * FROM cron.job_run_details 
WHERE jobid IN (
  SELECT jobid FROM cron.job 
  WHERE jobname IN ('daily-expiration-summary', 'weekly-expiration-summary')
)
ORDER BY start_time DESC 
LIMIT 20;
```

---

## 🧪 Testar Manualmente (Recomendado)

Antes de aguardar o horário agendado, você pode testar as functions manualmente:

### Testar Resumo Diário:
```sql
SELECT net.http_post(
  url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/daily-expiration-summary',
  headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak"}'::jsonb,
  body:='{}'::jsonb
);
```

### Testar Resumo Semanal:
```sql
SELECT net.http_post(
  url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/weekly-expiration-summary',
  headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak"}'::jsonb,
  body:='{}'::jsonb
);
```

**Nota:** Você receberá as mensagens WhatsApp imediatamente se houver vencimentos nos períodos correspondentes.

---

## ⚙️ Personalizar Horários (Opcional)

Caso queira alterar os horários dos resumos:

### Formato Cron:
```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Dia da semana (0-7, 0 e 7 = Domingo)
│ │ │ └───── Mês (1-12)
│ │ └─────── Dia do mês (1-31)
│ └───────── Hora (0-23)
└─────────── Minuto (0-59)
```

### Exemplos:
- `0 8 * * *` - 08:00 todos os dias
- `0 8 * * 1` - 08:00 todas as segundas
- `30 9 * * *` - 09:30 todos os dias
- `0 10 * * 1-5` - 10:00 de segunda a sexta

Para alterar, remova o cron job antigo e crie um novo:

```sql
-- Remover
SELECT cron.unschedule('daily-expiration-summary');

-- Criar com novo horário (exemplo: 10:00)
SELECT cron.schedule(
  'daily-expiration-summary',
  '0 10 * * *', -- 10:00
  -- ... resto do código
);
```

---

## 🎯 Marcar Clientes como Recorrentes

Para marcar um cliente como recorrente (pagamento automático), atualize o registro:

```sql
-- Marcar cliente como recorrente
UPDATE clientes 
SET is_recorrente = true 
WHERE id = 'ID_DO_CLIENTE';

-- Desmarcar
UPDATE clientes 
SET is_recorrente = false 
WHERE id = 'ID_DO_CLIENTE';
```

Ou através da interface de edição de clientes no admin dashboard (adicione um checkbox no formulário).

---

## 📋 Checklist de Implementação

- [x] Alertas em tempo real implementados ✅ (já funcionando)
- [x] Campo `is_recorrente` adicionado ✅
- [x] View `vw_expiration_summary` criada ✅
- [x] Edge Functions deployadas ✅
- [ ] **Configurar cron job diário** ⏳ (execute o SQL acima)
- [ ] **Configurar cron job semanal** ⏳ (execute o SQL acima)
- [ ] Testar resumo diário manualmente
- [ ] Testar resumo semanal manualmente
- [ ] Aguardar próxima execução agendada

---

## 🚨 Troubleshooting

### Resumos não estão sendo enviados

1. Verifique se os cron jobs estão ativos:
```sql
SELECT * FROM cron.job WHERE jobname LIKE '%expiration-summary%';
```

2. Verifique erros nas execuções:
```sql
SELECT * FROM cron.job_run_details 
WHERE status = 'failed'
ORDER BY start_time DESC;
```

3. Verifique se há telefones de admin ativos:
```sql
SELECT * FROM admin_phones WHERE active = true;
```

4. Verifique logs das Edge Functions no Supabase Dashboard

### Credenciais WhatsApp não configuradas

Se receber erro sobre WhatsApp, verifique as secrets no Supabase:
- `WHATSAPP_APPKEY`
- `WHATSAPP_AUTHKEY`

---

## 📞 Suporte

Para qualquer dúvida ou problema:
1. Verifique os logs das Edge Functions no Supabase Dashboard
2. Consulte a tabela `activity_logs` para histórico de envios
3. Revise este documento completamente antes de reportar problemas

---

**Última atualização:** 19/11/2024
**Versão:** 1.0
