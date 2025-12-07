-- Optimize get_distinct_m3u_categories with better query and index
CREATE INDEX IF NOT EXISTS idx_m3u_sync_entries_group_title ON public.m3u_sync_entries (group_title) WHERE group_title IS NOT NULL AND group_title != '';

-- Recreate the function with optimization
CREATE OR REPLACE FUNCTION public.get_distinct_m3u_categories()
RETURNS TABLE(group_title TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT m.group_title 
  FROM public.m3u_sync_entries m
  WHERE m.group_title IS NOT NULL AND m.group_title != ''
  ORDER BY m.group_title
  LIMIT 1000;
$$;