-- Corrigir a URL truncada da fonte principal
UPDATE m3u_sync_sources 
SET source_url = 'http://clickzpro.top:8880/get.php?username=41343512&password=35331845&type=m3u_plus&output=m3u8',
    last_error = NULL,
    last_sync_status = 'pending'
WHERE key = 'principal';

-- Verificar
SELECT id, key, source_url FROM m3u_sync_sources WHERE key = 'principal';