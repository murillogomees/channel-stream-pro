# CDN Worker Deployment Guide

## Overview
The CDN Worker is deployed on Cloudflare Workers Edge and provides intelligent content routing with authentication, caching, and failover capabilities.

## Architecture
```
Client Request → CDN Worker (Edge) → JWT Validation → Subscription Check → Content Routing
                                                                           ├─ R2 (VOD)
                                                                           ├─ Stream (Live)
                                                                           └─ Origin (Fallback)
```

## Features
- ✅ JWT token validation at edge
- ✅ Real-time subscription verification via Supabase
- ✅ Intelligent content routing (R2, Stream, Origin)
- ✅ Aggressive caching with immutable segments
- ✅ Automatic failover to origin
- ✅ CORS support for web players

## Prerequisites

### 1. Cloudflare Account
- Active Cloudflare account
- Workers subscription (free tier works)
- R2 bucket `iptvlink-cdn` created

### 2. GitHub Secrets
Configure these secrets in GitHub repository settings:

```
CLOUDFLARE_API_TOKEN     # Cloudflare API token with Workers edit permission
CLOUDFLARE_ACCOUNT_ID    # Your Cloudflare account ID
JWT_SECRET               # JWT signing secret (same as Supabase)
SUPABASE_URL            # https://sdvyxdghxqmntyoweqbd.supabase.co
SUPABASE_ANON_KEY       # Supabase anon/public key
```

### 3. Cloudflare API Token
Create token at: https://dash.cloudflare.com/profile/api-tokens

Required permissions:
- Account > Workers Scripts > Edit
- Account > Workers R2 Storage > Edit

## Deployment

### Automatic (GitHub Actions)
Push changes to `workers/cdn-router/` triggers automatic deployment:

```bash
git add workers/cdn-router/
git commit -m "Update CDN worker"
git push origin main
```

GitHub Actions will:
1. Install wrangler CLI
2. Configure secrets
3. Deploy to Cloudflare Workers
4. Verify deployment

### Manual Deployment
```bash
cd workers/cdn-router

# Login to Cloudflare
wrangler login

# Set secrets
wrangler secret put JWT_SECRET

# Deploy
wrangler deploy

# Test health endpoint
curl https://iptvlink-cdn-router.ACCOUNT_ID.workers.dev/health
```

## Configuration

### Cache Rules
Edit `CACHE_CONFIG` in `index.js`:

```javascript
const CACHE_CONFIG = {
  m3u8: { browser: 10, cdn: 30 },      // Manifests: 10s browser, 30s CDN
  ts: { browser: 3600, cdn: 86400 },   // Segments: 1h browser, 24h CDN, immutable
  mp4: { browser: 3600, cdn: 86400 },  // VOD: 1h browser, 24h CDN, immutable
  default: { browser: 60, cdn: 300 }   // Other: 1min browser, 5min CDN
};
```

### R2 Bucket
Update `wrangler.toml` to change bucket:

```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "iptvlink-cdn"  # Bucket padrão do sistema
```

## Usage

### Generate CDN URLs
In M3U generation, point URLs to CDN Worker:

```javascript
const cdnUrl = `https://iptvlink-cdn-router.ACCOUNT_ID.workers.dev/${r2Key}?token=${jwtToken}`;
```

### Authentication
Include JWT token via:
- **Header**: `Authorization: Bearer <token>`
- **Query param**: `?token=<token>`

### Health Check
```bash
curl https://iptvlink-cdn-router.ACCOUNT_ID.workers.dev/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

## Monitoring

### Cloudflare Dashboard
View metrics at: https://dash.cloudflare.com/workers

Metrics include:
- Requests per second
- CPU time
- Errors
- Bandwidth

### Response Headers
Check content source:
- `X-Content-Source: r2` - Served from R2
- `X-Content-Source: origin` - Proxied from origin

### Logs
View real-time logs:
```bash
wrangler tail
```

## Troubleshooting

### 401 Unauthorized
- Check JWT_SECRET matches Supabase
- Verify token expiration (exp claim)
- Confirm subscription is active

### 502 Origin Unreachable
- Origin server may be down
- Check `url` query parameter is correct
- Verify origin allows CDN worker IP

### 500 Internal Server Error
- Check wrangler logs: `wrangler tail`
- Verify R2 bucket exists and is accessible
- Confirm SUPABASE_URL and SUPABASE_ANON_KEY are correct

### No R2 Content
- Run `cdn-bulk-downloader` Edge Function to populate R2
- Check R2 bucket name matches wrangler.toml
- Verify object keys match URL paths

## Performance Optimization

### Enable Argo Smart Routing
Reduces latency by routing through Cloudflare's fastest paths:
```bash
# Enable via dashboard or API
```

### Increase Cache TTL
For very stable content, increase CDN cache:
```javascript
ts: { browser: 3600, cdn: 604800 }  // 7 days CDN cache
```

### Use Tiered Cache
Enable in Cloudflare dashboard to cache at multiple edge locations.

## Security

### Rate Limiting
Add to worker code:
```javascript
// Limit to 100 requests per minute per IP
const RATE_LIMIT = 100;
const RATE_WINDOW = 60;
```

### IP Allowlist
Restrict to known IPs:
```javascript
const ALLOWED_IPS = ['1.2.3.4', '5.6.7.8'];
if (!ALLOWED_IPS.includes(request.headers.get('CF-Connecting-IP'))) {
  return new Response('Forbidden', { status: 403 });
}
```

### Token Rotation
Implement short-lived tokens (1-hour expiration) and refresh mechanism.

## Cost Estimation

### Cloudflare Workers
- Free tier: 100,000 requests/day
- Paid: $5/month for 10M requests

### R2 Storage
- Storage: $0.015/GB/month
- Class A operations (writes): $4.50/million
- Class B operations (reads): Free
- Egress: Free

### Typical Monthly Cost (10K active users)
- Workers: Free (under 100K req/day)
- R2 Storage (500GB): $7.50
- **Total: ~$10/month**

## Rollback

If deployment fails:
```bash
# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback <deployment-id>
```

## Next Steps
1. ✅ Deploy worker via GitHub Actions
2. ✅ Configure GitHub secrets
3. ✅ Test health endpoint
4. ✅ Run bulk R2 downloader
5. ✅ Update M3U generation to use CDN URLs
6. ✅ Monitor performance in Cloudflare dashboard

## Support
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- R2 Storage Docs: https://developers.cloudflare.com/r2/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
