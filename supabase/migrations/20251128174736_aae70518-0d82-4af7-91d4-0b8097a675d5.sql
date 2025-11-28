-- Forçar limpeza de todos os locks expirados
DELETE FROM playlist_sync_locks WHERE expires_at < now() OR playlist_key = 'lista-vip';