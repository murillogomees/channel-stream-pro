# 🏗️ IPTVLINK Architecture Diagram

## Full System Architecture

```mermaid
flowchart TB
    subgraph Client["👤 Client Layer"]
        WEB[Web App<br/>React/Vite]
        MOBILE[Mobile App<br/>Capacitor]
        TV[Smart TV<br/>WebOS/Tizen]
    end

    subgraph CDN["🌐 CDN Layer"]
        CF_WORKER[Cloudflare Worker<br/>JWT Validator + Cache]
        CF_CDN[Cloudflare CDN<br/>Edge Caching]
        R2[Cloudflare R2<br/>Object Storage]
    end

    subgraph API["⚡ API Layer"]
        SUPABASE_API[Supabase API<br/>PostgREST]
        EDGE_FN[Edge Functions<br/>Deno Runtime]
        REALTIME[Supabase Realtime<br/>WebSocket]
    end

    subgraph Backend["🔧 Backend Services"]
        INGEST[Ingest Consumer<br/>M3U Parser]
        TRANSCODE[Transcode Worker<br/>FFmpeg/HLS]
        PREWARM[Prewarm Job<br/>Cache Warming]
        UPLOAD[Upload Signer<br/>Signed URLs]
    end

    subgraph Database["💾 Database Layer"]
        POSTGRES[(PostgreSQL<br/>Supabase DB)]
        STORAGE[Supabase Storage<br/>Media Files]
    end

    subgraph External["🌍 External Services"]
        WHATSAPP[WhatsApp API<br/>Notifications]
        TMDB[TMDB API<br/>Metadata]
        MERCADOPAGO[MercadoPago<br/>Payments]
    end

    subgraph Monitoring["📊 Monitoring"]
        SENTRY[Sentry<br/>Error Tracking]
        ANALYTICS[Analytics<br/>Web Vitals]
    end

    %% Client connections
    WEB --> CF_WORKER
    MOBILE --> CF_WORKER
    TV --> CF_WORKER
    
    WEB --> SUPABASE_API
    MOBILE --> SUPABASE_API
    
    WEB --> REALTIME
    
    %% CDN flow
    CF_WORKER --> CF_CDN
    CF_CDN --> R2
    CF_WORKER --> EDGE_FN
    
    %% API connections
    SUPABASE_API --> POSTGRES
    EDGE_FN --> POSTGRES
    EDGE_FN --> STORAGE
    
    %% Backend services
    INGEST --> POSTGRES
    INGEST --> R2
    TRANSCODE --> R2
    TRANSCODE --> POSTGRES
    PREWARM --> CF_CDN
    PREWARM --> POSTGRES
    UPLOAD --> R2
    UPLOAD --> EDGE_FN
    
    %% External integrations
    EDGE_FN --> WHATSAPP
    EDGE_FN --> TMDB
    EDGE_FN --> MERCADOPAGO
    
    %% Monitoring
    WEB --> SENTRY
    WEB --> ANALYTICS
    EDGE_FN --> SENTRY
```

## Data Flow: Ingest → Playback

```mermaid
sequenceDiagram
    participant Admin
    participant API as Edge Function
    participant Ingest as Ingest Consumer
    participant Transcode as Transcode Worker
    participant R2 as Cloudflare R2
    participant Worker as CF Worker
    participant CDN as CF CDN
    participant Player

    Admin->>API: Upload M3U/Video URL
    API->>Ingest: Queue ingest job
    Ingest->>Ingest: Parse M3U/Fetch video
    Ingest->>R2: Upload raw content
    Ingest->>API: Update status: ingested
    
    API->>Transcode: Queue transcode job
    Transcode->>R2: Fetch raw content
    Transcode->>Transcode: FFmpeg HLS transcode
    Transcode->>R2: Upload HLS segments
    Transcode->>API: Update status: ready
    
    Player->>Worker: Request stream (JWT)
    Worker->>Worker: Validate JWT
    Worker->>Worker: Normalize cache key
    Worker->>CDN: Forward request
    CDN->>R2: Fetch if cache miss
    R2-->>CDN: HLS segment
    CDN-->>Worker: Cached response
    Worker-->>Player: Stream data
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant App as React App
    participant Auth as Supabase Auth
    participant Hook as Auth Hook
    participant DB as PostgreSQL
    participant API as Protected API

    User->>App: Login request
    App->>Auth: signInWithPassword()
    Auth->>Auth: Validate credentials
    Auth->>DB: Create session
    Auth-->>App: JWT + Refresh Token
    App->>Hook: Store session
    Hook->>Hook: Update AuthContext
    
    App->>API: Request with JWT
    API->>API: Validate JWT (custom_access_token_hook)
    API->>DB: Check user_roles
    DB-->>API: Role: admin/client
    API-->>App: Protected response
```

## Feature Flag Flow

```mermaid
flowchart LR
    subgraph Config["Configuration"]
        DB_FLAGS[(feature_flag_config)]
        LOCAL[localStorage Override]
    end
    
    subgraph Service["FeatureFlagsService"]
        LOAD[Load Flags]
        CHECK[isEnabled()]
        HASH[User Hash]
    end
    
    subgraph Decision["Decision Logic"]
        OVERRIDE{Override?}
        ENABLED{Enabled?}
        DEVICE{Device Match?}
        PERCENT{Percentage?}
    end
    
    subgraph Result["Result"]
        ON[Feature ON]
        OFF[Feature OFF]
    end
    
    DB_FLAGS --> LOAD
    LOCAL --> LOAD
    LOAD --> CHECK
    CHECK --> OVERRIDE
    OVERRIDE -->|Yes| ON
    OVERRIDE -->|No| ENABLED
    ENABLED -->|No| OFF
    ENABLED -->|Yes| DEVICE
    DEVICE -->|No| OFF
    DEVICE -->|Yes| PERCENT
    HASH --> PERCENT
    PERCENT -->|Pass| ON
    PERCENT -->|Fail| OFF
```

## Database Schema Overview

```mermaid
erDiagram
    PROFILES ||--o{ USER_SUBSCRIPTIONS : "profile_id"
    PROFILES ||--o{ USER_ROLES : "user_id"
    PROFILES ||--o{ WATCH_PROGRESS : tracks
    PROFILES ||--o{ FAVORITES : has
    PROFILES ||--o{ CHANNEL_USAGE_STATS : records
    
    PROFILES {
        uuid id PK
        uuid user_id FK
        string full_name
        string contact_phone
        string email
        string plano
        date data_vencimento
        boolean cliente_ativo
        string situacao
        string mac_smart_one
        string dispositivo_contratado
        number valor_pago
    }
    USER_SUBSCRIPTIONS {
        uuid id PK
        uuid profile_id FK
        string status
        date current_period_start
        date current_period_end
    }
    
    USER_ROLES {
        uuid id PK
        uuid user_id FK
        string role
    }
    
    M3U_CUSTOM_LISTS ||--o{ M3U_CATEGORIES : contains
    M3U_CATEGORIES ||--o{ M3U_CHANNELS : contains
    
    SECURITY_EVENTS ||--o{ SECURITY_ALERT_DELIVERIES : triggers
    ADMIN_PHONES ||--o{ SECURITY_ALERT_DELIVERIES : receives
    
    FEATURE_FLAG_CONFIG ||--o{ MIGRATION_AUDIT : tracks
        boolean cliente_ativo
    }
    
    M3U_CHANNELS {
        uuid id PK
        uuid category_id FK
        string name
        string stream_url
        boolean is_vod
    }
    
    FEATURE_FLAG_CONFIG {
        uuid id PK
        string flag_name
        boolean enabled
        int percentage
    }
```

## Deployment Pipeline

```mermaid
flowchart LR
    subgraph Dev["Development"]
        CODE[Code Change]
        COMMIT[Git Commit]
    end
    
    subgraph CI["CI Pipeline"]
        LINT[ESLint]
        TEST[Vitest]
        BUILD[Vite Build]
        E2E[Playwright]
    end
    
    subgraph Deploy["Deployment"]
        STAGING[Staging<br/>Auto Deploy]
        CANARY[Canary<br/>5% Traffic]
        PROD[Production<br/>100%]
    end
    
    subgraph Monitor["Monitoring"]
        METRICS[Metrics Check]
        ALERTS[Alerts]
        ROLLBACK[Rollback]
    end
    
    CODE --> COMMIT
    COMMIT --> LINT
    LINT --> TEST
    TEST --> BUILD
    BUILD --> E2E
    E2E -->|Pass| STAGING
    STAGING --> CANARY
    CANARY --> METRICS
    METRICS -->|OK| PROD
    METRICS -->|Fail| ROLLBACK
    ROLLBACK --> STAGING
    ALERTS --> ROLLBACK
```

---

*Last updated: 2025-11-30*
