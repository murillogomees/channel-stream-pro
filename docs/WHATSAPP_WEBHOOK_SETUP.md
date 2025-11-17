# Configuração do Webhook do WhatsApp

Este documento descreve como configurar o webhook do WhatsApp para receber confirmações de leitura automáticas.

## 🎯 Objetivo

O webhook permite capturar eventos do WhatsApp (leitura, entrega, falha) e atualizar automaticamente o status das entregas de alertas de segurança, eliminando a necessidade de cliques manuais para confirmação.

## 📋 Pré-requisitos

1. Conta ativa no BotBot API (ou provedor WhatsApp similar)
2. Edge function `whatsapp-webhook` implantado
3. Secret `WHATSAPP_WEBHOOK_SECRET` configurado (opcional, mas recomendado)

## 🔧 Configuração

### 1. Adicionar Secret de Webhook (Opcional mas Recomendado)

Para validar que as requisições vêm realmente do WhatsApp:

```bash
# No dashboard do Supabase:
# Settings > Edge Functions > Add Secret
WHATSAPP_WEBHOOK_SECRET=seu_token_secreto_aqui
```

### 2. Configurar Webhook no BotBot API

1. Acesse o painel do BotBot API
2. Vá em **Configurações > Webhooks**
3. Configure o webhook:

```
URL: https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/whatsapp-webhook
Método: POST
Eventos:
  ✅ message_read (leitura de mensagem)
  ✅ message_delivered (mensagem entregue)
  ✅ message_failed (falha no envio)
```

4. Se configurou o secret, adicione no header:
```
Authorization: Bearer seu_token_secreto_aqui
```

## 📊 Eventos Suportados

### `message_read` - Mensagem Lida
Quando o destinatário visualiza a mensagem no WhatsApp.
- **Ação**: Marca entrega como `confirmed` e registra `confirmed_at`

### `message_delivered` - Mensagem Entregue
Quando a mensagem chega ao dispositivo do destinatário.
- **Ação**: Atualiza status para `delivered`

### `message_failed` - Falha no Envio
Quando há erro no envio da mensagem.
- **Ação**: Marca como `failed` e registra erro

## 🔍 Formato do Payload

O webhook espera receber eventos neste formato:

```json
{
  "event": "message_read",
  "phone": "5511999999999",
  "message_id": "msg_123456",
  "timestamp": "2024-01-15T10:30:00Z",
  "status": "read"
}
```

## 🧪 Testando o Webhook

### Teste Manual via cURL

```bash
curl -X POST https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu_token_secreto_aqui" \
  -d '{
    "event": "message_read",
    "phone": "5511999999999",
    "timestamp": "2024-01-15T10:30:00Z"
  }'
```

### Verificar Logs

Acesse os logs do edge function para depuração:
```
https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/functions/whatsapp-webhook/logs
```

## 🔐 Segurança

1. **Validação de Origem**: O webhook valida o secret antes de processar eventos
2. **HTTPS Obrigatório**: Todas as comunicações são criptografadas
3. **Service Role**: Usa privilégios elevados apenas no backend
4. **Rate Limiting**: Configure rate limiting no provedor WhatsApp

## 📈 Monitoramento

### Verificar Status das Entregas

```sql
SELECT 
  d.id,
  d.sent_at,
  d.delivery_status,
  d.confirmed_at,
  ap.name as admin_name,
  ap.phone
FROM security_alert_deliveries d
JOIN admin_phones ap ON d.admin_phone_id = ap.id
ORDER BY d.sent_at DESC
LIMIT 20;
```

### Entregas Não Confirmadas

```sql
SELECT 
  COUNT(*) as pending_confirmations,
  MIN(sent_at) as oldest_pending
FROM security_alert_deliveries
WHERE delivery_status = 'sent' 
  AND confirmed_at IS NULL
  AND sent_at > NOW() - INTERVAL '24 hours';
```

## 🚨 Troubleshooting

### Webhook não está recebendo eventos

1. Verifique se a URL está correta no BotBot API
2. Confirme que o edge function está implantado
3. Verifique logs do edge function

### Eventos não estão atualizando status

1. Confirme que o telefone no evento corresponde ao cadastrado
2. Verifique se há deliveries pendentes para aquele número
3. Revise os logs para erros de atualização

### Erro 401 Unauthorized

1. Verifique se o secret está correto em ambos os lados
2. Confirme o formato do header Authorization
3. Se não usar secret, remova validação do código

## 🔄 Fluxo Completo

```
1. Sistema envia alerta → delivery_status: 'sent'
2. WhatsApp entrega → webhook recebe 'message_delivered' → status: 'delivered'
3. Admin visualiza → webhook recebe 'message_read' → status: 'confirmed' + confirmed_at
4. Sistema cancela escalonamento (se houver)
```

## 📝 Notas Importantes

- O webhook busca o delivery mais recente não confirmado para o telefone
- Confirmação via webhook tem prioridade sobre confirmação manual
- Eventos duplicados são tratados (idempotência baseada em estado)
- Webhook é público mas validado por secret

## 🔗 Links Úteis

- [Edge Function Logs](https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/functions/whatsapp-webhook/logs)
- [Edge Function Secrets](https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/settings/functions)
- [BotBot API Docs](https://docs.botbot.com.br/)
