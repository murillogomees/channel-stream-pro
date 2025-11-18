# Configuração do Supabase Realtime para Broadcast

## Status Atual

✅ O sistema está configurado corretamente para usar **Broadcast Channels** do Supabase Realtime.

## Como Funciona

### Broadcast vs Database Changes

O Supabase Realtime oferece dois modos principais:

1. **Database Changes** (postgres_changes)
   - Monitora mudanças em tabelas do banco de dados
   - **Requer RLS policies** na tabela
   - Usado para sincronização de dados persistentes

2. **Broadcast Channels** (broadcast) ✅ **MODO ATUAL**
   - Canais de comunicação em tempo real
   - **NÃO requer RLS policies**
   - Usado para eventos temporários (notificações, status, etc.)
   - Mensagens não são persistidas no banco

### Nossa Implementação

```typescript
// src/services/realtimeNotificationService.ts
this.channel = supabase.channel('notifications_live', {
  config: {
    broadcast: { self: true },  // ✅ Usando broadcast
    presence: { key: '' }
  }
});

this.channel
  .on('broadcast', { event: 'notification_event' }, (payload) => {
    // Recebe eventos broadcast
    this.notifyListeners(payload.payload);
  })
  .subscribe();
```

## Verificação do Realtime

### 1. Supabase Realtime está Habilitado?

Por padrão, o Supabase Realtime está habilitado em todos os projetos. Você pode verificar em:

**Dashboard → Project Settings → API → Realtime**

URL: `https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/settings/api`

### 2. Broadcast Channels Funcionam?

✅ Sim! Broadcast channels não precisam de configuração adicional ou RLS policies porque:

- Não acessam tabelas do banco de dados
- São canais de comunicação peer-to-peer
- Mensagens existem apenas em memória
- Qualquer cliente conectado ao mesmo canal pode enviar/receber

### 3. Configuração Necessária

**Nenhuma configuração adicional é necessária!** 

O sistema já está configurado corretamente:
- ✅ Canal broadcast criado: `notifications_live`
- ✅ Eventos sendo enviados via `broadcast`
- ✅ Listeners configurados para receber eventos
- ✅ Auto-reconexão implementada
- ✅ Detecção de rede implementada

## Monitoramento

### Verificar Conexões WebSocket

Você pode monitorar as conexões em tempo real no dashboard:

**Dashboard → Realtime → Inspector**

URL: `https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/realtime/inspector`

Aqui você verá:
- Canais ativos
- Número de conexões
- Mensagens sendo enviadas/recebidas
- Erros de conexão

### Logs de Conexão

O serviço já registra logs detalhados:

```javascript
console.log('[Realtime] Conectado ao canal');
console.log('[Realtime] Evento recebido:', payload);
console.warn('[Realtime] Falha na conexão:', error);
```

## Reconexão Inteligente

### Recursos Implementados

1. **Detecção de Rede**
   - Monitora eventos `online`/`offline` do navegador
   - Reconecta imediatamente quando a rede volta
   - Pausa tentativas quando offline

2. **Retry com Backoff Exponencial**
   - Aumenta delay entre tentativas: 2s → 4s → 8s → 16s...
   - Máximo de 60 segundos entre tentativas
   - Até 8 tentativas antes de ativar modo fallback

3. **Heartbeat**
   - Verifica conexão a cada 45 segundos
   - Reconecta automaticamente se detectar problema

4. **Modo Fallback**
   - Ativado após múltiplas falhas
   - Sistema continua funcionando via polling
   - Admins são alertados

## Troubleshooting

### Problema: "Connection timeout"

**Causas comuns:**
- Rede lenta ou instável
- Firewall bloqueando WebSockets
- Limite de conexões do Supabase atingido

**Solução:**
- ✅ Timeout aumentado para 30 segundos
- ✅ Retry automático implementado
- ✅ Detecção de rede implementada
- Sistema agora é mais tolerante a falhas temporárias

### Problema: "CHANNEL_ERROR"

**Causas comuns:**
- Nome do canal inválido
- Configuração incorreta do channel

**Status:**
- ✅ Canal configurado corretamente: `notifications_live`
- ✅ Configuração broadcast ativada
- ✅ Self-broadcast habilitado

### Problema: Eventos não chegam

**Verificar:**
1. Canal está subscrito? (Status: `SUBSCRIBED`)
2. Evento está sendo enviado com o nome correto? (`notification_event`)
3. Payload está no formato esperado?

**Debugging:**
```javascript
// Verificar status da subscrição
console.log(channel.state); // Deve ser 'joined'

// Testar envio manual
await channel.send({
  type: 'broadcast',
  event: 'notification_event',
  payload: { test: true }
});
```

## Próximos Passos

### Melhorias Futuras (Opcionais)

1. **Compressão de Mensagens**
   - Reduzir tamanho dos payloads para eventos grandes

2. **Presença de Usuários**
   - Mostrar quais admins estão online
   - Indicador de "digitando..."

3. **Channels Dinâmicos**
   - Criar canais por grupo de admins
   - Filtrar notificações por tipo

4. **Persistência Local**
   - Cache de eventos durante offline
   - Sincronizar quando reconectar

## Referências

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Broadcast Channels Guide](https://supabase.com/docs/guides/realtime/broadcast)
- [Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API)
