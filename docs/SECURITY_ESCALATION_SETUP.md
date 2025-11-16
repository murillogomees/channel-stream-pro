# 🚨 Setup do Sistema de Escalonamento de Alertas

## Pré-requisitos

O sistema de escalonamento automático requer que as extensões `pg_cron` e `pg_net` estejam habilitadas no Supabase.

### 1. Habilitar Extensões

Acesse o SQL Editor do Supabase e execute:

```sql
-- Habilitar pg_cron (se ainda não estiver habilitado)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Habilitar pg_net (se ainda não estiver habilitado)
CREATE EXTENSION IF NOT EXISTS pg_net;
```

**Link**: [Supabase SQL Editor](https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/sql/new)

### 2. Configurar Cron Job

Execute o SQL abaixo para configurar a verificação automática de alertas a cada 5 minutos:

```sql
-- Remover job anterior se existir
SELECT cron.unschedule('escalate-security-alerts-job');

-- Criar job de escalonamento (executa a cada 5 minutos)
SELECT cron.schedule(
  'escalate-security-alerts-job',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT
    net.http_post(
        url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/escalate-security-alerts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak"}'::jsonb,
        body:='{"timestamp": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);
```

### 3. Verificar Status do Job

Para verificar se o job está ativo:

```sql
SELECT * FROM cron.job;
```

Para ver o histórico de execuções:

```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'escalate-security-alerts-job')
ORDER BY start_time DESC
LIMIT 10;
```

## Como Funciona

1. **Envio Inicial**: Quando um alerta crítico é enviado, ele é registrado na tabela `security_alert_deliveries`

2. **Verificação Automática**: A cada 5 minutos, o edge function `escalate-security-alerts` é executado via cron

3. **Detecção de Não Confirmados**: O sistema busca alertas não confirmados que excedem o tempo limite configurado nas regras

4. **Escalonamento**: Alertas não confirmados são reencaminhados para:
   - Todos os admins ativos (se ação = `notify_all`)
   - Admins secundários específicos (se ação = `notify_secondary`)

5. **Marcação**: Alertas escalonados são marcados para evitar reenvios duplicados

## Configuração de Regras

Acesse `/admin/security-escalation` para:

- **Criar novas regras** por tipo de evento e severidade
- **Configurar tempo de espera** antes do escalonamento
- **Definir admins secundários** para escalonamento direcionado
- **Ativar/Desativar regras** conforme necessário

## Estrutura das Tabelas

### `security_alert_deliveries`
Rastreia cada envio de alerta:
- `sent_at`: Quando foi enviado
- `confirmed_at`: Quando foi confirmado (null = não confirmado)
- `escalated`: Se já foi escalonado
- `delivery_status`: sent, confirmed, escalated, failed

### `security_alert_escalation_rules`
Define regras de escalonamento:
- `event_type`: Tipo do evento de segurança
- `severity_level`: critical, warning, info
- `time_window_minutes`: Tempo antes de escalar
- `escalation_action`: notify_all ou notify_secondary
- `secondary_admin_ids`: Lista de admins para notificar

## Logs e Monitoramento

Verifique os logs do edge function:

**Link**: [Logs do escalate-security-alerts](https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/functions/escalate-security-alerts/logs)

## Testando o Sistema

1. Acesse `/admin/security-alerts` e configure admins
2. Crie ou edite uma regra em `/admin/security-escalation`
3. Configure um tempo curto (ex: 2 minutos) para teste
4. Dispare um evento de segurança crítico
5. Aguarde o tempo configurado sem confirmar
6. Verifique se o alerta foi escalonado nos logs

## Troubleshooting

**Alertas não estão sendo escalonados?**
- Verifique se o cron job está ativo: `SELECT * FROM cron.job`
- Verifique se há erros nos logs do edge function
- Confirme que as extensões pg_cron e pg_net estão habilitadas
- Verifique se as regras estão ativas em `/admin/security-escalation`

**Alertas sendo escalonados múltiplas vezes?**
- Verifique se há múltiplos jobs ativos: `SELECT * FROM cron.job WHERE jobname LIKE '%escalate%'`
- Remova jobs duplicados com `SELECT cron.unschedule('job-name')`

**WhatsApp não envia mensagens escalonadas?**
- Verifique se WHATSAPP_APPKEY e WHATSAPP_AUTHKEY estão configurados
- Teste o envio manual em `/admin/security-alerts`
- Verifique os logs do edge function para erros de API
