# Configuração de Alertas Automáticos de Playlists Inativas

Este documento explica como configurar alertas automáticos via WhatsApp quando playlists ficarem inativas.

## Como Funciona

O sistema monitora automaticamente a saúde das playlists M3U e envia alertas via WhatsApp para todos os administradores cadastrados quando playlists apresentam erros.

## Pré-requisitos

1. ✅ Credenciais WhatsApp configuradas (BotBot.chat)
2. ✅ Telefones de administradores cadastrados na tabela `admin_phones`
3. ✅ Extension `pg_cron` e `pg_net` habilitadas no Supabase

## Configuração do Cron Job

### 1. Habilitar Extensions no Supabase

Execute no SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2. Criar Cron Job para Alertas

Execute o SQL abaixo no **SQL Editor** do Supabase (substitua pelos seus valores):

```sql
-- Executar verificação a cada 30 minutos
SELECT cron.schedule(
  'alert-inactive-playlists',
  '*/30 * * * *', -- A cada 30 minutos
  $$
  SELECT net.http_post(
    url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/alert-inactive-playlists',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

## Frequências Recomendadas

- **A cada 30 minutos**: `*/30 * * * *` (Recomendado)
- **A cada hora**: `0 * * * *`
- **A cada 2 horas**: `0 */2 * * *`
- **Apenas horário comercial**: `0 9-18 * * 1-5` (9h-18h, Seg-Sex)

## Verificar Status do Cron Job

```sql
-- Ver cron jobs ativos
SELECT * FROM cron.job;

-- Ver histórico de execuções
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'alert-inactive-playlists')
ORDER BY start_time DESC 
LIMIT 10;
```

## Desabilitar Alertas Temporariamente

```sql
-- Desabilitar cron job
SELECT cron.unschedule('alert-inactive-playlists');
```

## Re-habilitar Alertas

Basta executar novamente o comando `cron.schedule` da seção 2.

## Formato do Alerta WhatsApp

Os administradores receberão uma mensagem como:

```
🚨 *ALERTA: Playlists Inativas*

Foram detectadas *3 playlists com erro*.

*Clientes afetados:*
• João Silva (Mensal)
• Maria Santos (Trimestral)
• Pedro Costa (Anual)

⚠️ Verifique o painel de Saúde das Playlists para mais detalhes.

_Verificação automática - 17/11/2025 14:30_
```

## Logs de Atividade

Todos os alertas enviados são registrados na tabela `activity_logs` com:
- Tipo de ação: `playlist_alert_sent`
- Descrição: Nome do admin notificado
- Metadata: Número de playlists com erro e clientes afetados

## Troubleshooting

### Alertas não estão sendo enviados

1. Verifique se o cron job está ativo:
```sql
SELECT * FROM cron.job WHERE jobname = 'alert-inactive-playlists';
```

2. Verifique logs de execução:
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'alert-inactive-playlists')
ORDER BY start_time DESC;
```

3. Teste a edge function manualmente via Supabase Dashboard > Edge Functions

### Credenciais WhatsApp não configuradas

Verifique se as secrets estão definidas:
- `WHATSAPP_APPKEY`
- `WHATSAPP_AUTHKEY`

### Nenhum admin cadastrado

Cadastre telefones em `/admin/security-alerts` ou diretamente:
```sql
INSERT INTO admin_phones (name, phone, active) 
VALUES ('Admin Nome', '5511999999999', true);
```

## Monitoramento

Acesse `/admin/playlist-health` para:
- Ver status de todas as playlists
- Verificar últimas verificações
- Identificar clientes afetados
