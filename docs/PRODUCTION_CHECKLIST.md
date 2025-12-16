# IPTV System - Production Deployment Checklist

## ✅ Completed Phases

### Phase 1 - Infrastructure
- [x] Rate limiting (check_rate_limit function)
- [x] Connection pooling (Supabase managed)
- [x] IP blacklisting (ip_blacklist table + auto_block_identifier)

### Phase 2 - Streaming Optimization
- [x] Multi-origin failover (origin-selector, stream-failover Edge Functions)
- [x] Geo-routing (region-based origin selection)
- [x] LL-HLS optimization (llhls-config Edge Function)
- [x] Origin health checks (origin-health-check Edge Function - 30s interval)

### Phase 3 - Client-side Optimization
- [x] Predictive preloading (predictive-preload Edge Function)
- [x] ML-based scoring (frequency, recency, time patterns)
- [x] Smart buffer management (smartBufferService)
- [x] Network-adaptive buffering
- [x] Viewing history tracking (user_viewing_history table)

### Phase 4 - Database Optimization
- [x] Materialized views (mv_hot_channels, mv_channel_health_summary, mv_user_activity_summary)
- [x] Time-series partitioning (performance_metrics)
- [x] Auto-partition creation
- [x] Hot data caching

### Phase 5 - Observability
- [x] Real-time metrics (realtime-metrics Edge Function)
- [x] System health checks (system-health-check Edge Function)
- [x] Auto-healing capabilities
- [x] Performance metric recording

---

## 🔧 Environment Variables Required

### Frontend (.env)
```env
VITE_SUPABASE_URL=https://waxgowafohlrfoefwhsf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=waxgowafohlrfoefwhsf
```

### Edge Functions (Supabase Secrets)
```
SUPABASE_URL                  ✅ Configured
SUPABASE_SERVICE_ROLE_KEY     ✅ Configured
SUPABASE_ANON_KEY             ✅ Configured
MERCADO_PAGO_ACCESS_TOKEN     ✅ Configured
WHATSAPP_APPKEY               ✅ Configured
WHATSAPP_AUTHKEY              ✅ Configured
R2_ACCESS_KEY_ID              ✅ Configured
R2_SECRET_ACCESS_KEY          ✅ Configured
R2_BUCKET_NAME                ✅ Configured
R2_ACCOUNT_ID                 ✅ Configured
R2_PUBLIC_DOMAIN              ✅ Configured
CLOUDFLARE_ACCOUNT_ID         ✅ Configured
CLOUDFLARE_STREAM_API_TOKEN   ✅ Configured
RESIDENTIAL_PROXY_URL         ✅ Configured
```

---

## 📊 Scheduled Jobs (pg_cron)

| Job Name | Schedule | Function |
|----------|----------|----------|
| origin-health-check-30s | Every 30s | Origin server health probes |
| refresh-hot-data-views | Every 5min | Materialized views refresh |
| cleanup-old-history | Daily 4 AM | User viewing history cleanup |
| create-next-partition | Monthly | Performance metrics partition |

---

## 🚀 Pre-Deploy Checklist

### Database
- [ ] Run pending migrations
- [ ] Verify RLS policies are enabled
- [ ] Check indexes are created
- [ ] Verify materialized views exist
- [ ] Test partition creation

### Security
- [ ] Enable Leaked Password Protection (Supabase Dashboard)
- [ ] Verify all tables have RLS
- [ ] Check admin role restrictions
- [ ] Test rate limiting

### Edge Functions
- [ ] Deploy all functions
- [ ] Verify secrets are configured
- [ ] Test health endpoints
- [ ] Check CORS headers

### Frontend
- [ ] Build production bundle
- [ ] Verify environment variables
- [ ] Test authentication flow
- [ ] Check streaming playback

---

## 📈 Monitoring Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/functions/v1/system-health-check` | Overall system health |
| `/functions/v1/realtime-metrics` | Dashboard metrics |
| `/functions/v1/origin-health-check` | Origin server status |

---

## 🔄 Rollback Procedure

1. **Revert Code**: Use Lovable version history
2. **Database**: Migrations are forward-only, use feature flags
3. **Edge Functions**: Re-deploy previous version
4. **Cache**: Clear via admin dashboard

---

## 📞 Support Contacts

- **Technical Issues**: Check Supabase logs
- **Streaming Issues**: Check origin health via dashboard
- **Payment Issues**: MercadoPago webhook logs

---

## 🎯 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Time to First Frame | < 3s | Monitoring |
| Buffer Ratio | < 2% | Monitoring |
| Origin Failover Time | < 5s | Monitoring |
| API Response Time | < 200ms | Monitoring |
| System Uptime | > 99.9% | Monitoring |

---

**Last Updated**: 2025-12-16
**Version**: 2.0.0 (Production Ready)
