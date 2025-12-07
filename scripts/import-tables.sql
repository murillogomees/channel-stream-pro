-- =============================================================================
-- Supabase Local Import - SQL Queries
-- Queries para importar dados no Supabase Local
-- =============================================================================

-- Este arquivo contém queries para importar dados de arquivos CSV.
-- Use com: psql $LOCAL_DB_URL -f import-tables.sql

-- =============================================================================
-- PREPARAÇÃO
-- =============================================================================

\echo 'Iniciando importação...'
\echo ''

-- Iniciar transação
BEGIN;

-- Desabilitar triggers temporariamente para performance
SET session_replication_role = 'replica';

-- Desabilitar verificação de foreign keys temporariamente
SET CONSTRAINTS ALL DEFERRED;


-- =============================================================================
-- TABELAS SEM DEPENDÊNCIAS (Importar primeiro)
-- =============================================================================

\echo 'Importando tabelas base...'

-- Subscription Plans
\echo '  - subscription_plans'
TRUNCATE TABLE public.subscription_plans CASCADE;
\copy public.subscription_plans FROM 'exports/subscription_plans.csv' WITH CSV HEADER;

-- Affiliate Tiers
\echo '  - affiliate_tiers'
TRUNCATE TABLE public.affiliate_tiers CASCADE;
\copy public.affiliate_tiers FROM 'exports/affiliate_tiers.csv' WITH CSV HEADER;

-- App Feature Flags
\echo '  - app_feature_flags'
TRUNCATE TABLE public.app_feature_flags CASCADE;
\copy public.app_feature_flags FROM 'exports/app_feature_flags.csv' WITH CSV HEADER;

-- Storage Config
\echo '  - storage_config'
TRUNCATE TABLE public.storage_config CASCADE;
\copy public.storage_config FROM 'exports/storage_config.csv' WITH CSV HEADER;

-- Homepage Content
\echo '  - homepage_content'
TRUNCATE TABLE public.homepage_content CASCADE;
\copy public.homepage_content FROM 'exports/homepage_content.csv' WITH CSV HEADER;

-- Homepage FAQs
\echo '  - homepage_faqs'
TRUNCATE TABLE public.homepage_faqs CASCADE;
\copy public.homepage_faqs FROM 'exports/homepage_faqs.csv' WITH CSV HEADER;

-- Notification Templates
\echo '  - notification_templates'
TRUNCATE TABLE public.notification_templates CASCADE;
\copy public.notification_templates FROM 'exports/notification_templates.csv' WITH CSV HEADER;

-- WhatsApp Config
\echo '  - whatsapp_config'
TRUNCATE TABLE public.whatsapp_config CASCADE;
\copy public.whatsapp_config FROM 'exports/whatsapp_config.csv' WITH CSV HEADER;

-- MercadoPago Config
\echo '  - mercado_pago_config'
TRUNCATE TABLE public.mercado_pago_config CASCADE;
\copy public.mercado_pago_config FROM 'exports/mercado_pago_config.csv' WITH CSV HEADER;

-- Admin Phones
\echo '  - admin_phones'
TRUNCATE TABLE public.admin_phones CASCADE;
\copy public.admin_phones FROM 'exports/admin_phones.csv' WITH CSV HEADER;


-- =============================================================================
-- TABELAS DE USUÁRIOS (Dependem de subscription_plans/tiers)
-- =============================================================================

\echo ''
\echo 'Importando tabelas de usuários...'

-- Profiles
\echo '  - profiles'
TRUNCATE TABLE public.profiles CASCADE;
\copy public.profiles FROM 'exports/profiles.csv' WITH CSV HEADER;

-- User Roles
\echo '  - user_roles'
TRUNCATE TABLE public.user_roles CASCADE;
\copy public.user_roles FROM 'exports/user_roles.csv' WITH CSV HEADER;

-- Clientes (legado)
\echo '  - clientes'
TRUNCATE TABLE public.clientes CASCADE;
\copy public.clientes FROM 'exports/clientes.csv' WITH CSV HEADER;

-- Affiliates
\echo '  - affiliates'
TRUNCATE TABLE public.affiliates CASCADE;
\copy public.affiliates FROM 'exports/affiliates.csv' WITH CSV HEADER;

-- User Subscriptions
\echo '  - user_subscriptions'
TRUNCATE TABLE public.user_subscriptions CASCADE;
\copy public.user_subscriptions FROM 'exports/user_subscriptions.csv' WITH CSV HEADER;

-- Discount Coupons
\echo '  - discount_coupons'
TRUNCATE TABLE public.discount_coupons CASCADE;
\copy public.discount_coupons FROM 'exports/discount_coupons.csv' WITH CSV HEADER;


-- =============================================================================
-- TABELAS M3U (Ordem de dependência)
-- =============================================================================

\echo ''
\echo 'Importando tabelas M3U...'

-- M3U Sync Sources
\echo '  - m3u_sync_sources'
TRUNCATE TABLE public.m3u_sync_sources CASCADE;
\copy public.m3u_sync_sources FROM 'exports/m3u_sync_sources.csv' WITH CSV HEADER;

-- M3U Custom Lists
\echo '  - m3u_custom_lists'
TRUNCATE TABLE public.m3u_custom_lists CASCADE;
\copy public.m3u_custom_lists FROM 'exports/m3u_custom_lists.csv' WITH CSV HEADER;

-- M3U Categories
\echo '  - m3u_categories'
TRUNCATE TABLE public.m3u_categories CASCADE;
\copy public.m3u_categories FROM 'exports/m3u_categories.csv' WITH CSV HEADER;

-- M3U Channels
\echo '  - m3u_channels'
TRUNCATE TABLE public.m3u_channels CASCADE;
\copy public.m3u_channels FROM 'exports/m3u_channels.csv' WITH CSV HEADER;

-- M3U Sync Entries (GRANDE)
\echo '  - m3u_sync_entries (grande, pode demorar...)'
TRUNCATE TABLE public.m3u_sync_entries CASCADE;
\copy public.m3u_sync_entries FROM 'exports/m3u_sync_entries.csv' WITH CSV HEADER;


-- =============================================================================
-- TABELAS DE CONTEÚDO
-- =============================================================================

\echo ''
\echo 'Importando tabelas de conteúdo...'

-- Content Metadata
\echo '  - content_metadata'
TRUNCATE TABLE public.content_metadata CASCADE;
\copy public.content_metadata FROM 'exports/content_metadata.csv' WITH CSV HEADER;

-- EPG Data
\echo '  - epg_data'
TRUNCATE TABLE public.epg_data CASCADE;
\copy public.epg_data FROM 'exports/epg_data.csv' WITH CSV HEADER;


-- =============================================================================
-- TABELAS DE PREFERÊNCIAS DE USUÁRIO
-- =============================================================================

\echo ''
\echo 'Importando preferências de usuário...'

-- User Profiles (viewer profiles)
\echo '  - user_profiles'
TRUNCATE TABLE public.user_profiles CASCADE;
\copy public.user_profiles FROM 'exports/user_profiles.csv' WITH CSV HEADER;

-- Viewer Profiles
\echo '  - viewer_profiles'
TRUNCATE TABLE public.viewer_profiles CASCADE;
\copy public.viewer_profiles FROM 'exports/viewer_profiles.csv' WITH CSV HEADER;

-- Favorites
\echo '  - favorites'
TRUNCATE TABLE public.favorites CASCADE;
\copy public.favorites FROM 'exports/favorites.csv' WITH CSV HEADER;

-- Watch History
\echo '  - watch_history'
TRUNCATE TABLE public.watch_history CASCADE;
\copy public.watch_history FROM 'exports/watch_history.csv' WITH CSV HEADER;

-- Channel Usage Stats
\echo '  - channel_usage_stats'
TRUNCATE TABLE public.channel_usage_stats CASCADE;
\copy public.channel_usage_stats FROM 'exports/channel_usage_stats.csv' WITH CSV HEADER;


-- =============================================================================
-- FINALIZAÇÃO
-- =============================================================================

\echo ''
\echo 'Finalizando importação...'

-- Reabilitar verificação de foreign keys
SET CONSTRAINTS ALL IMMEDIATE;

-- Reabilitar triggers
SET session_replication_role = 'origin';

-- Commit da transação
COMMIT;

-- Atualizar sequences
\echo 'Atualizando sequences...'

-- Resetar sequences para valores corretos (importante para IDs auto-incrementados)
-- Nota: A maioria das tabelas usa UUID, então isso pode não ser necessário

-- Verificar integridade
\echo ''
\echo '============================================'
\echo 'VERIFICAÇÃO DE INTEGRIDADE'
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
UNION ALL
SELECT 'subscription_plans', COUNT(*) FROM public.subscription_plans
UNION ALL
SELECT 'user_subscriptions', COUNT(*) FROM public.user_subscriptions
ORDER BY tabela;

\echo ''
\echo '============================================'
\echo 'IMPORTAÇÃO CONCLUÍDA!'
\echo '============================================'
\echo ''
\echo 'Próximos passos:'
\echo '  1. Verifique os dados importados'
\echo '  2. Execute: supabase functions serve (para Edge Functions locais)'
\echo '  3. Atualize .env.local com URLs do Supabase local'
\echo ''
