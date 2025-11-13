# Sistema de Métricas e Analytics

## Visão Geral

Sistema completo de coleta, análise e visualização de métricas em tempo real para monitoramento de saúde e performance do sistema IPTV LINK.

## Componentes do Sistema

### 1. WebSocket Metrics Service (`websocketMetricsService.ts`)

Responsável por coletar e armazenar métricas detalhadas sobre conexões WebSocket.

#### Métricas Rastreadas

**Conexões:**
- Total de tentativas de conexão
- Conexões bem-sucedidas vs falhas
- Tentativa de conexão atual
- Taxa de sucesso

**Timing:**
- Tempo médio de conexão
- Tempo da última conexão
- Total de uptime (tempo online)
- Total de downtime (tempo offline)
- Período mais longo de uptime

**Reconexões:**
- Total de reconexões
- Taxa de reconexão (por hora)
- Tempo médio entre reconexões

**Latência:**
- Latência média
- Latência mínima
- Latência máxima
- Histórico de latência (últimos 50 valores)

**Eventos:**
- Total de eventos enviados
- Total de eventos recebidos
- Eventos falhados

**Saúde:**
- Status atual: `healthy` | `degraded` | `critical` | `offline`
- Número de ativações do modo fallback
- Timestamp da última verificação

#### Snapshots

O sistema captura snapshots periódicos (a cada mudança significativa) contendo todas as métricas. Mantém histórico dos últimos 100 snapshots para análise temporal.

```typescript
interface MetricsSnapshot {
  timestamp: number;
  metrics: WebSocketMetrics;
}
```

### 2. System Health Service (`systemHealthService.ts`)

Monitora a saúde de todos os serviços do sistema.

#### Serviços Monitorados

1. **WebSocket Realtime**
   - Status da conexão
   - Latência
   - Erros

2. **Supabase Database**
   - Conectividade
   - Latência de queries
   - Erros

3. **WhatsApp API**
   - Configuração
   - Status de integração

4. **SmartOne IPTV**
   - Configuração
   - Status de integração

#### Status de Serviço

Cada serviço pode ter um dos seguintes status:
- `operational`: Funcionando normalmente
- `degraded`: Funcionando com problemas
- `down`: Fora do ar
- `unknown`: Status desconhecido

#### Status Geral do Sistema

Calculado baseado no status de todos os serviços:
- `healthy`: Todos os serviços operacionais
- `degraded`: 1 serviço down ou 2+ degradados
- `critical`: 2+ serviços down
- `offline`: Sistema completamente fora do ar

### 3. Admin Alert Service (`adminAlertService.ts`)

Sistema de alertas automáticos para administradores.

#### Tipos de Alertas

1. **WebSocket Fallback** (`websocket_fallback`)
   - Severidade: Critical
   - Cooldown: 5 minutos
   - Disparado quando: WebSocket entra em modo fallback

2. **Service Down** (`service_down`)
   - Severidade: Critical
   - Cooldown: 10 minutos
   - Disparado quando: Um serviço fica offline

3. **High Error Rate** (`high_error_rate`)
   - Severidade: Warning
   - Cooldown: 15 minutos
   - Disparado quando: Taxa de erro excede limites

4. **Critical Failure** (`critical_failure`)
   - Severidade: Critical
   - Cooldown: 2 minutos
   - Disparado quando: Falha crítica detectada

#### Notificações Desktop

Alertas são enviados como notificações desktop do navegador quando:
- Permissão de notificação foi concedida
- Alerta não está em cooldown
- Sistema detecta condição crítica

#### Gerenciamento de Alertas

- Reconhecimento individual ou em lote
- Remoção de alertas
- Histórico persistente em localStorage
- Filtros por severidade e tipo

## Dashboard de Saúde do Sistema

Página `/admin/system-health` oferece visualização completa de métricas.

### Seções do Dashboard

#### 1. Status Geral
Badge colorido mostrando status overall do sistema.

#### 2. Status de Serviços
Grid com cards de cada serviço mostrando:
- Status atual
- Latência (quando disponível)
- Mensagens de erro

#### 3. Métricas Resumidas
Painel com 4 KPIs principais:
- Uptime total
- Total de conexões bem-sucedidas
- Latência média
- Taxa de sucesso

#### 4. Gráficos de Tendência

**Tab: Latência**
- Gráfico de linhas mostrando evolução da latência
- Três linhas: Média, Mínima, Máxima
- Últimos 30 snapshots
- Eixo Y: latência em milissegundos
- Eixo X: timestamps

**Tab: Uptime**
- Gráfico de área empilhado
- Uptime vs Downtime em minutos
- Visualização cumulativa ao longo do tempo
- Cores: Verde (uptime), Vermelho (downtime)

**Tab: Conexões**
- Gráfico de barras: Sucesso vs Falhas
- Gráfico de linha: Taxa de sucesso (%)
- Evolução das tentativas de conexão
- Identificação de períodos problemáticos

**Tab: Eventos**
- Gráfico de linhas múltiplas
- Eventos enviados, recebidos, falhados
- Análise de throughput do WebSocket
- Detecção de gargalos

#### 5. Alertas Não Reconhecidos
Lista dos 5 alertas mais recentes não reconhecidos com:
- Tipo e severidade
- Título e mensagem
- Timestamp

### Exportação de Dados

Botão "Exportar Métricas" gera arquivo JSON com:
- Todas as métricas atuais
- Histórico completo de snapshots
- Timestamp de exportação

## Integração com Realtime Service

O `RealtimeNotificationService` foi integrado com todos os serviços de métricas:

### Pontos de Integração

1. **Tentativa de Conexão**
   ```typescript
   metricsService.recordConnectionAttempt()
   ```

2. **Conexão Bem-Sucedida**
   ```typescript
   metricsService.recordConnectionSuccess()
   metricsService.recordLatency(latency)
   healthService.updateWebSocketHealth(health)
   ```

3. **Falha de Conexão**
   ```typescript
   metricsService.recordConnectionFailure()
   healthService.updateWebSocketHealth(health)
   alertService.alertHighErrorRate() // Se threshold atingido
   ```

4. **Modo Fallback Ativado**
   ```typescript
   metricsService.recordFallbackMode()
   healthService.updateWebSocketHealth(health)
   alertService.alertWebSocketFallback(data)
   ```

5. **Evento Enviado**
   ```typescript
   metricsService.recordEventSent()
   metricsService.recordLatency(sendLatency)
   ```

6. **Evento Recebido**
   ```typescript
   metricsService.recordEventReceived(latency)
   ```

7. **Falha de Evento**
   ```typescript
   metricsService.recordEventFailed()
   ```

## Tecnologias Utilizadas

- **Recharts**: Biblioteca de gráficos React
  - LineChart: Tendências temporais
  - AreaChart: Comparações cumulativas
  - BarChart: Comparações discretas
  - ResponsiveContainer: Layouts responsivos

- **date-fns**: Formatação de datas e timestamps
- **LocalStorage**: Persistência de alertas e configurações
- **Web Notifications API**: Notificações desktop

## Configuração

### Intervalos de Atualização

```typescript
// System Health Check
healthService.startMonitoring(30000); // 30 segundos

// Dashboard Update
setInterval(updateData, 5000); // 5 segundos
```

### Retenção de Dados

```typescript
maxSnapshotHistory: 100  // Últimos 100 snapshots
maxLatencyHistory: 50    // Últimas 50 medições de latência
maxAlerts: 100          // Até 100 alertas no histórico
```

## Boas Práticas

### Performance

1. **Snapshots Limitados**: Apenas últimos 100 para evitar uso excessivo de memória
2. **Gráficos Otimizados**: Mostram apenas últimos 30 pontos de dados
3. **Lazy Loading**: Dashboard carregado apenas quando acessado
4. **Cooldowns**: Previnem flood de alertas

### UX

1. **Cores Semânticas**: Verde (ok), Amarelo (aviso), Vermelho (erro)
2. **Feedback Visual**: Badges, progress bars, animações
3. **Informação Contextual**: Tooltips nos gráficos
4. **Responsividade**: Layout adapta a mobile/tablet/desktop

### Manutenibilidade

1. **Serviços Singleton**: Instância única compartilhada
2. **Type Safety**: TypeScript com interfaces bem definidas
3. **Separação de Concerns**: Cada serviço tem responsabilidade única
4. **Documentação**: Comentários e logs descritivos

## Próximos Passos

- [ ] Persistência de métricas em banco de dados
- [ ] Relatórios automáticos por email
- [ ] Comparação de métricas entre períodos
- [ ] Alertas configuráveis por administrador
- [ ] Integração com ferramentas de monitoramento externas (Sentry, DataDog)
- [ ] Machine Learning para detecção de anomalias
- [ ] Previsão de falhas baseada em padrões históricos

## Acesso

**URL**: `/admin/system-health`

**Atalho**: Card "Saúde do Sistema" no AdminDashboard

**Permissões**: Apenas administradores autenticados
