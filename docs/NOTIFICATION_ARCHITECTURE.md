# Arquitetura Unificada de Notificações

## Visão Geral

O sistema de notificações foi consolidado em uma arquitetura modular e escalável, eliminando redundâncias e centralizando a lógica de envio de mensagens.

## Estrutura de Diretórios

```
src/services/notifications/
├── core/                               # Componentes centrais
│   ├── NotificationService.ts          # Serviço principal de envio
│   ├── TemplateEngine.ts               # Gerenciamento e preenchimento de templates
│   └── WhatsAppAdapter.ts              # Adaptador para API WhatsApp
│
├── detectors/                          # Detectores de eventos
│   ├── PaymentDetector.ts              # Detecta pagamentos realizados
│   ├── NewClientDetector.ts            # Detecta novos clientes
│   └── ClientChangeDetector.ts         # Detecta mudanças em dados de clientes
│
├── handlers/                           # Manipuladores de notificações
│   ├── DueDateNotificationHandler.ts   # Notificações de vencimento
│   ├── EventNotificationHandler.ts     # Eventos (boas-vindas, renovação)
│   └── UpdateNotificationHandler.ts    # Atualizações de cadastro
│
└── index.ts                            # API pública do módulo
```

## Componentes Principais

### 1. NotificationService (Core)

Serviço central responsável por enviar notificações via WhatsApp.

**Responsabilidades:**
- Enviar notificações individuais
- Enviar lotes de notificações
- Gerenciar logs de envio
- Broadcast de eventos real-time

**Métodos:**
```typescript
async send(options: SendNotificationOptions): Promise<void>
async sendBatch(notifications: SendNotificationOptions[]): Promise<{ success: number; errors: number }>
```

### 2. TemplateEngine (Core)

Gerencia templates de mensagens e substitui variáveis.

**Responsabilidades:**
- Carregar templates do localStorage
- Preencher templates com dados do cliente
- Buscar templates por tipo de evento

**Métodos:**
```typescript
loadTemplates(): WhatsappTemplate[]
fill(template: WhatsappTemplate, cliente: Cliente, extraVars?: Record<string, string>): string
findTemplateByEvent(eventType: string, daysBeforeDue?: number): WhatsappTemplate | undefined
```

### 3. WhatsAppAdapter (Core)

Adaptador para comunicação com a API do WhatsApp.

**Responsabilidades:**
- Verificar se o serviço está configurado
- Enviar mensagens de texto
- Enviar arquivos
- Enviar templates BotBot

**Métodos:**
```typescript
isConfigured(): boolean
async sendText(phone: string, message: string): Promise<BotBotResponse>
async sendFile(phone: string, fileBase64: string, caption: string): Promise<BotBotResponse>
async sendTemplate(phone: string, templateId: string, message: string): Promise<BotBotResponse>
```

## Detectores

### PaymentDetector

Detecta pagamentos realizados comparando dados atuais com snapshot anterior.

**Critérios de Detecção:**
- Valor pago aumentou
- Data de vencimento mudou E status melhorou
- Status mudou de "Devendo" para "Ativo"

### NewClientDetector

Detecta novos clientes comparando IDs atuais com snapshot anterior.

### ClientChangeDetector

Detecta mudanças significativas em dados de clientes.

**Campos Monitorados:**
- Plano
- Data de vencimento
- Situação
- Valor pago

## Handlers

### DueDateNotificationHandler

Gerencia notificações baseadas em data de vencimento.

**Funcionalidades:**
- Calcular dias até vencimento
- Verificar se deve enviar notificação
- Enviar notificação de vencimento

### EventNotificationHandler

Gerencia eventos especiais (boas-vindas, renovação).

**Tipos de Eventos:**
- `welcome_trial`: Boas-vindas período de teste
- `welcome_plan`: Boas-vindas plano contratado
- `renewal`: Confirmação de renovação

**Funcionalidades:**
- Detectar novos clientes
- Enviar boas-vindas
- Enviar confirmação de renovação
- Prevenir envios duplicados

### UpdateNotificationHandler

Gerencia notificações de atualização de cadastro.

**Funcionalidades:**
- Detectar mudanças significativas
- Gerar mensagem personalizada
- Enviar notificação de atualização

## Fluxo de Execução

### 1. Notificação Automática (AutoNotificationScheduler)

```
1. Verificar configurações e horário
2. Detectar pagamentos (PaymentDetector)
3. Limpar histórico de clientes que pagaram
4. Processar eventos (EventNotificationHandler)
   - Boas-vindas para novos clientes
   - Renovação para clientes que pagaram
5. Processar notificações de vencimento (DueDateNotificationHandler)
6. Salvar estado de execução
```

### 2. Notificação de Atualização Manual

```
1. Usuário edita cliente no formulário
2. Detectar mudanças (ClientChangeDetector)
3. Gerar mensagem de atualização
4. Enviar notificação (UpdateNotificationHandler)
5. Registrar log
```

## Tipos de Eventos

```typescript
type TemplateEventType = 
  | 'expiration'      // Baseado em dias antes/depois do vencimento
  | 'welcome_trial'   // Novo cliente em período de teste
  | 'welcome_plan'    // Novo cliente com plano contratado
  | 'renewal'         // Pagamento detectado/renovação confirmada
  | 'payment_reminder' // Lembrete genérico de pagamento
```

## Configuração

### WhatsApp Config

```typescript
interface WhatsAppConfig {
  appkey: string;
  authkey: string;
  enabled: boolean;
  autoSendEnabled: boolean;
  sendHour: number;
  daysToNotify: number[];
  testPhoneNumber: string;
  testContacts: TestContact[];
}
```

### Templates

Templates são armazenados no `localStorage` com a chave `whatsapp_templates`.

Estrutura do template:
```typescript
interface WhatsappTemplate {
  id: string;
  name: string;
  message: string;
  variables: string[];
  type: 'local' | 'botbot';
  botbotTemplateId?: string;
  eventType: TemplateEventType;
  daysBeforeDue?: number;
  arquivo?: {
    nome: string;
    tipo: string;
    tamanho: number;
    base64?: string;
  };
}
```

## Variáveis Disponíveis

### Variáveis Padrão
- `{nome}`: Nome do cliente
- `{valor}`: Valor pago formatado
- `{dataVencimento}`: Data de vencimento formatada
- `{plano}`: Plano contratado

### Variáveis Extras
- `{linkPagamento}`: Link para pagamento
- `{telefone}`: Telefone do cliente
- `{diasRestantes}`: Dias restantes até vencimento

## Prevenção de Duplicações

### Notificações de Vencimento
- Armazena histórico por cliente + data de vencimento + dias antes
- Verifica se já enviou hoje
- Limpa histórico quando cliente paga

### Eventos Especiais
- Armazena eventos enviados com clienteId + eventType
- Verifica antes de enviar
- Nunca envia o mesmo evento duas vezes

## Rate Limiting

O sistema utiliza `RateLimiter` para evitar sobrecarga:
- Máximo de 10 mensagens por minuto
- Delay de 2 segundos entre envios

## Logs e Monitoramento

### Logs de Notificação
```typescript
interface NotificationLog {
  id: string;
  clienteId: string;
  clienteNome: string;
  telefone: string;
  tipo: string;
  template: string;
  dataEnvio: string;
  status: 'success' | 'error';
  erro?: string;
  resposta?: any;
  arquivoEnviado?: any;
}
```

### Eventos Real-time
- `batch_started`: Início de lote de envios
- `notification_sent`: Notificação enviada (sucesso/erro)
- `batch_completed`: Conclusão de lote

## Migração de Código Legado

### Arquivos Removidos
- ❌ `paymentDetectionService.ts` → ✅ `detectors/PaymentDetector.ts`
- ❌ `eventNotificationService.ts` → ✅ `handlers/EventNotificationHandler.ts`
- ❌ `clientUpdateNotificationService.ts` → ✅ `handlers/UpdateNotificationHandler.ts`
- ❌ `notificationScheduler.ts` (parcial) → ✅ `core/` + `handlers/DueDateNotificationHandler.ts`

### Arquivos Mantidos (Atualizados)
- ✅ `autoNotificationService.ts` - Orquestrador principal (refatorado)
- ✅ `prospectNotificationService.ts` - Mantido para edge function
- ✅ `notificationRetryQueue.ts` - Sistema de retry
- ✅ `notificationErrorHandler.ts` - Gerenciamento de erros

## Uso da API

### Exemplo: Enviar Notificação de Vencimento

```typescript
import { DueDateNotificationHandler } from '@/services/notifications';

const handler = new DueDateNotificationHandler();
const addLog = (log) => console.log(log);

await handler.sendDueDateNotification(cliente, 7, addLog);
```

### Exemplo: Enviar Notificação de Atualização

```typescript
import { UpdateNotificationHandler } from '@/services/notifications';

const handler = new UpdateNotificationHandler();
const addLog = (log) => console.log(log);

await handler.sendUpdateNotification(clienteAtualizado, clienteOriginal, addLog);
```

### Exemplo: Processar Eventos

```typescript
import { EventNotificationHandler } from '@/services/notifications';

const handler = new EventNotificationHandler();
const addLog = (log) => console.log(log);

const result = await handler.processEvents(clientes, paidClients, addLog);
console.log(`Enviados: ${result.welcomeSent} boas-vindas, ${result.renewalSent} renovações`);
```

## Benefícios da Nova Arquitetura

1. **Modularidade**: Cada componente tem responsabilidade única
2. **Testabilidade**: Componentes isolados são fáceis de testar
3. **Manutenibilidade**: Código organizado e documentado
4. **Escalabilidade**: Fácil adicionar novos tipos de notificação
5. **Reusabilidade**: Componentes podem ser reutilizados
6. **Sem Duplicação**: Lógica centralizada elimina redundância
