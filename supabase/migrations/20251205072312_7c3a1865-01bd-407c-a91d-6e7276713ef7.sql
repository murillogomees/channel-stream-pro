-- Fix all remaining admin-only policies - Batch 2

-- m3u_sync tables
DROP POLICY IF EXISTS "Admins can manage sync errors" ON m3u_sync_errors;
CREATE POLICY "Admins and masters manage m3u_sync_errors" ON m3u_sync_errors FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage sync files" ON m3u_sync_files;
CREATE POLICY "Admins and masters manage m3u_sync_files" ON m3u_sync_files FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage sync jobs" ON m3u_sync_jobs;
CREATE POLICY "Admins and masters manage m3u_sync_jobs" ON m3u_sync_jobs FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete sync sources" ON m3u_sync_sources;
DROP POLICY IF EXISTS "Admins can update sync sources" ON m3u_sync_sources;
CREATE POLICY "Admins and masters manage m3u_sync_sources" ON m3u_sync_sources FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins podem visualizar histórico" ON m3u_view_history;
CREATE POLICY "Admins and masters manage m3u_view_history" ON m3u_view_history FOR ALL USING (is_admin_or_master(auth.uid()));

-- mercado_pago
DROP POLICY IF EXISTS "Admins can view webhook logs" ON mercado_pago_webhooks;
CREATE POLICY "Admins and masters manage mercado_pago_webhooks" ON mercado_pago_webhooks FOR ALL USING (is_admin_or_master(auth.uid()));

-- metrics_snapshots
DROP POLICY IF EXISTS "Admins have full access to metrics_snapshots" ON metrics_snapshots;
DROP POLICY IF EXISTS "Admins podem visualizar métricas" ON metrics_snapshots;
CREATE POLICY "Admins and masters manage metrics_snapshots" ON metrics_snapshots FOR ALL USING (is_admin_or_master(auth.uid()));

-- migration_audit
DROP POLICY IF EXISTS "Admins can update migration audit" ON migration_audit;
DROP POLICY IF EXISTS "Admins can view migration audit" ON migration_audit;
CREATE POLICY "Admins and masters manage migration_audit" ON migration_audit FOR ALL USING (is_admin_or_master(auth.uid()));

-- notification tables
DROP POLICY IF EXISTS "Admins podem visualizar histórico" ON notification_history;
CREATE POLICY "Admins and masters manage notification_history" ON notification_history FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to notification_logs" ON notification_logs;
DROP POLICY IF EXISTS "Admins podem visualizar logs" ON notification_logs;
CREATE POLICY "Admins and masters manage notification_logs" ON notification_logs FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins podem deletar retry queue" ON notification_retry_queue;
DROP POLICY IF EXISTS "Admins podem visualizar retry queue" ON notification_retry_queue;
CREATE POLICY "Admins and masters manage notification_retry_queue" ON notification_retry_queue FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can view notification schedule" ON notification_schedule;
CREATE POLICY "Admins and masters manage notification_schedule" ON notification_schedule FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to notification_templates" ON notification_templates;
DROP POLICY IF EXISTS "Admins podem gerenciar templates" ON notification_templates;
CREATE POLICY "Admins and masters manage notification_templates" ON notification_templates FOR ALL USING (is_admin_or_master(auth.uid()));

-- payments
DROP POLICY IF EXISTS "Admins have full access to payments" ON payments;
CREATE POLICY "Admins and masters manage payments" ON payments FOR ALL USING (is_admin_or_master(auth.uid()));

-- permission_diagnostics
DROP POLICY IF EXISTS "Admins podem visualizar diagnósticos" ON permission_diagnostics;
CREATE POLICY "Admins and masters manage permission_diagnostics" ON permission_diagnostics FOR ALL USING (is_admin_or_master(auth.uid()));

-- playback_tokens
DROP POLICY IF EXISTS "Admins can manage playback tokens" ON playback_tokens;
CREATE POLICY "Admins and masters manage playback_tokens" ON playback_tokens FOR ALL USING (is_admin_or_master(auth.uid()));

-- player_analytics
DROP POLICY IF EXISTS "Admins can view all analytics" ON player_analytics;
CREATE POLICY "Admins and masters manage player_analytics" ON player_analytics FOR ALL USING (is_admin_or_master(auth.uid()));

-- playlist tables
DROP POLICY IF EXISTS "Admins full access playlist_entries" ON playlist_entries;
CREATE POLICY "Admins and masters manage playlist_entries" ON playlist_entries FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to playlist_health_checks" ON playlist_health_checks;
DROP POLICY IF EXISTS "Admins podem visualizar health checks" ON playlist_health_checks;
CREATE POLICY "Admins and masters manage playlist_health_checks" ON playlist_health_checks FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins full access playlist_sources" ON playlist_sources;
CREATE POLICY "Admins and masters manage playlist_sources" ON playlist_sources FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins full access playlist_sync_jobs" ON playlist_sync_jobs;
CREATE POLICY "Admins and masters manage playlist_sync_jobs" ON playlist_sync_jobs FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins full access playlist_sync_locks" ON playlist_sync_locks;
CREATE POLICY "Admins and masters manage playlist_sync_locks" ON playlist_sync_locks FOR ALL USING (is_admin_or_master(auth.uid()));

-- rate_limit_tracking
DROP POLICY IF EXISTS "Admin can view rate limits" ON rate_limit_tracking;
CREATE POLICY "Admins and masters manage rate_limit_tracking" ON rate_limit_tracking FOR ALL USING (is_admin_or_master(auth.uid()));

-- rls_policy_backups
DROP POLICY IF EXISTS "Admins can manage RLS policy backups" ON rls_policy_backups;
CREATE POLICY "Admins and masters manage rls_policy_backups" ON rls_policy_backups FOR ALL USING (is_admin_or_master(auth.uid()));

-- role_audit_log
DROP POLICY IF EXISTS "Admins podem visualizar auditoria de roles" ON role_audit_log;
CREATE POLICY "Admins and masters manage role_audit_log" ON role_audit_log FOR ALL USING (is_admin_or_master(auth.uid()));

-- scheduler_config
DROP POLICY IF EXISTS "Admins can manage scheduler config" ON scheduler_config;
CREATE POLICY "Admins and masters manage scheduler_config" ON scheduler_config FOR ALL USING (is_admin_or_master(auth.uid()));