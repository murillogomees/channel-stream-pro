-- Force enable USE_R2_STORAGE
UPDATE r2_migration_config 
SET value = 'true', updated_at = now() 
WHERE key = 'USE_R2_STORAGE';