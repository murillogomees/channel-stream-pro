-- Update existing R2 objects to ready status
UPDATE r2_storage_objects 
SET status = 'ready' 
WHERE status = 'pending';