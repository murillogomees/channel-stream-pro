-- Update migration config to use optimized values
UPDATE r2_migration_config SET value = '50' WHERE key = 'BATCH_SIZE';
UPDATE r2_migration_config SET value = '5' WHERE key = 'CONCURRENCY';

-- Insert if not exists
INSERT INTO r2_migration_config (key, value, description)
VALUES 
  ('BATCH_SIZE', '50', 'Number of items to process per batch'),
  ('CONCURRENCY', '5', 'Number of concurrent uploads')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;