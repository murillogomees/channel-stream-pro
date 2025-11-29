-- Índices para otimizar queries em m3u_channels (200k+ registros)
CREATE INDEX IF NOT EXISTS idx_m3u_channels_category_id ON public.m3u_channels(category_id);
CREATE INDEX IF NOT EXISTS idx_m3u_channels_order_position ON public.m3u_channels(order_position);
CREATE INDEX IF NOT EXISTS idx_m3u_channels_name ON public.m3u_channels(name);
CREATE INDEX IF NOT EXISTS idx_m3u_channels_group_title ON public.m3u_channels(group_title);

-- Índices para m3u_categories
CREATE INDEX IF NOT EXISTS idx_m3u_categories_custom_list_id ON public.m3u_categories(custom_list_id);
CREATE INDEX IF NOT EXISTS idx_m3u_categories_order_position ON public.m3u_categories(order_position);

-- Índices para m3u_import_sessions
CREATE INDEX IF NOT EXISTS idx_m3u_import_sessions_status ON public.m3u_import_sessions(status);
CREATE INDEX IF NOT EXISTS idx_m3u_import_sessions_custom_list_id ON public.m3u_import_sessions(custom_list_id);
CREATE INDEX IF NOT EXISTS idx_m3u_import_sessions_created_at ON public.m3u_import_sessions(created_at DESC);

-- Índices para m3u_custom_lists
CREATE INDEX IF NOT EXISTS idx_m3u_custom_lists_status ON public.m3u_custom_lists(status);
CREATE INDEX IF NOT EXISTS idx_m3u_custom_lists_slug ON public.m3u_custom_lists(slug);