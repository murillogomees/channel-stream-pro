# R2 Config Helper

## Overview

O `r2-config.ts` é um helper compartilhado para configuração do Cloudflare R2 CDN em todas as Edge Functions do projeto.

## Localização

```
supabase/functions/_shared/r2-config.ts
```

## Bucket Padrão

```
iptvlink-cdn
```

**⚠️ IMPORTANTE**: Este é o bucket primário para todas as operações CDN. Não altere sem coordenar todos os serviços.

## Uso

### Importação

```typescript
import { 
  getR2Client,
  getR2Config,
  checkR2Config,
  uploadToR2,
  deleteFromR2,
  generateR2Key,
  getCdnUrl,
  R2_BUCKET_NAME,
} from "../_shared/r2-config.ts";
```

### Verificar Configuração

```typescript
const status = checkR2Config();
if (!status.configured) {
  console.error('Missing:', status.missing);
}
```

### Upload de Conteúdo

```typescript
const result = await uploadToR2({
  key: generateR2Key('vod', 'channel-123', 'mp4'),
  body: videoBuffer,
  contentType: 'video/mp4',
});

console.log('CDN URL:', result.cdnUrl);
```

### Gerar URLs CDN

```typescript
const url = getCdnUrl(generateR2Key('playlist', 'list-abc', 'm3u'));
// https://cdn.iptvlink.app/iptvlink/production/playlist/list-abc.m3u
```

### Health Check

```typescript
const health = await testR2Connection();
console.log({
  connected: health.connected,
  canRead: health.canRead,
  canWrite: health.canWrite,
});
```

## Funções Disponíveis

| Função | Descrição |
|--------|-----------|
| `getR2Config()` | Retorna configuração completa do R2 |
| `checkR2Config()` | Verifica se R2 está configurado (sem throw) |
| `getR2Client()` | Retorna cliente S3 singleton |
| `generateR2Key()` | Gera chave padronizada para objetos |
| `generateChannelKey()` | Gera chave para conteúdo de canal |
| `generatePlaylistKey()` | Gera chave para playlists M3U |
| `getMimeType()` | Detecta MIME type de arquivo |
| `getCdnUrl()` | Gera URL pública do CDN |
| `uploadToR2()` | Upload com headers otimizados |
| `deleteFromR2()` | Remove objeto do R2 |
| `objectExists()` | Verifica se objeto existe |
| `listObjects()` | Lista objetos com prefix |
| `testR2Connection()` | Testa conexão e permissões |

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `R2_ACCOUNT_ID` | ✅ | ID da conta Cloudflare |
| `R2_ACCESS_KEY_ID` | ✅ | Access Key do R2 |
| `R2_SECRET_ACCESS_KEY` | ✅ | Secret Key do R2 |
| `R2_BUCKET_NAME` | ❌ | Override do bucket (default: iptvlink-cdn) |
| `R2_CDN_BASE_URL` | ❌ | Override da URL CDN |
| `ENVIRONMENT` | ❌ | Ambiente (default: production) |

## Edge Functions que Usam o Helper

| Função | Status |
|--------|--------|
| `test-r2-connection` | ✅ Atualizado |
| `cdn-health` | ✅ Atualizado |
| `r2-upload` | ⏳ Pendente |
| `cdn-content-downloader` | ⏳ Pendente |
| `cdn-prewarm` | ⏳ Pendente |
| `generate-m3u-file` | ⏳ Pendente |

## Convenção de Chaves

```
iptvlink/{env}/{category}/{identifier}[.{extension}]
```

### Categorias

- `vod` - Vídeos on-demand
- `live` - Streams ao vivo
- `playlist` - Playlists M3U
- `thumbnail` - Miniaturas
- `manifest` - Manifestos HLS
- `segment` - Segmentos de vídeo
- `backup` - Backups

### Exemplos

```
iptvlink/production/vod/channel-123/movie.mp4
iptvlink/production/playlist/list-abc.m3u
iptvlink/production/thumbnail/channel-123.jpg
```

## Cache Headers

O helper aplica headers de cache otimizados automaticamente:

| Tipo | Cache-Control |
|------|---------------|
| Manifests (.m3u8) | `public, max-age=10, s-maxage=30` |
| Outros | `public, max-age=3600, s-maxage=86400` |

---

*Última atualização: 2025-12-03*
