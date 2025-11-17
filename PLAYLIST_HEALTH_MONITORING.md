# Sistema de Monitoramento de Saúde das Playlists

## Visão Geral

O sistema de monitoramento verifica periodicamente se as URLs M3U das playlists do SmartOne estão ativas e funcionando corretamente.

## Componentes

### 1. Tabela de Banco de Dados

A tabela `playlist_health_checks` armazena os resultados das verificações:

- **client_id**: ID do cliente
- **playlist_id**: ID da playlist no SmartOne
- **m3u_url**: URL da playlist M3U
- **status**: Status da verificação (`pending`, `active`, `inactive`, `error`)
- **response_time_ms**: Tempo de resposta em milissegundos
- **http_status_code**: Código HTTP retornado
- **error_message**: Mensagem de erro (se houver)
- **last_checked_at**: Data/hora da última verificação

### 2. Edge Function

A função `check-playlist-health` executa as verificações:

- Busca todos os clientes com playlists ativas
- Verifica cada URL M3U (requisição HEAD)
- Registra o tempo de resposta e status
- Salva os resultados no banco de dados

### 3. Interface de Administração

Página `/admin/playlist-health` mostra:

- Estatísticas gerais (total, ativas, inativas, com erro)
- Percentual de saúde do sistema
- Tempo médio de resposta
- Data da última verificação
- Botão para executar verificação manual

## Configuração do Cron Job

Para executar verificações automáticas a cada hora, configure um cron job no Supabase:

### Passo 1: Habilitar Extensões

Execute no SQL Editor do Supabase:

```sql
-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Passo 2: Criar Cron Job

Execute o seguinte SQL, substituindo `PROJECT_REF` pelo ID do seu projeto:

```sql
SELECT cron.schedule(
  'playlist-health-check-hourly',
  '0 * * * *', -- A cada hora no minuto 0
  $$
  SELECT
    net.http_post(
      url := 'https://PROJECT_REF.supabase.co/functions/v1/check-playlist-health',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'x-cron-job', 'true'
      ),
      body := jsonb_build_object(
        'time', now()::text
      )
    ) as request_id;
  $$
);
```

### Passo 3: Verificar Cron Job

Para verificar se o cron job foi criado:

```sql
SELECT * FROM cron.job WHERE jobname = 'playlist-health-check-hourly';
```

### Passo 4: Ver Logs do Cron Job

Para ver o histórico de execuções:

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'playlist-health-check-hourly')
ORDER BY start_time DESC
LIMIT 10;
```

## Status das Playlists

### Ativa (active)
- URL respondeu com sucesso (HTTP 200-299)
- Playlist está funcionando normalmente

### Inativa (inactive)
- URL foi acessada mas retornou erro HTTP (400-599)
- Requer verificação e possível correção

### Erro (error)
- Não foi possível acessar a URL
- Pode indicar: timeout, problema de rede, URL inválida
- Requer atenção imediata

## Limpeza Automática

O sistema mantém apenas os últimos 30 dias de verificações. Para limpar manualmente:

```typescript
await playlistHealthService.cleanOldHealthChecks();
```

## Integração com Cadastro de Clientes

### No Processo de Cadastro (/tutorial)

Quando um novo cliente se cadastra:

1. O cliente fornece apenas dados pessoais (nome, telefone, etc.)
2. O sistema busca automaticamente a URL M3U padrão cadastrada pelo admin
3. A URL M3U **nunca** é exposta para o cliente
4. O sistema cria a playlist no SmartOne usando as credenciais do cliente
5. A primeira verificação de saúde é agendada automaticamente

### Fluxo de Dados

```
Cliente Cadastro (/tutorial)
    ↓
Sistema busca M3U default (admin)
    ↓
Cria playlist no SmartOne
    ↓
Registra cliente no banco
    ↓
Primeira verificação de saúde
    ↓
Monitoramento contínuo (cron)
```

### Segurança

- URLs M3U são armazenadas de forma segura no banco
- Clientes não têm acesso direto às URLs
- Apenas administradores podem visualizar URLs completas
- Sistema de health check acessa URLs de forma segura

## API de Verificação Manual

Para executar verificação manual via código:

```typescript
import { playlistHealthService } from '@/services/playlistHealthService';

// Executar verificação
const result = await playlistHealthService.runHealthCheck();

// Buscar estatísticas
const stats = await playlistHealthService.getHealthStats();

// Buscar histórico de um cliente
const history = await playlistHealthService.getClientHealthHistory(clientId);
```

## Alertas e Notificações

### Futuras Implementações

- Notificar admin quando playlist ficar inativa
- Alertas para clientes afetados
- Dashboard em tempo real de saúde das playlists
- Relatórios periódicos de disponibilidade

## Manutenção

### Verificar Última Execução

```sql
SELECT MAX(last_checked_at) as ultima_verificacao
FROM playlist_health_checks;
```

### Ver Playlists com Problemas

```sql
SELECT 
  c.nome as cliente,
  phc.status,
  phc.error_message,
  phc.last_checked_at
FROM playlist_health_checks phc
JOIN clientes c ON c.id = phc.client_id
WHERE phc.status IN ('inactive', 'error')
  AND phc.id IN (
    SELECT id FROM playlist_health_checks phc2
    WHERE phc2.client_id = phc.client_id
    ORDER BY last_checked_at DESC
    LIMIT 1
  )
ORDER BY phc.last_checked_at DESC;
```

## Troubleshooting

### Cron Job não está executando

1. Verifique se as extensões estão habilitadas:
   ```sql
   SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
   ```

2. Verifique se o cron job existe:
   ```sql
   SELECT * FROM cron.job;
   ```

3. Verifique os logs de erro:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE status = 'failed'
   ORDER BY start_time DESC;
   ```

### Verificação manual não funciona

1. Verifique se a edge function está implantada
2. Verifique os logs da edge function no Supabase
3. Teste com curl:
   ```bash
   curl -X POST https://PROJECT_REF.supabase.co/functions/v1/check-playlist-health \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json"
   ```

## Monitoramento de Performance

O sistema registra:
- Tempo de resposta de cada playlist
- Taxa de sucesso/falha
- Disponibilidade histórica
- Tendências de degradação

Use essas métricas para:
- Identificar problemas antes que afetem clientes
- Otimizar infraestrutura
- Planejar escalabilidade
- Melhorar SLAs
