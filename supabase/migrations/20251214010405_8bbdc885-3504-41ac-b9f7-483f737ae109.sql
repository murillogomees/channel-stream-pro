-- Create function to cleanup duplicates
CREATE OR REPLACE FUNCTION public.cleanup_iptv_duplicates()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH duplicates AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY original_url ORDER BY id) as rn
    FROM iptv_channels
  )
  DELETE FROM iptv_channels 
  WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;