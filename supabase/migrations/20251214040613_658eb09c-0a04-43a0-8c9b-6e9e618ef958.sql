
-- Desabilitar triggers temporariamente e limpar via TRUNCATE
TRUNCATE TABLE iptv_stream_fingerprints CASCADE;
TRUNCATE TABLE iptv_playlist_channels CASCADE;
TRUNCATE TABLE iptv_cdn_cache CASCADE;
TRUNCATE TABLE iptv_channel_metrics CASCADE;
TRUNCATE TABLE iptv_probe_jobs CASCADE;
TRUNCATE TABLE iptv_transcode_jobs CASCADE;
TRUNCATE TABLE iptv_stream_tokens CASCADE;
TRUNCATE TABLE iptv_channels CASCADE;
TRUNCATE TABLE iptv_stream_groups CASCADE;
TRUNCATE TABLE iptv_playlists CASCADE;
TRUNCATE TABLE epg_programs CASCADE;
TRUNCATE TABLE m3u_sources CASCADE;

-- Resetar sequences
ALTER SEQUENCE IF EXISTS iptv_channels_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS iptv_playlists_id_seq RESTART WITH 1;
