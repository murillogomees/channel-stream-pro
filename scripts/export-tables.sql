-- =============================================================================
-- Supabase Cloud Export - SQL Queries
-- Queries para exportar dados específicos de cada tabela
-- =============================================================================

-- Este arquivo contém queries COPY para exportar dados.
-- Use com: psql $CLOUD_DB_URL -f export-tables.sql

-- =============================================================================
-- TABELAS CRÍTICAS (Sempre exportar)
-- =============================================================================

-- Profiles (dados de usuários unificados)
\echo 'Exportando profiles...'
\copy (SELECT * FROM public.profiles ORDER BY created_at) TO 'exports/profiles.csv' WITH CSV HEADER;

-- User Roles (permissões)
\echo 'Exportando user_roles...'
\copy (SELECT * FROM public.user_roles) TO 'exports/user_roles.csv' WITH CSV HEADER;

-- Clientes (legado - ainda em uso)
\echo 'Exportando clientes...'
\copy (SELECT * FROM public.clientes ORDER BY data_cadastro) TO 'exports/clientes.csv' WITH CSV HEADER;

-- Planos de assinatura
\echo 'Exportando subscription_plans...'
\copy (SELECT * FROM public.subscription_plans ORDER BY price) TO 'exports/subscription_plans.csv' WITH CSV HEADER;

-- Assinaturas de usuários
\echo 'Exportando user_subscriptions...'
\copy (SELECT * FROM public.user_subscriptions ORDER BY created_at) TO 'exports/user_subscriptions.csv' WITH CSV HEADER;

-- Configuração WhatsApp
\echo 'Exportando whatsapp_config...'
\copy (SELECT * FROM public.whatsapp_config) TO 'exports/whatsapp_config.csv' WITH CSV HEADER;

-- Configuração MercadoPago
\echo 'Exportando mercado_pago_config...'
\copy (SELECT * FROM public.mercado_pago_config) TO 'exports/mercado_pago_config.csv' WITH CSV HEADER;

-- Feature Flags
\echo 'Exportando app_feature_flags...'
\copy (SELECT * FROM public.app_feature_flags) TO 'exports/app_feature_flags.csv' WITH CSV HEADER;

-- Configuração de Storage
\echo 'Exportando storage_config...'
\copy (SELECT * FROM public.storage_config) TO 'exports/storage_config.csv' WITH CSV HEADER;

-- Telefones Admin
\echo 'Exportando admin_phones...'
\copy (SELECT * FROM public.admin_phones) TO 'exports/admin_phones.csv' WITH CSV HEADER;

-- Tiers de Afiliados
\echo 'Exportando affiliate_tiers...'
\copy (SELECT * FROM public.affiliate_tiers) TO 'exports/affiliate_tiers.csv' WITH CSV HEADER;

-- Afiliados
\echo 'Exportando affiliates...'
\copy (SELECT * FROM public.affiliates ORDER BY created_at) TO 'exports/affiliates.csv' WITH CSV HEADER;

-- Cupons de Desconto
\echo 'Exportando discount_coupons...'
\copy (SELECT * FROM public.discount_coupons) TO 'exports/discount_coupons.csv' WITH CSV HEADER;

-- Conteúdo da Homepage
\echo 'Exportando homepage_content...'
\copy (SELECT * FROM public.homepage_content) TO 'exports/homepage_content.csv' WITH CSV HEADER;

-- FAQs da Homepage
\echo 'Exportando homepage_faqs...'
\copy (SELECT * FROM public.homepage_faqs ORDER BY display_order) TO 'exports/homepage_faqs.csv' WITH CSV HEADER;

-- Templates de Notificação
\echo 'Exportando notification_templates...'
\copy (SELECT * FROM public.notification_templates) TO 'exports/notification_templates.csv' WITH CSV HEADER;


-- =============================================================================
-- TABELAS DE CONTEÚDO (M3U, EPG, etc)
-- =============================================================================

-- Fontes de Sync M3U
\echo 'Exportando m3u_sync_sources...'
\copy (SELECT * FROM public.m3u_sync_sources ORDER BY created_at) TO 'exports/m3u_sync_sources.csv' WITH CSV HEADER;

-- Listas Customizadas M3U
\echo 'Exportando m3u_custom_lists...'
\copy (SELECT * FROM public.m3u_custom_lists ORDER BY created_at) TO 'exports/m3u_custom_lists.csv' WITH CSV HEADER;

-- Categorias M3U
\echo 'Exportando m3u_categories...'
\copy (SELECT * FROM public.m3u_categories ORDER BY order_position) TO 'exports/m3u_categories.csv' WITH CSV HEADER;

-- Canais M3U (pode ser grande)
\echo 'Exportando m3u_channels...'
\copy (SELECT * FROM public.m3u_channels ORDER BY order_position) TO 'exports/m3u_channels.csv' WITH CSV HEADER;

-- Entries de Sync M3U (GRANDE - 200k+ registros)
\echo 'Exportando m3u_sync_entries (grande, pode demorar)...'
\copy (SELECT * FROM public.m3u_sync_entries ORDER BY created_at) TO 'exports/m3u_sync_entries.csv' WITH CSV HEADER;

-- Metadados de Conteúdo
\echo 'Exportando content_metadata...'
\copy (SELECT * FROM public.content_metadata ORDER BY created_at) TO 'exports/content_metadata.csv' WITH CSV HEADER;

-- EPG Data
\echo 'Exportando epg_data...'
\copy (SELECT * FROM public.epg_data ORDER BY start_time) TO 'exports/epg_data.csv' WITH CSV HEADER;


-- =============================================================================
-- TABELAS DE USUÁRIOS E PREFERÊNCIAS
-- =============================================================================

-- User Profiles (perfis de visualização)
\echo 'Exportando user_profiles...'
\copy (SELECT * FROM public.user_profiles ORDER BY created_at) TO 'exports/user_profiles.csv' WITH CSV HEADER;

-- Viewer Profiles
\echo 'Exportando viewer_profiles...'
\copy (SELECT * FROM public.viewer_profiles ORDER BY created_at) TO 'exports/viewer_profiles.csv' WITH CSV HEADER;

-- Favoritos
\echo 'Exportando favorites...'
\copy (SELECT * FROM public.favorites ORDER BY created_at) TO 'exports/favorites.csv' WITH CSV HEADER;

-- Histórico de Visualização
\echo 'Exportando watch_history...'
\copy (SELECT * FROM public.watch_history ORDER BY watched_at) TO 'exports/watch_history.csv' WITH CSV HEADER;

-- Estatísticas de Uso de Canais
\echo 'Exportando channel_usage_stats...'
\copy (SELECT * FROM public.channel_usage_stats ORDER BY last_watched_at) TO 'exports/channel_usage_stats.csv' WITH CSV HEADER;


-- =============================================================================
-- TABELAS DE LOGS (Opcionais - geralmente excluídas)
-- =============================================================================

-- Descomente as linhas abaixo se quiser exportar logs

-- \echo 'Exportando activity_logs...'
-- \copy (SELECT * FROM public.activity_logs WHERE created_at > now() - interval '30 days' ORDER BY created_at) TO 'exports/activity_logs.csv' WITH CSV HEADER;

-- \echo 'Exportando auth_sessions_log...'
-- \copy (SELECT * FROM public.auth_sessions_log WHERE created_at > now() - interval '30 days' ORDER BY created_at) TO 'exports/auth_sessions_log.csv' WITH CSV HEADER;

-- \echo 'Exportando notification_logs...'
-- \copy (SELECT * FROM public.notification_logs WHERE sent_at > now() - interval '30 days' ORDER BY sent_at) TO 'exports/notification_logs.csv' WITH CSV HEADER;


-- =============================================================================
-- RELATÓRIO FINAL
-- =============================================================================

\echo ''
\echo '============================================'
\echo 'RESUMO DA EXPORTAÇÃO'
\echo '============================================'

SELECT 
    'profiles' as tabela, 
    COUNT(*) as registros 
FROM public.profiles
UNION ALL
SELECT 'user_roles', COUNT(*) FROM public.user_roles
UNION ALL
SELECT 'clientes', COUNT(*) FROM public.clientes
UNION ALL
SELECT 'm3u_sync_entries', COUNT(*) FROM public.m3u_sync_entries
UNION ALL
SELECT 'm3u_channels', COUNT(*) FROM public.m3u_channels
ORDER BY tabela;

\echo ''
\echo 'Exportação concluída!'
\echo 'Arquivos salvos em: exports/'
