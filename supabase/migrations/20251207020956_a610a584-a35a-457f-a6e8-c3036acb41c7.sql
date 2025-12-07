-- Create RPC to get distinct categories efficiently
CREATE OR REPLACE FUNCTION public.get_distinct_m3u_categories()
RETURNS TABLE(group_title text)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT DISTINCT group_title 
  FROM public.m3u_sync_entries 
  WHERE group_title IS NOT NULL
  ORDER BY group_title;
$$;