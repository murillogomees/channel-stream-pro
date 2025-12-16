-- =============================================================================
-- Production: Scheduled Jobs for Maintenance
-- =============================================================================

-- Schedule materialized view refresh every 5 minutes
SELECT cron.schedule(
  'refresh-hot-data-views',
  '*/5 * * * *',
  $$SELECT public.refresh_hot_data_views();$$
);

-- Schedule viewing history cleanup daily at 4 AM
SELECT cron.schedule(
  'cleanup-old-viewing-history',
  '0 4 * * *',
  $$SELECT public.cleanup_old_viewing_history();$$
);

-- Schedule partition creation monthly on 1st at 1 AM
SELECT cron.schedule(
  'create-metrics-partition',
  '0 1 1 * *',
  $$SELECT public.create_next_partition();$$
);

-- Schedule rate limit cleanup hourly
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 * * * *',
  $$SELECT public.cleanup_rate_limits();$$
);