-- Atualizar a source_url da Lista Principal para a URL externa correta
UPDATE m3u_sync_sources 
SET source_url = 'https://clickzpro.top:8880/get.php?username=41343512&password=35331845&type=m3u_plus&output=m3u8',
    last_error = NULL,
    last_sync_status = 'pending'
WHERE key = 'principal';

-- Verificar a atualização
SELECT id, key, name, source_url, enabled, last_sync_status FROM m3u_sync_sources WHERE key = 'principal';