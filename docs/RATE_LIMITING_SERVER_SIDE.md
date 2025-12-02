# Server-Side Rate Limiting Implementation

**Status:** ✅ Implemented  
**Priority:** HIGH  
**Last Updated:** 2025-12-02

---

## Overview

Server-side rate limiting protects Edge Functions from API abuse by enforcing request limits at the backend level, preventing bypass via client manipulation.

---

## Implementation

### 1. Core Utility: `rateLimitServerSide.ts`

**Location:** `src/utils/rateLimitServerSide.ts`

**Key Functions:**
- `checkRateLimit()` - Primary rate limit checker
- `isBlocked()` - Check if identifier is blacklisted
- `autoBlockIdentifier()` - Auto-block on excessive violations
- `getRateLimitConfig()` - Get config by endpoint name

**Features:**
- Window-based rate limiting (sliding window)
- Auto-blocking after 2x limit exceeded
- 24-hour automatic IP blocks
- Fail-open on errors (allows request if rate limit check fails)

---

## Usage in Edge Functions

### Basic Implementation

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Import types (add to Edge Function if needed)
async function checkRateLimit(supabaseClient: any, config: {
  identifier: string;
  limit: number;
  windowSeconds: number;
}) {
  // Implementation from rateLimitServerSide.ts
  // (Copy implementation or create shared Edge Function utility)
}

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get identifier (IP address)
  const identifier = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

  // Check rate limit
  const { allowed, remaining, resetAt, blocked } = await checkRateLimit(
    supabaseClient,
    {
      identifier,
      limit: 10,
      windowSeconds: 60,
    }
  );

  if (!allowed || blocked) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        remaining: 0,
        reset_at: resetAt.toISOString(),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': resetAt.toISOString(),
          'Retry-After': String(Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
        },
      }
    );
  }

  // Process request normally
  // ...
});
```

---

## Rate Limit Configurations

### Default Configurations

| Endpoint | Limit | Window | Use Case |
|----------|-------|--------|----------|
| `auth_login` | 5 req | 60s | Prevent brute force |
| `auth_signup` | 3 req | 300s | Prevent spam accounts |
| `auth_password_reset` | 3 req | 300s | Prevent abuse |
| `create_admin_user` | 5 req | 60s | Protect admin creation |
| `admin_mutation` | 30 req | 60s | General admin actions |
| `generate_m3u` | 10 req | 3600s | Limit M3U generation |
| `stream_proxy` | 100 req | 60s | Allow high streaming volume |
| `cdn_token` | 20 req | 60s | Token generation limit |
| `webhook_whatsapp` | 1000 req | 60s | High-volume webhooks |
| `webhook_payment` | 100 req | 60s | Payment webhooks |
| `default` | 60 req | 60s | Fallback for other endpoints |

---

## Priority Implementation List

### Tier 1 (CRITICAL - Authentication)
- [x] Utility implementation created
- [ ] `create-admin-user` Edge Function
- [ ] Custom auth flows (if any)

### Tier 2 (HIGH - Public APIs)
- [ ] `generate-m3u-file` Edge Function
- [ ] `stream-proxy` Edge Function
- [ ] `cdn-token` Edge Function

### Tier 3 (MEDIUM - Webhooks)
- [ ] `whatsapp-webhook` Edge Function (already has signature validation)
- [ ] `mercado-pago-webhook` Edge Function

---

## Auto-Blocking Mechanism

### Trigger Conditions
- Exceeds rate limit by 2x (e.g., 20 requests when limit is 10)
- Repeated violations within window
- Manual flag via `isBlocked()` check

### Block Duration
- **Default:** 24 hours
- **Severity:** HIGH (auto-blocked)
- **Record:** Stored in `ip_blacklist` table

### Block Record Example
```sql
INSERT INTO ip_blacklist (
  ip_address,
  reason,
  severity,
  auto_blocked,
  failed_attempts,
  last_attempt_at,
  expires_at
) VALUES (
  '192.168.1.1',
  'Auto-blocked: rate_limit_abuse (25 attempts)',
  'high',
  true,
  25,
  NOW(),
  NOW() + INTERVAL '24 hours'
);
```

---

## Database Schema

### `rate_limit_tracking` Table

```sql
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL, -- 'ip', 'user_id', 'api_key'
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_duration_seconds INTEGER NOT NULL,
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_identifier ON rate_limit_tracking(identifier, window_start);
CREATE INDEX idx_rate_limit_window ON rate_limit_tracking(window_start) WHERE window_start > NOW() - INTERVAL '1 hour';
```

---

## Monitoring & Alerts

### Metrics to Track
1. **Rate limit hits** - Number of requests blocked
2. **Auto-blocks triggered** - IPs automatically blacklisted
3. **Top offenders** - IPs with most rate limit violations
4. **Endpoint usage** - Which endpoints hit limits most often

### Query Examples

**Top Rate Limited IPs (Last 24h):**
```sql
SELECT 
  identifier,
  COUNT(*) as violation_count,
  MAX(request_count) as max_requests,
  MAX(last_request_at) as last_seen
FROM rate_limit_tracking
WHERE window_start > NOW() - INTERVAL '24 hours'
  AND request_count > 10
GROUP BY identifier
ORDER BY violation_count DESC
LIMIT 20;
```

**Auto-Blocked IPs:**
```sql
SELECT 
  ip_address,
  reason,
  failed_attempts,
  last_attempt_at,
  expires_at
FROM ip_blacklist
WHERE auto_blocked = true
  AND unblocked_at IS NULL
ORDER BY last_attempt_at DESC;
```

---

## Testing

### Manual Testing

```bash
# Test rate limiting on Edge Function
for i in {1..12}; do
  curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/YOUR_FUNCTION \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
  echo "Request $i"
  sleep 0.5
done

# Expected: First 10 succeed, next 2 return 429
```

### Automated Tests (Future)

Create Edge Function test suite:
```typescript
Deno.test("Rate limiting - blocks after limit", async () => {
  // Test implementation
});

Deno.test("Rate limiting - resets after window", async () => {
  // Test implementation
});

Deno.test("Auto-blocking - triggers at 2x threshold", async () => {
  // Test implementation
});
```

---

## Rollback Plan

If rate limiting causes issues:

1. **Emergency Disable:**
   ```sql
   -- Disable all rate limit checks (set limits to 999999)
   UPDATE rate_limit_tracking SET request_count = 0;
   ```

2. **Whitelist Critical IPs:**
   ```sql
   INSERT INTO ip_whitelist (ip_address, reason)
   VALUES ('YOUR_IP', 'Emergency whitelist during rate limit issue');
   ```

3. **Remove Auto-Blocks:**
   ```sql
   UPDATE ip_blacklist 
   SET unblocked_at = NOW() 
   WHERE auto_blocked = true;
   ```

---

## Next Steps

1. ✅ Create core utility (`rateLimitServerSide.ts`)
2. ✅ Document implementation guide
3. [ ] Implement in Tier 1 Edge Functions
4. [ ] Create monitoring dashboard
5. [ ] Set up alerts for high rate limit hits
6. [ ] Performance testing with realistic load

---

## References

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
- [IP Blacklist Management](./SECURITY_RECOMMENDATIONS.md)
