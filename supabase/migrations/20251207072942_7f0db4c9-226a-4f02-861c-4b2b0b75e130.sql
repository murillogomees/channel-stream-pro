-- Add updated_at column to r2_migration_jobs for tracking stale jobs
ALTER TABLE r2_migration_jobs 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create trigger to auto-update the updated_at column
CREATE OR REPLACE FUNCTION update_r2_migration_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_r2_migration_jobs_updated_at ON r2_migration_jobs;
CREATE TRIGGER trigger_r2_migration_jobs_updated_at
  BEFORE UPDATE ON r2_migration_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_r2_migration_jobs_updated_at();

-- Initialize updated_at for existing rows based on started_at or created_at
UPDATE r2_migration_jobs 
SET updated_at = COALESCE(started_at, created_at) 
WHERE updated_at IS NULL;