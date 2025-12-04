# Playlist Management System

Sistema escalável para gerenciamento de playlists M3U com sanitização, storage R2 e indexação Postgres.

## Arquitetura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   clean-m3u     │────▶│  Cloudflare R2  │     │    Postgres     │
│  Edge Function  │     │  (iptvlink-cdn) │     │   (playlists)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  playlists-api  │     │playlists-cleanup│     │playlists-archive│
│     (CRUD)      │     │  (Daily cron)   │     │ (Monthly cron)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Endpoints

### POST /functions/v1/clean-m3u

Limpa, valida e opcionalmente salva playlists M3U.

#### Formatos de Entrada

**1. Upload de Arquivo (multipart/form-data)**

```bash
curl -X POST \
  -H "Authorization: Bearer <ANON_KEY>" \
  -F "file=@playlist.m3u" \
  "https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/clean-m3u?save=true"
```

**2. URL Remota (JSON)**

```bash
curl -X POST \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/playlist.m3u"}' \
  "https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/clean-m3u?save=true&skipProbe=true"
```

**3. Conteúdo Raw (JSON)**

```bash
curl -X POST \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"m3u": "#EXTM3U\n#EXTINF:-1,Channel 1\nhttp://stream.example.com/live.m3u8"}' \
  "https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/clean-m3u"
```

#### Parâmetros

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `skipProbe` | boolean | `false` | Pular validação HEAD das URLs |
| `maxChannels` | number | `2000` | Limite máximo de canais (max: 10000) |
| `probeTimeoutMs` | number | `4000` | Timeout por probe em ms (max: 10000) |
| `concurrency` | number | `10` | Probes paralelos (max: 50) |
| `download` | boolean | `false` | Retornar como arquivo .m3u |
| `save` | boolean | `false` | Salvar no R2 e indexar no Postgres |
| `retentionDays` | number | `30` | Dias até expiração (max: 365) |

#### Resposta (JSON)

```json
{
  "cleaned": "#EXTM3U\n#EXTINF:-1 tvg-name=\"Channel 1\" group-title=\"Aberto\",Channel 1\nhttp://stream.example.com/live.m3u8",
  "stats": {
    "inChannels": 150,
    "uniqueChannels": 145,
    "cleanedChannels": 140,
    "quarantinedCount": 10,
    "quarantined": [
      {
        "url": "http://broken.example.com/...",
        "title": "Broken Channel",
        "reason": "probe-failed",
        "details": "timeout"
      }
    ],
    "generatedAt": "2025-12-04T22:30:00.000Z",
    "processingTimeMs": 5432,
    "opts": { ... }
  },
  "playlistId": "550e8400-e29b-41d4-a716-446655440000",
  "storageUrl": "https://iptvlink-cdn.r2.dev/playlists/cleaned/2025/12/04/550e8400-abc12345.m3u"
}
```

### GET /functions/v1/playlists-api

Lista playlists com paginação.

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/playlists-api?limit=20&offset=0"
```

#### Parâmetros de Query

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `from` | string | Data inicial (ISO 8601) |
| `to` | string | Data final (ISO 8601) |
| `user_id` | string | Filtrar por usuário (admin only) |
| `limit` | number | Itens por página (max: 100) |
| `offset` | number | Offset para paginação |
| `archived` | boolean | Incluir arquivados |

### GET /functions/v1/playlists-api/{id}

Retorna detalhes da playlist com URL de acesso.

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/playlists-api/550e8400-e29b-41d4-a716-446655440000"
```

### DELETE /functions/v1/playlists-api/{id}

Remove playlist (admin ou owner).

```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  "https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/playlists-api/550e8400-e29b-41d4-a716-446655440000"
```

## Estrutura de Storage

```
playlists/
├── cleaned/
│   └── {YYYY}/
│       └── {MM}/
│           └── {DD}/
│               └── {uuid}-{hash}.m3u
└── archive/
    └── {YYYY}-{MM}.archive
```

## Políticas de Retention

### Configuração via Environment Variables

```bash
# Dias até expiração (default: 30)
PLAYLIST_RETENTION_DAYS=30

# Versões por usuário a manter (default: 3)
PLAYLIST_KEEP_VERSIONS=3

# Deletar originais após arquivar
ARCHIVE_DELETE_ORIGINALS=false

# Tamanho máximo do archive (MB)
MAX_ARCHIVE_SIZE_MB=500
```

### Jobs Automáticos

**playlists-cleanup (Daily 02:00 UTC)**
- Remove playlists expiradas
- Deleta arquivos do R2
- Prune versões antigas por usuário

**playlists-archive (Monthly, 1st at 03:00 UTC)**
- Compacta playlists do mês anterior
- Upload do archive para R2
- Marca playlists como arquivadas

## JavaScript/TypeScript Usage

```typescript
import { supabase } from '@/integrations/supabase/client'

// Limpar e salvar playlist
const { data, error } = await supabase.functions.invoke('clean-m3u', {
  body: {
    url: 'https://example.com/playlist.m3u',
    skipProbe: true,
    save: true,
    retentionDays: 60
  }
})

if (data.playlistId) {
  console.log('Saved:', data.storageUrl)
}

// Listar playlists
const { data: list } = await supabase.functions.invoke('playlists-api', {
  method: 'GET'
})

// Obter playlist específica
const { data: playlist } = await supabase.functions.invoke('playlists-api', {
  method: 'GET',
  body: { id: 'playlist-uuid' }
})
```

## Database Schema

### playlists

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| filename | text | Nome do arquivo |
| storage_path | text | Caminho no R2 |
| user_id | uuid | FK para auth.users |
| original_source | text | URL ou filename original |
| channel_count | int | Total de canais na entrada |
| unique_count | int | Canais únicos |
| quarantined_count | int | Canais descartados |
| opts | jsonb | Opções usadas |
| probe_summary | jsonb | Resumo do probing |
| sha256 | text | Hash do conteúdo |
| size_bytes | bigint | Tamanho em bytes |
| created_at | timestamptz | Criação |
| expires_at | timestamptz | Expiração |
| archived | boolean | Se foi arquivado |
| archived_at | timestamptz | Quando arquivado |
| archive_id | uuid | FK para archive |

### playlist_archives

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| archive_path | text | Caminho no R2 |
| archive_month | text | YYYY-MM |
| size_bytes | bigint | Tamanho |
| sha256 | text | Hash do archive |
| playlist_count | int | Playlists incluídas |
| verified | boolean | Integridade verificada |
| metadata | jsonb | Manifest dos arquivos |

## Playbook de Rollback

### Restaurar de Archive

```bash
# 1. Download do archive
curl -o archive.tar \
  "https://iptvlink-cdn.r2.dev/playlists/archive/2025-11.archive"

# 2. O archive contém manifest no início
# Extrair manifest (primeiras linhas até primeiro arquivo)

# 3. Cada arquivo está separado por "---END-FILE---"
# Restaurar arquivo específico usando offset do manifest
```

### Via SQL

```sql
-- Listar playlists em um archive
SELECT 
  pa.archive_month,
  jsonb_array_elements(pa.metadata->'manifest') as file_info
FROM playlist_archives pa
WHERE pa.archive_month = '2025-11';

-- Reverter arquivamento (marca como não-arquivado)
UPDATE playlists
SET archived = false, archived_at = NULL, archive_id = NULL
WHERE archive_id = 'archive-uuid';
```

## Métricas e Observabilidade

O sistema emite logs estruturados para cada operação:

```
[timestamp][clean-m3u][INFO] Pipeline complete {"inChannels":150,"cleanedChannels":140,"processingTimeMs":5432}
[timestamp][playlists-cleanup][INFO] Deleted 25 expired playlists
[timestamp][playlists-archive][INFO] Archive job completed {"playlistCount":100,"archiveSizeBytes":52428800}
```

### Métricas Recomendadas

- `playlists.cleaned.count` - Total de playlists processadas
- `playlists.saved.count` - Total salvas no R2
- `playlists.probe.failures` - Falhas de validação de URL
- `playlists.archive.size_bytes` - Tamanho dos archives
- `playlists.expired.deleted` - Playlists expiradas removidas

## Segurança

- URLs não são logadas por completo (truncadas a 50 chars)
- RLS aplicado nas tabelas
- Admin/owner verification para DELETE
- Hashes SHA256 para verificação de integridade
