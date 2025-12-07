-- Create index on group_title for faster DISTINCT queries
CREATE INDEX IF NOT EXISTS idx_m3u_sync_entries_group_title 
ON public.m3u_sync_entries (group_title) 
WHERE group_title IS NOT NULL;

-- Optimize the function with a limit
CREATE OR REPLACE FUNCTION public.get_distinct_m3u_categories()
RETURNS TABLE(group_title text)
LANGUAGE sql
STABLE
AS $function$
  SELECT DISTINCT m.group_title 
  FROM public.m3u_sync_entries m
  WHERE m.group_title IS NOT NULL AND m.group_title != ''
  ORDER BY m.group_title
  LIMIT 1000;
$function$;