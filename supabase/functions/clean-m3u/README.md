# clean-m3u Edge Function

Enterprise-grade M3U playlist sanitizer, validator, and optimizer.

## Overview

This function accepts M3U playlists in multiple formats, processes them through a comprehensive cleaning pipeline, and returns a sanitized, deduplicated, and validated playlist.

## Features

- **Multi-format input**: Accepts file upload, URL fetch, or raw M3U content
- **URL validation**: HEAD/GET probing with configurable timeout and concurrency
- **Deduplication**: Removes duplicate channels by URL
- **Metadata normalization**: Cleans titles, standardizes attributes, normalizes categories
- **Quarantine tracking**: Reports removed channels with reasons
- **Download mode**: Returns cleaned M3U as downloadable file

## API Endpoints

### POST /functions/v1/clean-m3u

#### Input Formats

**1. File Upload (multipart/form-data)**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -F "file=@playlist.m3u" \
  "https://supabase.iptvlink.com.br/functions/v1/clean-m3u"
```

**2. URL Fetch (JSON)**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/playlist.m3u"}' \
  "https://supabase.iptvlink.com.br/functions/v1/clean-m3u"
```

**3. Raw Content (JSON)**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"m3u": "#EXTM3U\n#EXTINF:-1,Channel 1\nhttp://example.com/stream.m3u8"}' \
  "https://supabase.iptvlink.com.br/functions/v1/clean-m3u"
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skipProbe` | boolean | `false` | Skip URL validation (faster processing) |
| `maxChannels` | number | `2000` | Maximum channels to process (max: 10000) |
| `probeTimeoutMs` | number | `4000` | Timeout per URL probe in ms (max: 10000) |
| `concurrency` | number | `10` | Parallel URL probes (max: 50) |
| `download` | boolean | `false` | Return as downloadable .m3u file |

**Example with parameters:**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/playlist.m3u"}' \
  "https://supabase.iptvlink.com.br/functions/v1/clean-m3u?skipProbe=true&maxChannels=500"
```

#### Response (JSON mode)

```json
{
  "cleaned": "#EXTM3U\n#EXTINF:-1 tvg-id=\"\" tvg-name=\"Channel 1\" tvg-logo=\"\" group-title=\"Aberto\",Channel 1\nhttp://example.com/stream.m3u8",
  "stats": {
    "inChannels": 150,
    "uniqueChannels": 145,
    "cleanedChannels": 140,
    "quarantinedCount": 10,
    "quarantined": [
      {
        "url": "http://example.com/broken...",
        "title": "Broken Channel",
        "reason": "probe-failed",
        "details": "timeout"
      }
    ],
    "generatedAt": "2024-12-04T22:30:00.000Z",
    "processingTimeMs": 5432,
    "opts": {
      "skipProbe": false,
      "maxChannels": 2000,
      "probeTimeoutMs": 4000,
      "concurrency": 10,
      "download": false
    }
  }
}
```

#### Response (Download mode)

When `download=true`, returns the cleaned M3U file directly:

```
Content-Type: audio/x-mpegurl
Content-Disposition: attachment; filename="cleaned.m3u"
```

## Processing Pipeline

1. **Sanitization**
   - Remove BOM
   - Normalize line endings
   - Remove control characters
   - Clean excessive whitespace

2. **Tokenization**
   - Parse #EXTINF lines
   - Extract tvg-id, tvg-name, tvg-logo, group-title
   - Pair with subsequent URLs
   - Skip orphaned URLs/EXTINF

3. **Deduplication**
   - Remove duplicates by normalized URL
   - Keep first occurrence

4. **Metadata Normalization**
   - Clean titles (remove emojis, markers)
   - Standardize group categories
   - Rebuild EXTINF with normalized attributes

5. **URL Probing** (unless skipProbe=true)
   - HEAD request with fallback to GET
   - Controlled concurrency
   - Filter non-responsive URLs

6. **Final Build**
   - Sort by group then title
   - Generate clean M3U output

## Category Normalization

Input categories are normalized to standard groups:

| Detected Keywords | Normalized To |
|-------------------|---------------|
| filme, movie, cinema, vod | Filmes |
| serie, tv show, novela | Séries |
| esporte, sport, futebol | Esportes |
| infantil, kids, cartoon | Infantil |
| noticia, news, jornal | Notícias |
| aberto, nacional | Aberto |
| documentario, documentary | Documentários |
| musica, music | Música |

## Quarantine Reasons

| Reason | Description |
|--------|-------------|
| `probe-failed` | URL did not respond successfully |
| `invalid-url` | Malformed URL |
| `unsupported-protocol` | Protocol not http/https/rtmp/rtsp |
| `duplicate` | URL already exists in playlist |
| `parse-error` | Could not parse channel entry |

## JavaScript/TypeScript Usage

```typescript
import { supabase } from '@/integrations/supabase/client'

// Clean from URL
const { data, error } = await supabase.functions.invoke('clean-m3u', {
  body: { 
    url: 'https://example.com/playlist.m3u',
    skipProbe: true,
    maxChannels: 500
  }
})

if (error) throw error

console.log('Cleaned channels:', data.stats.cleanedChannels)
console.log('Quarantined:', data.stats.quarantinedCount)

// Clean from raw content
const { data: data2 } = await supabase.functions.invoke('clean-m3u', {
  body: { 
    m3u: rawM3UContent
  }
})
```

## Performance Considerations

- **skipProbe=true**: 10-50x faster, but doesn't validate URLs
- **concurrency**: Higher values = faster probing, but may trigger rate limits
- **maxChannels**: Limit processing for very large playlists

## Error Handling

The function returns HTTP 400 with error message for:

- Missing or empty M3U content
- Failed URL fetch
- Invalid content type
- Processing errors

```json
{
  "error": "M3U content is empty or too short"
}
```

## Limitations

- Maximum 10,000 channels per request
- Maximum 10 second probe timeout
- Maximum 50 concurrent probes
- Quarantine list limited to 100 entries in response
