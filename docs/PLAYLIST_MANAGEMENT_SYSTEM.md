# Sistema de Gerenciamento de Playlists M3U

## Visão Geral

Sistema production-grade para gerenciamento completo de playlists M3U incluindo:
- Limpeza e validação on-demand
- Persistência canônica em Supabase Storage (R2)
- Indexação em Postgres com deduplicação
- Compactação mensal automatizada (tar.gz)
- Lifecycle/retention automatizada
- APIs de listagem e signed-urls
- Observabilidade integrada

## Arquitetura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client App    │────▶│  Edge Functions  │────▶│ Supabase Storage│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                         │
                               ▼                         ▼
                        ┌─────────────┐          ┌─────────────┐
                        │  Postgres   │          │   R2/CDN    │
                        └─────────────┘          └─────────────┘
```

## Edge Functions

### 1. clean-m3u

Limpa e valida playlists M3U com opção de persistência.

**Endpoints:**
- `POST /functions/v1/clean-m3u`

**Parâmetros (query string):**
| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| skipProbe | boolean | true | Pular validação de URLs |
| maxChannels | number | 5000 | Máximo de canais a processar |
| probeTimeoutMs | number | 4000 | Timeout por URL (ms) |
| concurrency | number | 10 | Paralelismo de probes |
| save | boolean | false | Salvar no Storage + Postgres |
| download | boolean | false | Retornar arquivo M3U |
| retentionDays | number | 30 | Dias até expiração |

**Input (body):**
- Multipart form: `file` (arquivo M3U)
- JSON: `{ url: "..." }` ou `{ m3u: "..." }`

**Response:**
```json
{
  "cleaned": "#EXTM3U...",
  "stats": {
    "inChannels": 1500,
    "uniqueChannels": 1450,
    "cleanedChannels": 1400,
    "quarantinedCount": 50,
    "quarantined": [...],
    "generatedAt": "2025-12-04T...",
    "processingTimeMs": 2345
  },
  "id": "uuid",
  "sha256": "abc123...",
  "storageUrl": "cleaned/2025/12/04/...",
  "signedUrl": "https://..."
}
```

**Deduplicação:**
Se o SHA256 do conteúdo limpo já existir, retorna o registro existente sem duplicar.

### 2. playlists

API REST para gerenciamento de playlists.

**Endpoints:**

#### GET /functions/v1/playlists
Lista playlists com paginação e filtros.

**Parâmetros:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| user_id | uuid | Filtrar por usuário (admin only) |
| from | ISO date | Data inicial |
| to | ISO date | Data final |
| limit | number | Itens por página (default: 50) |
| offset | number | Offset para paginação |
| include_archived | boolean | Incluir arquivados |

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

#### GET /functions/v1/playlists/:id
Obtém metadados e signed URL de uma playlist.

**Response:**
```json
{
  "id": "uuid",
  "filename": "xxx.m3u",
  "storage_path": "cleaned/2025/12/04/...",
  "channel_count": 1400,
  "sha256": "abc123...",
  "size_bytes": 125000,
  "created_at": "2025-12-04T...",
  "expires_at": "2026-01-03T...",
  "signedUrl": "https://...",
  "signedUrlExpiresIn": 3600
}
```

#### DELETE /functions/v1/playlists/:id
Deleta playlist (owner ou admin).

### 3. archive-playlists

Cron job para compactação mensal.

**Comportamento:**
- Executa no dia configurado (ARCHIVE_DAY, default: 3)
- Compacta playlists do mês anterior em tar.gz
- Armazena em `archive/{YYYY-MM}.tar.gz`
- Marca playlists como arquivadas
- Remove arquivos originais após verificação

**Manual trigger:**
```bash
curl -X POST "https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/archive-playlists?force=true" \
  -H "Authorization: Bearer <SERVICE_KEY>"
```

## Estrutura de Storage

```
playlists/
├── cleaned/
│   └── {YYYY}/
│       └── {MM}/
│           └── {DD}/
│               └── {id}-{sha256_short}.m3u
└── archive/
    └── {YYYY}-{MM}.tar.gz
```

## Tabelas Postgres

### playlists
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| filename | text | Nome do arquivo |
| storage_path | text | Path no Storage |
| user_id | uuid | Proprietário |
| source_domain | text | Domínio origem (sem URL completa) |
| channel_count | int | Total de canais |
| unique_count | int | Canais únicos |
| quarantined_count | int | Canais em quarentena |
| sha256 | text | Hash do conteúdo |
| size_bytes | bigint | Tamanho em bytes |
| created_at | timestamptz | Data criação |
| expires_at | timestamptz | Data expiração |
| archived | boolean | Se foi arquivado |
| archive_id | uuid | FK para archives |

### archives
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| path | text | Path do arquivo tar.gz |
| month | text | YYYY-MM |
| size_bytes | bigint | Tamanho compactado |
| sha256 | text | Hash do arquivo |
| playlist_count | int | Quantidade de playlists |
| created_at | timestamptz | Data criação |
| verified_at | timestamptz | Data verificação |

## Variáveis de Ambiente

```env
# Obrigatórias (já configuradas no Supabase)
SUPABASE_URL=https://sdvyxdghxqmntyoweqbd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Opcionais (com defaults)
STORAGE_BUCKET=playlists          # Bucket no Storage
RETENTION_DAYS=30                  # Dias de retenção
ARCHIVE_DAY=3                      # Dia do mês para archive
SIGNED_URL_EXPIRES=3600           # Segundos para signed URL
PROBE_TIMEOUT_MS=4000             # Timeout de probe
MAX_CHANNELS=5000                 # Máximo de canais
```

## Exemplos de Uso

### Limpar e salvar playlist
```bash
# Via URL
curl -X POST "https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/clean-m3u?save=true" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/lista.m3u"}'

# Via upload
curl -X POST "https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/clean-m3u?save=true" \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@playlist.m3u"

# Via conteúdo direto
curl -X POST "https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/clean-m3u?save=true&skipProbe=true" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"m3u":"#EXTM3U\n#EXTINF:-1,Channel 1\nhttp://..."}'
```

### Listar playlists
```bash
curl "https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/playlists?limit=10" \
  -H "Authorization: Bearer <TOKEN>"
```

### Obter playlist com signed URL
```bash
curl "https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/playlists/<id>?expires=7200" \
  -H "Authorization: Bearer <TOKEN>"
```

### Download direto
```bash
curl -X POST "https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/clean-m3u?download=true" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"url":"https://example.com/lista.m3u"}' \
  -o cleaned.m3u
```

## Segurança

- **RBAC**: Usuários só acessam suas próprias playlists; admins acessam todas
- **Signed URLs**: Expiram em 1 hora por padrão
- **Logging seguro**: URLs não são logadas completas, apenas domínio
- **Deduplicação**: Mesmo conteúdo não duplica storage
- **RLS**: Policies aplicadas em todas as tabelas

## Métricas

O sistema emite logs estruturados para observabilidade:
- `playlists.cleaned.count` - Playlists limpas
- `playlists.saved.count` - Playlists salvas
- `playlists.archive.count` - Arquivos arquivados
- `playlist.probe.fail_rate` - Taxa de falha em probes

## Trade-offs Arquiteturais

### Supabase Storage vs Cloudflare R2 Direto

| Aspecto | Supabase Storage | R2 Direto |
|---------|------------------|-----------|
| Signed URLs | API nativa | Requer implementação |
| Integração | Seamless | Manual |
| Custo | Incluído no plano | Separado |
| Latência | ~50ms | ~20ms |
| Controle | Limitado | Total |

**Decisão**: Usar Supabase Storage pela conveniência e integração nativa com signed URLs.

## Checklist de QA

- [x] clean-m3u aceita multipart, url e m3u
- [x] SHA256 calculado e usado para deduplicação
- [x] Arquivo salvo com metadata headers corretos
- [x] Registro inserido com expires_at
- [x] Signed URL gerado corretamente
- [x] Cron job gera archive tar.gz
- [x] Após archive, originais são removidos
- [x] Logs não contém URLs completas
- [x] RBAC implementado

## Rollback

Em caso de problemas:

1. **Reverter archive**: Extrair tar.gz e restaurar arquivos originais
2. **Limpar registros**: Deletar de `archives` e resetar `archived=false` em `playlists`
3. **Restaurar storage**: Upload manual dos arquivos extraídos
