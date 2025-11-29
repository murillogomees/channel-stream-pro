# Streaming Tests

Testes automatizados para a arquitetura de streaming híbrido.

## Estrutura

```
tests/streaming/
├── smoke.test.ts      # Testes básicos de funcionalidade
├── chaos.test.ts      # Testes de falha e resiliência
├── load.test.ts       # Testes de carga e performance
├── vitest.config.ts   # Configuração do Vitest
└── README.md          # Este arquivo
```

## Executar Testes

### Todos os testes
```bash
cd tests/streaming
npx vitest run
```

### Smoke tests (rápido)
```bash
npx vitest run smoke.test.ts
```

### Chaos tests (resiliência)
```bash
npx vitest run chaos.test.ts
```

### Load tests (performance)
```bash
npx vitest run load.test.ts
```

### Watch mode (desenvolvimento)
```bash
npx vitest
```

## Configuração

### Edge Router URL
Por padrão, os testes usam `https://stream-edge-router.workers.dev`.

Para usar uma URL diferente:
```bash
EDGE_ROUTER_URL=https://seu-worker.workers.dev npx vitest run
```

## Testes Incluídos

### Smoke Tests
- ✅ Fetch streaming policies
- ✅ Verify default strategies (VOD → USE_STREAM, Live → USE_ORIGIN)
- ✅ Call routing strategy function
- ✅ Edge Router health check
- ✅ Edge Router metrics endpoint
- ✅ Cloudflare Stream integration

### Chaos Tests
- ✅ Force origin override
- ✅ Expired overrides handling
- ✅ High error rate detection
- ✅ Concurrent request handling
- ✅ Burst metric recording
- ✅ Malformed request handling
- ✅ Database stress testing

### Load Tests
- ✅ 50 concurrent policy lookups
- ✅ Streaming policies read load
- ✅ Burst metric recording (100 metrics)
- ✅ Edge Router health check load
- ✅ Mixed VOD/Live traffic simulation (70/30)
- ✅ Channel data read performance
- ✅ Upload status read performance

## Métricas Coletadas

Os load tests coletam:
- Total de requisições
- Requisições bem-sucedidas/falhadas
- Latência média
- Latência P95 e P99
- Latência mínima e máxima
- Requests per second (RPS)
- Duração total

## Thresholds

| Métrica | Smoke | Load | Chaos |
|---------|-------|------|-------|
| Success Rate | 100% | >80% | >75% |
| Avg Latency | <1s | <2s | N/A |
| P95 Latency | <2s | <5s | N/A |

## CI/CD Integration

Adicione ao seu pipeline:

```yaml
# GitHub Actions example
- name: Run Streaming Tests
  run: |
    cd tests/streaming
    npm install
    npx vitest run --reporter=json --outputFile=results.json
    
- name: Upload Test Results
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: tests/streaming/results.json
```

## Troubleshooting

### Edge Router não disponível
Se o Worker não estiver deployado, os testes de Edge Router serão pulados automaticamente.

### Rate limiting
Se enfrentar rate limiting do Supabase, reduza a concorrência nos load tests.

### Timeout
Load tests podem demorar mais de 60s. O timeout está configurado para 60s no vitest.config.ts.
