-- Índices para otimizar consultas de categorias em playlists
CREATE INDEX IF NOT EXISTS idx_iptv_channels_category ON iptv_channels(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_iptv_playlist_channels_playlist_id ON iptv_playlist_channels(playlist_id);
CREATE INDEX IF NOT EXISTS idx_iptv_playlist_channels_channel_id ON iptv_playlist_channels(channel_id);

-- Índice composto para busca eficiente de canais por playlist
CREATE INDEX IF NOT EXISTS idx_iptv_playlist_channels_playlist_channel ON iptv_playlist_channels(playlist_id, channel_id);