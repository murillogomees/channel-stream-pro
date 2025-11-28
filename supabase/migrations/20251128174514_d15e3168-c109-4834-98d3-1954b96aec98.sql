-- Limpar locks e jobs antigos para retry
DELETE FROM playlist_sync_locks WHERE playlist_key = 'lista-vip';
DELETE FROM playlist_sync_jobs WHERE playlist_key = 'lista-vip';

-- Reset status da fonte
UPDATE playlist_sources 
SET last_sync_status = 'pending', 
    last_sync_at = NULL,
    entries_count = 0
WHERE key = 'lista-vip';