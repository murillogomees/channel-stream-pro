-- Fix policies for existing UX tables only
DROP POLICY IF EXISTS "Admins and masters can manage viewer_profiles" ON viewer_profiles;
CREATE POLICY "Admins and masters can manage viewer_profiles" ON viewer_profiles FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins and masters can manage watch_history" ON watch_history;
CREATE POLICY "Admins and masters can manage watch_history" ON watch_history FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins and masters can manage user_favorites" ON user_favorites;
CREATE POLICY "Admins and masters can manage user_favorites" ON user_favorites FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins and masters can manage user_watchlist" ON user_watchlist;
CREATE POLICY "Admins and masters can manage user_watchlist" ON user_watchlist FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins and masters can manage stream_limits" ON stream_limits;
CREATE POLICY "Admins and masters can manage stream_limits" ON stream_limits FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins and masters can manage qos_metrics" ON qos_metrics;
CREATE POLICY "Admins and masters can manage qos_metrics" ON qos_metrics FOR ALL USING (is_admin_or_master(auth.uid()));