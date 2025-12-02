# Sistema de Alertas de Segurança - Guia Completo

## Visão Geral

Sistema completo de notificação de alertas de segurança com suporte a:
- ✅ Canal WhatsApp via BotBot API
- ✅ Sistema de plantão com horários específicos
- ✅ Confirmação de leitura de alertas
- ✅ Escalonamento automático para alertas não confirmados

## Arquitetura

### 1. Tabelas do Banco de Dados

#### `admin_phones`
Armazena informações dos administradores e suas configurações de notificação:
- `notification_channels`: Canal habilitado (whatsapp)
- `phone`: Telefone WhatsApp para notificações
- `schedule_enabled`: Se o sistema de plantão está ativo
- `schedule_config`: Configuração de horários por dia da semana

#### `security_alert_deliveries`
Rastreia entrega e confirmação de alertas:
- `security_event_id`: Evento relacionado
- `admin_phone_id`: Admin que recebeu
- `delivery_status`: sent, confirmed, failed
- `confirmed_at`: Timestamp de confirmação
- `escalated`: Se foi escalonado

#### `security_alert_escalation_rules`
Regras de escalonamento:
- `event_type`: Tipo de evento
- `severity_level`: critical, warning
- `time_window_minutes`: Tempo para escalonamento
- `escalation_action`: notify_all, notify_secondary

## Funcionalidades

### 1. Sistema de Plantão

Permite configurar horários específicos em que cada admin deve receber alertas.

**Como Configurar:**
1. Acesse `/admin/schedule-config`
2. Selecione um administrador
3. Vá na aba "Horários"
4. Ative "Sistema de Plantão"
5. Configure horários para cada dia da semana
6. Salve as configurações

**Exemplo de Configuração:**
```json
{
  "monday": {
    "enabled": true,
    "start": "08:00",
    "end": "17:00"
  },
  "tuesday": {
    "enabled": false
  }
}
```

**Lógica:**
- Se `schedule_enabled = false`: Admin recebe alertas 24/7
- Se `schedule_enabled = true`: Admin só recebe no horário configurado
- Se o dia está `enabled = false`: Admin não recebe nesse dia

### 2. Canal de Notificação WhatsApp

Sistema utiliza WhatsApp como canal exclusivo via BotBot API.

**Como Configurar:**
1. Acesse `/admin/schedule-config`
2. Selecione um administrador
3. Configure telefone WhatsApp

### 3. Confirmação de Leitura

Sistema de confirmação para garantir que admins visualizaram alertas críticos.

**Como Funciona:**
1. Alerta é enviado com link de confirmação
2. Admin clica no link ou chama a API
3. Status muda para "confirmed" em `security_alert_deliveries`
4. Se não confirmar em X minutos, é escalonado

**Link de Confirmação:**
```
https://seu-dominio.com/api/confirm-alert?deliveryId=xxx&adminId=yyy
```

**Edge Function:**
- `/confirm-security-alert`: Endpoint público que confirma recebimento

**Confirmação Manual (API):**
```typescript
await supabase.functions.invoke('confirm-security-alert', {
  body: {
    deliveryId: 'uuid-do-alerta',
    adminPhoneId: 'uuid-do-admin'
  }
});
```

### 4. Escalonamento Automático

Alertas críticos não confirmados são automaticamente escalonados.

**Como Funciona:**
1. Edge Function `escalate-security-alerts` roda a cada 5 minutos (via cron)
2. Busca alertas críticos não confirmados
3. Verifica se passou o tempo de escalonamento
4. Executa ação de escalonamento (notifica todos ou secundários)

**Configurar Cron Job:**

Execute este SQL no Supabase:
```sql
select cron.schedule(
  'escalate-security-alerts-every-5min',
  '*/5 * * * *',
  $$
  select
    net.http_post(
        url:='https://SEU_PROJECT_ID.supabase.co/functions/v1/escalate-security-alerts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer SUA_ANON_KEY"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
```

**Regras de Escalonamento:**

Gerencie em `/admin/security-escalation`:
- Defina tipos de eventos para escalonar
- Configure tempo de espera (time_window_minutes)
- Escolha ação: notificar todos ou lista secundária
- Ative/desative regras

## Fluxo Completo

1. **Evento de Segurança Ocorre**
   - Sistema detecta (ex: 5 login failures)
   - Cria registro em `security_events`

2. **Verificação de Envio**
   - `securityWhatsAppAlertService.shouldSendAlert()` verifica:
     - Severidade do evento
     - Threshold configurado
     - Cooldown period
     - Configuração ativa

3. **Seleção de Admins**
   - Busca admins ativos
   - Filtra por horário de plantão
   - Verifica canais disponíveis

4. **Envio Multi-Canal**
   - Tenta WhatsApp (se configurado)
   - Tenta Telegram (se configurado)
   - Tenta SMS (se configurado)
   - Adiciona link de confirmação

5. **Registro de Entrega**
   - Cria registro em `security_alert_deliveries`
   - Status inicial: "sent"

6. **Confirmação**
   - Admin clica no link ou confirma manualmente
   - Status muda para "confirmed"
   - `confirmed_at` é preenchido

7. **Escalonamento (se necessário)**
   - Cron verifica alertas não confirmados
   - Se passou tempo limite, escalona
   - Notifica lista secundária ou todos
   - Marca como `escalated = true`

## Integração com Outros Sistemas

### WhatsApp (BotBot)
Usa `WhatsAppAdapter` existente com credenciais em secrets.

## Monitoramento
```typescript
// Exemplo de implementação necessária
private async sendTelegram(telegramId: string, message: string): Promise<void> {
  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: 'Markdown'
      })
    }
  );
  // Handle response...
}
```

### SMS (A Implementar)
```typescript
// Exemplo com Twilio
private async sendSMS(phone: string, message: string): Promise<void> {
  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
  const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
  
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phone,
        From: TWILIO_PHONE_NUMBER,
        Body: message
      })
    }
  );
  // Handle response...
}
```

## Monitoramento

### Métricas Disponíveis
- Total de alertas enviados
- Taxa de confirmação
- Tempo médio de confirmação
- Alertas escalonados
- Falhas por canal

### Logs
- Edge Function logs em Supabase Dashboard
- Service logs em `securityWhatsAppAlertService`
- Delivery tracking em `security_alert_deliveries`

## Segurança

- ✅ RLS habilitado em todas as tabelas
- ✅ Edge Functions com autenticação apropriada
- ✅ Confirmação requer deliveryId + adminPhoneId corretos
- ✅ Secrets armazenados no Supabase Vault

## Troubleshooting

### Alertas não estão sendo enviados
1. Verificar se admin está ativo
2. Verificar horário de plantão (se habilitado)
3. Verificar configuração de threshold em `security_alert_config`
4. Verificar logs do WhatsApp adapter

### Confirmação não funciona
1. Verificar se deliveryId está correto
2. Verificar logs da Edge Function `confirm-security-alert`
3. Verificar se admin tem permissão

### Escalonamento não acontece
1. Verificar se cron job está configurado
2. Verificar logs da Edge Function `escalate-security-alerts`
3. Verificar se regras de escalonamento estão ativas
4. Verificar `time_window_minutes` na configuração

## Links Úteis

- [Configurar Admins e Canais](/admin/schedule-config)
- [Configurar Escalonamento](/admin/security-escalation)
- [Ver Alertas de Segurança](/admin/security-alerts)
- [Monitorar Eventos](/admin/security-monitor)
- [Ver Logs Edge Function](https://supabase.com/dashboard/project/YOUR_PROJECT/functions)
