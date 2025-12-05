-- Fix all remaining admin-only policies - Final batch

-- content_metadata
DROP POLICY IF EXISTS "Admins can manage content metadata" ON content_metadata;
CREATE POLICY "Admins and masters manage content_metadata" ON content_metadata FOR ALL USING (is_admin_or_master(auth.uid()));

-- conversion_metrics
DROP POLICY IF EXISTS "Admins can view all conversion metrics" ON conversion_metrics;
CREATE POLICY "Admins and masters manage conversion_metrics" ON conversion_metrics FOR ALL USING (is_admin_or_master(auth.uid()));

-- coupon_usage
DROP POLICY IF EXISTS "Admins can view coupon usage" ON coupon_usage;
CREATE POLICY "Admins and masters manage coupon_usage" ON coupon_usage FOR ALL USING (is_admin_or_master(auth.uid()));

-- custom_status_badges
DROP POLICY IF EXISTS "Admins podem atualizar status personalizados" ON custom_status_badges;
DROP POLICY IF EXISTS "Admins podem deletar status personalizados" ON custom_status_badges;
DROP POLICY IF EXISTS "Admins podem visualizar status personalizados" ON custom_status_badges;
CREATE POLICY "Admins and masters manage custom_status_badges" ON custom_status_badges FOR ALL USING (is_admin_or_master(auth.uid()));

-- discount_coupons
DROP POLICY IF EXISTS "Admins can manage coupons" ON discount_coupons;
CREATE POLICY "Admins and masters manage discount_coupons" ON discount_coupons FOR ALL USING (is_admin_or_master(auth.uid()));

-- epg_data
DROP POLICY IF EXISTS "Admins can manage EPG" ON epg_data;
CREATE POLICY "Admins and masters manage epg_data" ON epg_data FOR ALL USING (is_admin_or_master(auth.uid()));

-- feature_flag_config
DROP POLICY IF EXISTS "Admins can modify feature flags" ON feature_flag_config;
CREATE POLICY "Admins and masters manage feature_flag_config" ON feature_flag_config FOR ALL USING (is_admin_or_master(auth.uid()));

-- health_snapshots
DROP POLICY IF EXISTS "Admins have full access to health_snapshots" ON health_snapshots;
DROP POLICY IF EXISTS "Admins podem visualizar health" ON health_snapshots;
CREATE POLICY "Admins and masters manage health_snapshots" ON health_snapshots FOR ALL USING (is_admin_or_master(auth.uid()));

-- homepage_content
DROP POLICY IF EXISTS "Admins podem gerenciar conteúdo" ON homepage_content;
CREATE POLICY "Admins and masters manage homepage_content" ON homepage_content FOR ALL USING (is_admin_or_master(auth.uid()));

-- homepage_faqs
DROP POLICY IF EXISTS "Admins podem gerenciar FAQs" ON homepage_faqs;
CREATE POLICY "Admins and masters manage homepage_faqs" ON homepage_faqs FOR ALL USING (is_admin_or_master(auth.uid()));

-- ip_blacklist
DROP POLICY IF EXISTS "Admins can manage IP blacklist" ON ip_blacklist;
DROP POLICY IF EXISTS "Admins have full access to ip_blacklist" ON ip_blacklist;
CREATE POLICY "Admins and masters manage ip_blacklist" ON ip_blacklist FOR ALL USING (is_admin_or_master(auth.uid()));

-- ip_whitelist
DROP POLICY IF EXISTS "Admins have full access to ip_whitelist" ON ip_whitelist;
DROP POLICY IF EXISTS "Admins podem gerenciar whitelist" ON ip_whitelist;
CREATE POLICY "Admins and masters manage ip_whitelist" ON ip_whitelist FOR ALL USING (is_admin_or_master(auth.uid()));

-- m3u_categories
DROP POLICY IF EXISTS "Admins full access m3u_categories" ON m3u_categories;
CREATE POLICY "Admins and masters manage m3u_categories" ON m3u_categories FOR ALL USING (is_admin_or_master(auth.uid()));

-- m3u_custom_lists
DROP POLICY IF EXISTS "Admins full access m3u_custom_lists" ON m3u_custom_lists;
CREATE POLICY "Admins and masters manage m3u_custom_lists" ON m3u_custom_lists FOR ALL USING (is_admin_or_master(auth.uid()));

-- m3u_generation_logs
DROP POLICY IF EXISTS "Admins full access m3u_generation_logs" ON m3u_generation_logs;
CREATE POLICY "Admins and masters manage m3u_generation_logs" ON m3u_generation_logs FOR ALL USING (is_admin_or_master(auth.uid()));

-- m3u_health_checks
DROP POLICY IF EXISTS "Admins podem visualizar health checks" ON m3u_health_checks;
CREATE POLICY "Admins and masters manage m3u_health_checks" ON m3u_health_checks FOR ALL USING (is_admin_or_master(auth.uid()));

-- m3u_import tables
DROP POLICY IF EXISTS "Admins têm acesso total a import cache" ON m3u_import_cache;
CREATE POLICY "Admins and masters manage m3u_import_cache" ON m3u_import_cache FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins têm acesso total a import changes" ON m3u_import_changes;
CREATE POLICY "Admins and masters manage m3u_import_changes" ON m3u_import_changes FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins têm acesso total a import queue" ON m3u_import_queue;
CREATE POLICY "Admins and masters manage m3u_import_queue" ON m3u_import_queue FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins têm acesso total a import sessions" ON m3u_import_sessions;
CREATE POLICY "Admins and masters manage m3u_import_sessions" ON m3u_import_sessions FOR ALL USING (is_admin_or_master(auth.uid()));

-- m3u_list_favorites
DROP POLICY IF EXISTS "Admins podem gerenciar próprios favoritos" ON m3u_list_favorites;
CREATE POLICY "Admins and masters manage m3u_list_favorites" ON m3u_list_favorites FOR ALL USING (is_admin_or_master(auth.uid()));

-- m3u_lists
DROP POLICY IF EXISTS "Admins have full access to m3u_lists" ON m3u_lists;
DROP POLICY IF EXISTS "Admins podem gerenciar listas M3U" ON m3u_lists;
CREATE POLICY "Admins and masters manage m3u_lists" ON m3u_lists FOR ALL USING (is_admin_or_master(auth.uid()));

-- m3u_lists_audit
DROP POLICY IF EXISTS "Admins podem visualizar histórico de M3U" ON m3u_lists_audit;
CREATE POLICY "Admins and masters manage m3u_lists_audit" ON m3u_lists_audit FOR ALL USING (is_admin_or_master(auth.uid()));

-- m3u_sync_entries
DROP POLICY IF EXISTS "Admins can manage sync entries" ON m3u_sync_entries;
CREATE POLICY "Admins and masters manage m3u_sync_entries" ON m3u_sync_entries FOR ALL USING (is_admin_or_master(auth.uid()));