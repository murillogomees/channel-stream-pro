# Sistema de Notificações Automáticas - Setup Completo

## 🎯 Visão Geral

Este sistema garante que **todas** as notificações WhatsApp sejam enviadas com certeza, usando:

- ✅ **Edge Functions** rodando via cron jobs (não depende de usuários online)
- ✅ **Fila persistente** no banco de dados
- ✅ **Sistema de retry** automático para falhas
- ✅ **Logs completos** de todas as tentativas
- ✅ **Agendamento diário** automático

## 📋 Pré-requisitos

1. Credenciais BotBot configuradas em Admin → Integrações
2. Templates de WhatsApp criados
3. Extensões `pg_cron` e `pg_net` habilitadas no Supabase

## 🚀 Instalação dos Cron Jobs

Execute o SQL abaixo no **SQL Editor** do Supabase:

```sql
-- ============================================
-- CRON JOB 1: Agendar notificações diárias
-- Roda todo dia às 6:00 AM
-- ============================================
SELECT cron.schedule(
  'schedule-daily-notifications',
  '0 6 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/schedule-daily-notifications',
      headers:='{"Content-Type": "application/json", "x-supabase-cron-secret": "' || current_setting('app.settings.cron_secret') || '"}'::jsonb
    ) as request_id;
  $$
);

-- ============================================
-- CRON JOB 2: Processar fila de notificações
-- Roda a cada 5 minutos
-- ============================================
SELECT cron.schedule(
  'process-notification-queue',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/process-notification-queue',
      headers:='{"Content-Type": "application/json", "x-supabase-cron-secret": "' || current_setting('app.settings.cron_secret') || '"}'::jsonb
    ) as request_id;
  $$
);

-- ============================================
-- Verificar se os cron jobs foram criados
-- ============================================
SELECT * FROM cron.job;

-- ============================================
-- Ver histórico de execuções (últimas 24h)
-- ============================================
SELECT 
  job_id,
  jobname,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE start_time > now() - interval '24 hours'
ORDER BY start_time DESC;
```

## 📊 Como Funciona

### 1. Agendamento Diário (6:00 AM)

A função `schedule-daily-notifications`:

- Verifica todos os clientes ativos
- Calcula dias até vencimento
- Agenda notificações para quem deve receber hoje
- Evita duplicatas

### 2. Processamento da Fila (a cada 5 min)

A função `process-notification-queue`:

- Busca notificações agendadas pendentes
- Envia via WhatsApp (BotBot API)
- Marca como enviada ou agenda retry
- Registra logs completos

### 3. Sistema de Retry

- Máximo de 3 tentativas por notificação
- Falhas temporárias = nova tentativa em 5 min
- Falhas definitivas = marcadas como "failed"

## 🔍 Monitoramento

### Ver notificações agendadas para hoje:

```sql
SELECT 
  ns.*,
  c.nome,
  c.telefone,
  c.data_vencimento
FROM notification_schedule ns
JOIN clientes c ON c.id = ns.cliente_id
WHERE DATE(ns.scheduled_for) = CURRENT_DATE
ORDER BY ns.scheduled_for;
```

### Ver logs de envios:

```sql
SELECT 
  *
FROM notification_logs
WHERE sent_at > now() - interval '24 hours'
ORDER BY sent_at DESC;
```

### Estatísticas do dia:

```sql
SELECT 
  status,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE attempts > 1) as com_retry
FROM notification_schedule
WHERE DATE(scheduled_for) = CURRENT_DATE
GROUP BY status;
```

## 🛠️ Comandos Úteis

### Forçar reprocessamento de falhas:

```sql
UPDATE notification_schedule
SET status = 'pending', attempts = 0
WHERE status = 'failed' 
  AND DATE(scheduled_for) = CURRENT_DATE;
```

### Limpar notificações antigas (>30 dias):

```sql
DELETE FROM notification_schedule
WHERE created_at < now() - interval '30 days'
  AND status IN ('sent', 'failed');
```

### Pausar cron jobs:

```sql
-- Pausar agendamento diário
SELECT cron.unschedule('schedule-daily-notifications');

-- Pausar processamento da fila
SELECT cron.unschedule('process-notification-queue');
```

## ⚙️ Configuração

A configuração é feita em **Admin → Notificações Automáticas**:

- **Habilitado**: Liga/desliga o sistema
- **Hora de envio**: Quando agendar as notificações
- **Dias para notificar**: Ex: [7, 3, 1, 0, -3]

## 🎯 Garantias do Sistema

✅ **Não depende de navegador aberto**
✅ **Retry automático em falhas**
✅ **Logs completos para auditoria**
✅ **Evita duplicatas**
✅ **Processa em lotes (50 por vez)**
✅ **Monitoramento via Supabase Dashboard**

## 📞 Suporte

Em caso de problemas:

1. Verificar logs das edge functions no Supabase
2. Verificar tabela `notification_schedule` para status
3. Verificar tabela `notification_logs` para histórico
4. Verificar `cron.job_run_details` para execuções dos cron jobs
