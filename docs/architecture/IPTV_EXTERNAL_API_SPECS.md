# IPTV External API Specifications (NestJS)

## Overview

Esta documentação descreve a API NestJS que deve ser deployada no VPS/K8s externo para processar workloads pesados (probe, transcode) que não cabem no Lovable/Edge Functions.

## Stack

- **Runtime**: Node.js 20+ / Bun
- **Framework**: NestJS 10+
- **Database**: PostgreSQL 15+ (self-hosted)
- **Queue**: BullMQ (Redis 7+)
- **Cache**: Redis Cluster (sharded)
- **Transcode**: FFmpeg 6+
- **Storage**: Cloudflare R2

---

## Directory Structure

```
iptv-api/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── channels/
│   │   ├── channels.controller.ts
│   │   ├── channels.service.ts
│   │   ├── channels.module.ts
│   │   └── dto/
│   ├── playlists/
│   │   ├── playlists.controller.ts
│   │   ├── playlists.service.ts
│   │   └── playlists.module.ts
│   ├── probe/
│   │   ├── probe.processor.ts
│   │   ├── probe.service.ts
│   │   └── probe.module.ts
│   ├── transcode/
│   │   ├── transcode.processor.ts
│   │   ├── transcode.service.ts
│   │   └── transcode.module.ts
│   ├── cdn/
│   │   ├── cdn.service.ts
│   │   └── cdn.module.ts
│   ├── cache/
│   │   ├── redis.service.ts
│   │   └── cache.module.ts
│   └── common/
│       ├── guards/
│       ├── interceptors/
│       └── decorators/
├── workers/
│   ├── probe-worker.ts
│   └── transcode-worker.ts
├── docker-compose.yml
├── Dockerfile
├── k8s/
│   ├── deployment-api.yaml
│   ├── deployment-probe.yaml
│   ├── deployment-transcode.yaml
│   ├── hpa.yaml
│   └── secrets.yaml
└── package.json
```

---

## API Endpoints

### Channels

```typescript
// GET /api/channels
// Query params: page, limit, category, healthy, search
interface ListChannelsResponse {
  data: Channel[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// GET /api/channels/:id
interface Channel {
  id: number;
  slug: string;
  name: string;
  originalUrl: string;
  logoUrl: string | null;
  category: string | null;
  contentType: 'live' | 'vod' | 'series';
  codecHint: string | null;
  resolution: string | null;
  bitrateEstimate: number | null;
  isHealthy: boolean;
  healthScore: number;
  transcodeStatus: 'none' | 'queued' | 'processing' | 'ready';
  lastProbeAt: Date | null;
}

// POST /api/channels
interface CreateChannelDto {
  slug: string;
  name: string;
  originalUrl: string;
  logoUrl?: string;
  category?: string;
  contentType?: 'live' | 'vod' | 'series';
  priority?: number;
}

// PATCH /api/channels/:id
interface UpdateChannelDto extends Partial<CreateChannelDto> {}

// DELETE /api/channels/:id
```

### Probe

```typescript
// POST /api/probe/run
interface RunProbeDto {
  channelIds?: number[];      // Specific channels
  category?: string;          // All in category
  unhealthyOnly?: boolean;    // Only unhealthy
  priority?: 'low' | 'normal' | 'high';
}

interface RunProbeResponse {
  jobsQueued: number;
  estimatedTimeSeconds: number;
}

// GET /api/probe/status
interface ProbeStatusResponse {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  avgLatencyMs: number;
}

// GET /api/probe/jobs/:id
interface ProbeJob {
  id: number;
  channelId: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result: {
    codec: string;
    resolution: string;
    bitrate: number;
    frameRate: number;
    latencyMs: number;
  } | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}
```

### Transcode

```typescript
// POST /api/transcode/queue
interface QueueTranscodeDto {
  channelIds: number[];
  mode: 'abr' | 'single' | 'passthrough';
  targetResolutions?: string[];  // ['1080p', '720p', '480p', '360p']
  priority?: 'low' | 'normal' | 'high';
  llhls?: boolean;               // Low-latency HLS
}

interface QueueTranscodeResponse {
  jobsQueued: number;
  estimatedTimeMinutes: number;
}

// GET /api/transcode/status
interface TranscodeStatusResponse {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  avgDurationMinutes: number;
  storageUsedGb: number;
}

// GET /api/transcode/jobs/:id
interface TranscodeJob {
  id: number;
  channelId: number;
  mode: string;
  status: string;
  progress: number;
  outputUrls: {
    resolution: string;
    manifestUrl: string;
    segmentPrefix: string;
  }[];
  workerId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

// DELETE /api/transcode/jobs/:id
// Cancels a running job
```

### M3U Generation (sync with Supabase)

```typescript
// POST /api/m3u/sync
// Syncs channel data to Supabase for M3U generation
interface SyncM3UDto {
  fullSync?: boolean;
  channelIds?: number[];
}

// POST /api/m3u/invalidate-cache
// Invalidates Redis cache for M3U
interface InvalidateCacheDto {
  playlistIds?: number[];
  global?: boolean;
}
```

---

## Worker Configurations

### Probe Worker

```typescript
// workers/probe-worker.ts
import { Worker, Job } from 'bullmq';
import { execSync } from 'child_process';

interface ProbeJobData {
  channelId: number;
  url: string;
  timeout: number;
}

const worker = new Worker('probe', async (job: Job<ProbeJobData>) => {
  const { channelId, url, timeout } = job.data;

  const startTime = Date.now();

  try {
    // Use ffprobe for detailed analysis
    const result = execSync(
      `ffprobe -v quiet -print_format json -show_format -show_streams -timeout ${timeout} "${url}"`,
      { timeout: timeout * 1000, encoding: 'utf-8' }
    );

    const parsed = JSON.parse(result);
    const videoStream = parsed.streams.find(s => s.codec_type === 'video');
    const audioStream = parsed.streams.find(s => s.codec_type === 'audio');

    return {
      success: true,
      latencyMs: Date.now() - startTime,
      codec: videoStream?.codec_name || 'unknown',
      resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : 'unknown',
      bitrate: parseInt(parsed.format?.bit_rate) || 0,
      frameRate: eval(videoStream?.r_frame_rate) || 0,
      audioCodec: audioStream?.codec_name,
    };
  } catch (error) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: error.message,
    };
  }
}, {
  connection: { host: 'redis', port: 6379 },
  concurrency: 50, // High concurrency for parallel probes
  limiter: { max: 100, duration: 1000 }, // Rate limit
});
```

### Transcode Worker

```typescript
// workers/transcode-worker.ts
import { Worker, Job } from 'bullmq';
import { spawn } from 'child_process';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface TranscodeJobData {
  channelId: number;
  inputUrl: string;
  outputPrefix: string;
  resolutions: string[];
  llhls: boolean;
}

const ABR_PRESETS = {
  '1080p': { width: 1920, height: 1080, bitrate: '5000k', maxrate: '5500k' },
  '720p': { width: 1280, height: 720, bitrate: '2800k', maxrate: '3000k' },
  '480p': { width: 854, height: 480, bitrate: '1400k', maxrate: '1600k' },
  '360p': { width: 640, height: 360, bitrate: '800k', maxrate: '900k' },
};

const worker = new Worker('transcode', async (job: Job<TranscodeJobData>) => {
  const { channelId, inputUrl, outputPrefix, resolutions, llhls } = job.data;

  const outputs = [];

  for (const res of resolutions) {
    const preset = ABR_PRESETS[res];
    if (!preset) continue;

    const outputPath = `/tmp/${outputPrefix}_${res}`;

    // FFmpeg command for LL-HLS
    const ffmpegArgs = [
      '-i', inputUrl,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-tune', 'zerolatency',
      '-c:a', 'aac',
      '-b:v', preset.bitrate,
      '-maxrate', preset.maxrate,
      '-bufsize', `${parseInt(preset.bitrate) * 2}k`,
      '-vf', `scale=${preset.width}:${preset.height}`,
      '-g', '48',
      '-keyint_min', '48',
      '-sc_threshold', '0',
      '-hls_time', llhls ? '1' : '4',
      '-hls_playlist_type', 'event',
      '-hls_flags', llhls ? 'independent_segments+program_date_time' : 'independent_segments',
      '-hls_segment_filename', `${outputPath}_%03d.ts`,
      `${outputPath}.m3u8`,
    ];

    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', ffmpegArgs);
      proc.on('close', (code) => code === 0 ? resolve(null) : reject(new Error(`FFmpeg exited with ${code}`)));
      proc.on('error', reject);
    });

    // Upload to R2
    const manifestUrl = await uploadToR2(outputPath, outputPrefix, res);

    outputs.push({
      resolution: res,
      manifestUrl,
      segmentPrefix: `${outputPrefix}_${res}`,
    });

    // Update progress
    await job.updateProgress((resolutions.indexOf(res) + 1) / resolutions.length * 100);
  }

  // Generate master playlist
  const masterManifest = generateMasterPlaylist(outputs);
  const masterUrl = await uploadMasterPlaylist(masterManifest, outputPrefix);

  return { outputs, masterUrl };
}, {
  connection: { host: 'redis', port: 6379 },
  concurrency: 2, // Limited concurrency for heavy CPU work
});
```

---

## Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://postgres:password@postgres:5432/iptv
      - REDIS_URL=redis://redis:6379
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET_NAME=${R2_BUCKET_NAME}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    depends_on:
      - postgres
      - redis

  probe-worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: ["node", "dist/workers/probe-worker.js"]
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgres://postgres:password@postgres:5432/iptv
    depends_on:
      - redis
      - postgres
    deploy:
      replicas: 3

  transcode-worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: ["node", "dist/workers/transcode-worker.js"]
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgres://postgres:password@postgres:5432/iptv
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
    depends_on:
      - redis
      - postgres
    deploy:
      replicas: 2

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=iptv
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  # Redis cluster for production (3 masters, 3 replicas)
  # redis-cluster:
  #   image: redis:7-alpine
  #   ...

volumes:
  postgres_data:
  redis_data:
```

---

## Kubernetes HPA (Auto-scaling)

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: probe-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: probe-worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: External
      external:
        metric:
          name: redis_queue_depth
          selector:
            matchLabels:
              queue: probe
        target:
          type: AverageValue
          averageValue: 100

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: transcode-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: transcode-worker
  minReplicas: 1
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 80
```

---

## Prometheus Metrics

```typescript
// src/common/metrics/prometheus.service.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

@Injectable()
export class PrometheusService {
  public readonly registry: Registry;

  // Probe metrics
  public readonly probeSuccessTotal: Counter;
  public readonly probeFailureTotal: Counter;
  public readonly probeLatencySeconds: Histogram;

  // Transcode metrics
  public readonly transcodeJobsRunning: Gauge;
  public readonly transcodeJobsWaiting: Gauge;
  public readonly transcodeDurationSeconds: Histogram;

  // Cache metrics
  public readonly cacheHitRatio: Gauge;
  public readonly cacheSize: Gauge;

  // API metrics
  public readonly apiRequestDuration: Histogram;
  public readonly apiRequestTotal: Counter;

  constructor() {
    this.registry = new Registry();

    this.probeSuccessTotal = new Counter({
      name: 'probe_success_total',
      help: 'Total successful probes',
      registers: [this.registry],
    });

    this.probeFailureTotal = new Counter({
      name: 'probe_failure_total',
      help: 'Total failed probes',
      registers: [this.registry],
    });

    this.probeLatencySeconds = new Histogram({
      name: 'probe_latency_seconds',
      help: 'Probe latency in seconds',
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    // ... more metrics
  }
}
```

---

## Environment Variables

```bash
# .env.example

# Database
DATABASE_URL=postgres://user:password@host:5432/iptv

# Redis
REDIS_URL=redis://localhost:6379
REDIS_CLUSTER_NODES=host1:6379,host2:6379,host3:6379

# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=iptv-cdn

# Supabase (for sync)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# API Security
API_SECRET_KEY=your_api_secret
JWT_SECRET=your_jwt_secret

# Workers
PROBE_CONCURRENCY=50
TRANSCODE_CONCURRENCY=2
PROBE_TIMEOUT_SECONDS=10

# CDN
CDN_BASE_URL=https://streaming.iptvlink.com.br
```

---

## Next Steps

1. **Deploy PostgreSQL self-hosted** com schema sync do Supabase
2. **Setup Redis cluster** (3 masters + 3 replicas)
3. **Deploy API NestJS** com os endpoints acima
4. **Deploy workers** (probe + transcode) com HPA
5. **Configurar Prometheus + Grafana** para observabilidade
6. **Integrar callbacks** com Edge Functions do Supabase

Para qualquer dúvida sobre implementação, pergunte via chat!
