-- Create unique index on r2_key if not exists to support upsert
CREATE UNIQUE INDEX IF NOT EXISTS r2_storage_objects_r2_key_unique 
ON r2_storage_objects (r2_key);

-- Also ensure source_channel_id has an index for lookups
CREATE INDEX IF NOT EXISTS r2_storage_objects_source_channel_idx 
ON r2_storage_objects (source_channel_id);