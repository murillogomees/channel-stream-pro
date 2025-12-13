# Cloudflare Workers - IPTV Infrastructure

## Workers Overview

### 1. Transcode Worker (`transcode-worker/`)
Manages video transcoding jobs with queue-based processing.

**Features:**
- Queue-based job management (Cloudflare Queues)
- Multi-resolution output (1080p, 720p, 480p, 360p, 240p)
- HLS and DASH format support
- FFmpeg command generation
- Callback handling for external transcoding services
- Automatic channel metadata updates

**Endpoints:**
- `POST /queue` - Job management (submit, process, status, list, cancel, retry)
- `POST /callback` - Receive transcoding completion callbacks
- `GET /health` - Health check

### 2. Cache Worker (`cache-worker/`)
Intelligent tiered caching with KV (hot) and R2 (cold) storage.

**Features:**
- Two-tier caching (KV for hot, R2 for cold)
- Automatic tier promotion (R2 → KV on access)
- Content-aware TTL configuration
- Pattern-based cache invalidation
- Cache warming for channels
- Access tracking and statistics

**Endpoints:**
- `POST /` with action parameter:
  - `get` - Retrieve cached value
  - `set` - Store value with optional TTL and tier
  - `delete` - Remove by key or pattern
  - `flush` - Clear all cache
  - `warmup` - Pre-cache channel metadata
  - `stats` - Cache statistics
  - `keys` - List cached keys
  - `ttl` - Get remaining TTL
- `GET /health` - Health check

### 3. VOD Download Worker (`vod-download-worker/`)
Handles video-on-demand downloads with resume support.

**Features:**
- JWT-based download tokens
- Range request support (resume downloads)
- Chunked transfer for large files
- Subscription verification
- R2 storage integration

**Endpoints:**
- `GET /download?id=&token=` - Download VOD content
- `POST /generate-token` - Generate download token
- `POST /upload` - Upload VOD content
- `GET /list` - List VOD content
- `POST /delete` - Delete VOD content
- `GET /health` - Health check

### 4. Cloudflare Stream Worker (`cloudflare-stream-worker/`)
Full Cloudflare Stream API integration for live and VOD.

**Features:**
- Video upload from URL
- Signed playback URLs
- Live input management (RTMPS, WebRTC, SRT)
- Webhook handling for events
- Analytics and stats

**Endpoints:**
- **Video:**
  - `POST /video/upload` - Upload video from URL
  - `GET /video/list` - List all videos
  - `GET /video/details?id=` - Get video details
  - `POST /video/delete` - Delete video
  - `GET /video/playback?id=` - Get signed playback URL
- **Live:**
  - `POST /live/create` - Create live input
  - `GET /live/list` - List live inputs
  - `GET /live/details?id=` - Get live input details
  - `POST /live/delete` - Delete live input
  - `GET /live/playback?id=` - Get live playback URLs
- `POST /webhook` - Stream event webhook
- `GET /stats` - Stream statistics
- `GET /health` - Health check

## Deployment

### Prerequisites
1. Install Wrangler CLI: `npm install -g wrangler`
2. Login to Cloudflare: `wrangler login`
3. Create required resources in Cloudflare dashboard:
   - KV Namespace for cache
   - R2 Bucket (iptvlink-cdn)
   - Queue (transcode-jobs) for transcode worker

### Configuration

1. Update `wrangler.toml` in each worker directory with your resource IDs
2. Set secrets:

```bash
# Transcode Worker
cd workers/transcode-worker
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put WORKER_SECRET
wrangler secret put FFMPEG_ENDPOINT

# Cache Worker
cd workers/cache-worker
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put WORKER_SECRET

# VOD Download Worker
cd workers/vod-download-worker
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put WORKER_SECRET
wrangler secret put JWT_SECRET

# Cloudflare Stream Worker
cd workers/cloudflare-stream-worker
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put CLOUDFLARE_STREAM_API_TOKEN
wrangler secret put CLOUDFLARE_STREAM_SIGNING_KEY
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put WORKER_SECRET
```

### Deploy All Workers

```bash
# Deploy all workers
for worker in transcode-worker cache-worker vod-download-worker cloudflare-stream-worker; do
  cd workers/$worker
  wrangler deploy
  cd ../..
done
```

## Integration with Frontend Service

The `iptvTranscodeService.ts` service in the frontend connects to these workers through the Edge Functions that proxy requests:

- `iptv-transcode` Edge Function → Transcode Worker
- `iptv-redis-cache` Edge Function → Cache Worker

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Self-hosted Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for database access |
| `WORKER_SECRET` | Shared secret for worker authentication |
| `JWT_SECRET` | Secret for JWT token signing |
| `FFMPEG_ENDPOINT` | External FFmpeg service URL (optional) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_STREAM_API_TOKEN` | Stream API token |
| `CLOUDFLARE_STREAM_SIGNING_KEY` | Signing key for URLs |
| `CDN_BASE_URL` | Base URL for CDN downloads |

## TTL Configuration

Cache TTLs are content-aware:

| Content Type | TTL |
|--------------|-----|
| Manifest (.m3u8) | 10 seconds |
| Segment (.ts) | 5 minutes |
| Metadata | 1 hour |
| EPG | 24 hours |
| Thumbnails | 1 week |
| Default | 5 minutes |
