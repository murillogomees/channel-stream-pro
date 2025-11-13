# Guia de Persistência de Métricas

## Setup do Banco de Dados

**IMPORTANTE**: O Supabase está com problemas de timeout. Execute o SQL manualmente:

1. Acesse: https://supabase.com/dashboard/project/fcmwpbgdehtuqxcjqmxi/sql/new
2. Execute o conteúdo do arquivo `METRICS_DATABASE_SETUP.sql`
3. Verifique se as tabelas foram criadas

## Funcionalidades

### Auto-Save
- Salva métricas automaticamente a cada 60 segundos
- Salva WebSocket metrics e System health
- Inicia automaticamente ao conectar WebSocket

### Consultas Disponíveis

```typescript
// Buscar métricas de um período
const metrics = await persistenceService.getMetricsForPeriod(
  new Date('2025-01-01'),
  new Date('2025-01-31')
);

// Buscar health de um período
const health = await persistenceService.getHealthForPeriod(
  new Date('2025-01-01'),
  new Date('2025-01-31')
);

// Comparar dois períodos
const comparison = await persistenceService.comparePeriods(
  period1Start, period1End,
  period2Start, period2End
);

// Métricas agregadas por hora
const hourly = await persistenceService.getHourlyMetrics(
  startDate, endDate
);
```

## Retenção de Dados
- 30 dias de histórico
- Limpeza automática via função `cleanup_old_metrics()`

## Tabelas Criadas
- `metrics_snapshots`: Snapshots de métricas WebSocket
- `health_snapshots`: Snapshots de saúde do sistema
