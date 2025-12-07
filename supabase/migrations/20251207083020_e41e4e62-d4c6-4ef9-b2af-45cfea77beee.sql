-- Limpar jobs da tabela inexistente playlist_entries
DELETE FROM r2_migration_jobs WHERE target_table = 'playlist_entries';