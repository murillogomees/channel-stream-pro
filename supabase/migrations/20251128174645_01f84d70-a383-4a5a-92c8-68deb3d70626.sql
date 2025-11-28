-- Reset para novo teste
DELETE FROM playlist_sync_locks WHERE playlist_key = 'lista-vip';
DELETE FROM playlist_sync_jobs WHERE playlist_key = 'lista-vip';
UPDATE playlist_sources SET last_sync_status = 'pending' WHERE key = 'lista-vip';