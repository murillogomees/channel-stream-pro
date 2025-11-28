# IPTVLINK - KPI & Executive Metrics

## Version 1.0.0 | Performance Indicators

---

## 1. EXECUTIVE DASHBOARD METRICS

### 1.1 Health Score Formula
```
Health Score = (
  Uptime Score × 0.30 +
  Performance Score × 0.25 +
  Engagement Score × 0.20 +
  Stability Score × 0.15 +
  Satisfaction Score × 0.10
) × 100
```

### 1.2 Health Score Grades

| Score | Grade | Status |
|-------|-------|--------|
| 90-100 | A | Excellent |
| 75-89 | B | Good |
| 60-74 | C | Acceptable |
| 40-59 | D | Needs Improvement |
| 0-39 | F | Critical |

---

## 2. ENGAGEMENT METRICS

### 2.1 User Engagement KPIs

| KPI | Definition | Target | Formula |
|-----|------------|--------|---------|
| DAU | Daily Active Users | Growth | Unique users/day |
| WAU | Weekly Active Users | Growth | Unique users/week |
| MAU | Monthly Active Users | Growth | Unique users/month |
| DAU/MAU | Stickiness | > 40% | DAU ÷ MAU × 100 |
| Session Duration | Avg watch time | > 45 min | Total time ÷ sessions |
| Sessions/User | Daily sessions | > 2 | Sessions ÷ users |

### 2.2 Content Engagement

| KPI | Definition | Target |
|-----|------------|--------|
| Channels Viewed | Unique channels/session | > 5 |
| Channel Switches | Switches per session | 10-30 |
| Peak Hours | High traffic periods | Track |
| Category Distribution | Content type breakdown | Track |

### 2.3 Engagement Funnel

```
┌─────────────────────────────────────────────────────┐
│ App Launch                                    100%  │
├─────────────────────────────────────────────────────┤
│ Browse Channels                                90%  │
├─────────────────────────────────────────────────────┤
│ Select Channel                                 80%  │
├─────────────────────────────────────────────────────┤
│ Watch > 1 min                                  70%  │
├─────────────────────────────────────────────────────┤
│ Watch > 10 min                                 50%  │
├─────────────────────────────────────────────────────┤
│ Complete Session (> 30 min)                    30%  │
└─────────────────────────────────────────────────────┘
```

---

## 3. RETENTION METRICS

### 3.1 Retention KPIs

| KPI | Definition | Target |
|-----|------------|--------|
| D1 Retention | Return after 1 day | > 60% |
| D7 Retention | Return after 7 days | > 40% |
| D30 Retention | Return after 30 days | > 25% |
| Churn Rate | Monthly user loss | < 10% |
| Reactivation Rate | Churned users returning | > 15% |

### 3.2 Retention Cohort Analysis

| Cohort | Week 1 | Week 2 | Week 3 | Week 4 |
|--------|--------|--------|--------|--------|
| Jan W1 | 100% | 65% | 50% | 40% |
| Jan W2 | 100% | 60% | 45% | 35% |
| Jan W3 | 100% | 70% | 55% | 45% |
| Jan W4 | 100% | 62% | 48% | 38% |

---

## 4. PLAYBACK QUALITY METRICS

### 4.1 Streaming KPIs

| KPI | Definition | Target | Critical |
|-----|------------|--------|----------|
| Startup Time | Time to first frame | < 2.5s | > 5s |
| Rebuffer Rate | Rebuffers per hour | < 2 | > 5 |
| Rebuffer Duration | Avg rebuffer length | < 3s | > 10s |
| Bitrate Average | Stream quality | > 4 Mbps | < 1 Mbps |
| Frame Drop Rate | Dropped frames % | < 1% | > 3% |

### 4.2 Quality of Experience (QoE)

| Level | Score | Definition |
|-------|-------|------------|
| Excellent | 4.5-5.0 | Perfect playback |
| Good | 3.5-4.4 | Minor issues |
| Fair | 2.5-3.4 | Noticeable issues |
| Poor | 1.5-2.4 | Significant issues |
| Bad | 1.0-1.4 | Unwatchable |

### 4.3 QoE Formula
```
QoE = 5 - (
  Startup_Penalty +
  Rebuffer_Penalty +
  Quality_Penalty +
  Error_Penalty
)

Where:
- Startup_Penalty = max(0, (StartupTime - 2) × 0.5)
- Rebuffer_Penalty = RebufferCount × 0.3
- Quality_Penalty = max(0, (4 - AvgBitrate) × 0.2)
- Error_Penalty = ErrorCount × 0.5
```

---

## 5. STABILITY METRICS

### 5.1 Crash & Error KPIs

| KPI | Definition | Target |
|-----|------------|--------|
| Crash-Free Rate | Sessions without crash | > 99.5% |
| Error Rate | Errors per session | < 0.1 |
| Fatal Error Rate | Unrecoverable errors | < 0.01% |
| Recovery Success | Auto-recovery success | > 95% |

### 5.2 Error Distribution

| Error Type | Target % | Action Threshold |
|------------|----------|------------------|
| Network | < 60% | Optimize retry |
| Media | < 20% | Improve fallback |
| Memory | < 10% | Optimize cleanup |
| Unknown | < 10% | Investigate |

---

## 6. DEVICE PERFORMANCE METRICS

### 6.1 Platform KPIs

| Platform | MAU Share | Startup | Quality |
|----------|-----------|---------|---------|
| Samsung TV | Track | < 2.5s | > 4 |
| LG TV | Track | < 2.5s | > 4 |
| Android TV | Track | < 2.0s | > 4.2 |
| Fire TV | Track | < 2.0s | > 4.2 |
| Chrome | Track | < 1.5s | > 4.5 |
| Safari | Track | < 2.0s | > 4.3 |
| Mobile | Track | < 2.0s | > 4 |

### 6.2 Device Success Matrix

| Device | Success Rate | Avg Session | NPS |
|--------|--------------|-------------|-----|
| High-end TV | > 98% | > 60 min | > 70 |
| Mid-range TV | > 95% | > 45 min | > 50 |
| Low-end TV | > 90% | > 30 min | > 30 |
| Browser | > 98% | > 45 min | > 60 |
| Mobile | > 95% | > 20 min | > 40 |

---

## 7. BUSINESS METRICS

### 7.1 Client Management KPIs

| KPI | Definition | Target |
|-----|------------|--------|
| Total Clients | Active client count | Growth |
| New Clients/Month | Monthly additions | Growth |
| Client Lifetime | Average subscription | > 6 months |
| LTV | Lifetime value | Track |
| CAC | Acquisition cost | < LTV/3 |

### 7.2 Revenue KPIs (Future)

| KPI | Definition | Target |
|-----|------------|--------|
| MRR | Monthly recurring revenue | Growth |
| ARR | Annual recurring revenue | Growth |
| ARPU | Revenue per user | Track |
| Revenue Churn | Monthly revenue lost | < 5% |

---

## 8. OPERATIONAL METRICS

### 8.1 Infrastructure KPIs

| KPI | Definition | Target |
|-----|------------|--------|
| Uptime | System availability | > 99.9% |
| MTTR | Mean time to recovery | < 15 min |
| MTBF | Mean time between failures | > 720 hours |
| Deployment Frequency | Releases per week | 2-5 |
| Change Failure Rate | Failed deployments | < 5% |

### 8.2 Cost Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Cost per User | Infrastructure/MAU | Optimize |
| Cost per Stream | Bandwidth cost | Track |
| Edge Function Cost | Compute cost | Optimize |
| Database Cost | Storage + compute | Optimize |

---

## 9. SUPPORT METRICS

### 9.1 Support KPIs

| KPI | Definition | Target |
|-----|------------|--------|
| Tickets/User | Monthly support tickets | < 0.1 |
| First Response Time | Initial reply time | < 1 hour |
| Resolution Time | Time to resolve | < 24 hours |
| First Contact Resolution | Resolved on first touch | > 70% |
| CSAT | Customer satisfaction | > 4.0/5 |

### 9.2 Issue Distribution

| Category | Target % | Trend |
|----------|----------|-------|
| Playback Issues | < 30% | ↓ |
| Account Issues | < 20% | → |
| Feature Requests | < 25% | → |
| Billing | < 15% | → |
| Other | < 10% | → |

---

## 10. CONTENT METRICS

### 10.1 Playlist Health KPIs

| KPI | Definition | Target |
|-----|------------|--------|
| Channel Availability | Working channels % | > 95% |
| Broken Channel Rate | Failed channels % | < 5% |
| Channel Refresh Rate | Update frequency | < 5 min |
| Category Coverage | Categories available | > 90% |

### 10.2 Content Performance

| Content Type | Watch Time Share | Engagement |
|--------------|------------------|------------|
| Live TV | > 60% | High |
| Movies | 20-30% | Medium |
| Series | 10-20% | High |
| Sports | Variable | Very High |

---

## 11. METRIC COLLECTION

### 11.1 Data Sources

| Metric Type | Source | Frequency |
|-------------|--------|-----------|
| Playback | Client Telemetry | Real-time |
| Engagement | Analytics | Hourly |
| Errors | Logger | Real-time |
| Business | Database | Daily |
| Infrastructure | Supabase Dashboard | Real-time |

### 11.2 Data Pipeline

```
Client → Telemetry Service → Edge Function → Database → Dashboard
                                    │
                                    ▼
                            Alert System
```

---

## 12. DASHBOARDS

### 12.1 Executive Dashboard
- Health Score
- MAU Trend
- Revenue (future)
- Top Issues

### 12.2 Operations Dashboard
- Real-time errors
- Playback quality
- Infrastructure health
- Active alerts

### 12.3 Product Dashboard
- Engagement metrics
- Retention cohorts
- Feature usage
- User feedback

---

## 13. ALERTING RULES

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error Rate | > 1% | > 5% | Page on-call |
| Uptime | < 99.9% | < 99% | Page on-call |
| Startup P95 | > 3s | > 5s | Notify team |
| Crash Rate | > 0.5% | > 1% | Page on-call |

---

*Document Version: 1.0.0*
*Last Updated: 2024*
