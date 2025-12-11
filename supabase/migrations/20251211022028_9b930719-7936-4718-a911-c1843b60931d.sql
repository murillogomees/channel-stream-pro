
-- Add unique constraint for watch_progress upsert
ALTER TABLE public.watch_progress 
ADD CONSTRAINT watch_progress_user_content_unique 
UNIQUE (user_id, content_id);
